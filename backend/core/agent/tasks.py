"""
Setu Agent Command Processing (Step 8.5 + Step 14.6)

This module contains the main command processing function that:
  1. Checks Tier 0 fast-path for instant responses (Step 14.6)
  2. Runs the LLM agent on complex commands
  3. Streams the response word-by-word to the WebSocket channel
  4. Generates TTS audio (cached for fast responses) and sends it to the client
  5. Persists the conversation to MongoDB

The agent, TTS engine, fast router, and TTS cache are initialized once at
module level (singleton pattern) to avoid reloading heavy models on every
function call.
"""

import time
import logging


from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from datetime import datetime, timezone

from .llm_agent import SetuAgent
from .fast_responses import FastResponseRouter
from .tts_cache import TTSCache
from core.ai.tts import TTSEngine
from core.conversations.models import Conversation, Message, MessageMetadata

logger = logging.getLogger('core.agent')

# ── Module-level singletons — loaded once per process ─────────────────────
agent_instance = SetuAgent()
tts_engine     = TTSEngine()
fast_router    = FastResponseRouter()
tts_cache      = TTSCache()

# Pre-warm common greetings asynchronously at server boot
tts_cache.warm_cache(tts_engine, user_names=["there", "User", "dost", "daved"])


from .cancellation import register_cancellation, unregister_cancellation, is_cancelled

# ── User preference cache (Step 14.6.5) ──────────────────────────────────
# Avoids a MongoDB lookup on every single command.
from django.core.cache import cache
_PREF_CACHE_TTL  = 300  # 5 minutes


def _get_user_prefs(user_id: str) -> dict:
    """
    Get user display name + TTS preferences, with a 5-minute in-memory cache.
    Falls back to safe defaults if the user is not found (e.g. user_id='local').
    """
    cache_key = f"user_prefs_{user_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Defaults (used for local listener or if DB is unreachable)
    prefs = {
        'name': 'there',
        'voice': 'af_heart',
        'speed': 1.0,
        'lang': 'en',
    }

    try:
        from core.users.models import User
        user = User.objects(user_id=user_id).first()
        if user:
            prefs['name'] = user.username or 'there'
            if user.preferences:
                pref = user.preferences
                prefs['lang'] = pref.language or 'en'
                gender = pref.tts_voice_gender or 'female'
                prefs['speed'] = pref.tts_speed or 1.0
                if prefs['lang'] == 'hi':
                    prefs['voice'] = 'hf_alpha' if gender == 'female' else 'hm_omega'
                else:
                    prefs['voice'] = 'af_heart' if gender == 'female' else 'am_echo'
    except Exception as e:
        logger.warning("Failed to load user prefs for %s: %s", user_id, e)

    cache.set(cache_key, prefs, _PREF_CACHE_TTL)
    return prefs


def clear_user_pref_cache(user_id: str) -> None:
    """Clear the cached preferences for a specific user to force a database reload."""
    cache.delete(f"user_prefs_{user_id}")
    logger.info("Cleared user preference cache for: %s", user_id)


def _push(channel_layer, group: str, chunk_type: str, message: str) -> None:
    """Helper: synchronously push a message to a WebSocket channel group."""
    async_to_sync(channel_layer.group_send)(
        group,
        {'type': 'agent_message', 'chunk_type': chunk_type, 'message': message}
    )


def _persist_conversation(
    conversation_id: str, user_id: str,
    user_text: str, assistant_text: str
) -> None:
    """Helper: save a user→assistant exchange to MongoDB."""
    try:
        conv = Conversation.objects(conversation_id=conversation_id).first()
        if not conv:
            conv = Conversation(conversation_id=conversation_id, user_id=user_id)

        conv.messages.append(Message(
            role='user',
            content=user_text,
            metadata=MessageMetadata(input_type='text')
        ))
        conv.messages.append(Message(
            role='assistant',
            content=assistant_text,
            metadata=MessageMetadata(input_type='text')
        ))
        conv.last_updated = datetime.now(timezone.utc)
        conv.save()
    except Exception as e:
        logger.error("Failed to save conversation %s to MongoDB: %s", conversation_id, e)


def process_agent_command(text: str, conversation_id: str, user_id: str) -> bool:
    """
    Process a user command through the Setu agent pipeline.

    Pipeline order:
      1. Tier 0 fast-path (regex match → cached TTS → instant response)
      2. Full LLM pipeline (LangGraph agent → streaming TTS)

    Args:
        text:            The user's text command.
        conversation_id: UUID for the active conversation (WebSocket group key).
        user_id:         UUID of the requesting user.
    """
    channel_layer = get_channel_layer()
    group = f'chat_{conversation_id}'
    has_error = False

    try:
        register_cancellation(conversation_id)

        # ── Load cached user preferences ──────────────────────────────────────
        prefs = _get_user_prefs(user_id)
        voice = prefs['voice']
        speed = prefs['speed']

        if is_cancelled(conversation_id):
            _push(channel_layer, group, 'status', 'cancelled')
            return True

        # ── TIER 0: Fast-path check (< 0.3s) ─────────────────────────────────
        start_time = time.time()
        fast = fast_router.check(text, user_name=prefs['name'], language=prefs['lang'])
        if fast:
            duration = time.time() - start_time
            logger.info("Tier 0 fast response [%s] matched in %.4fs: '%s' → '%s'", fast.category, duration, text, fast.text)

            if is_cancelled(conversation_id):
                _push(channel_layer, group, 'status', 'cancelled')
                return True

            _push(channel_layer, group, 'text', fast.text)

            # Use cached TTS audio (generates on first hit, instant on subsequent)
            tts_start = time.time()
            try:
                audio_b64 = tts_cache.get_or_generate(fast.text, voice, tts_engine, speed)
                tts_duration = time.time() - tts_start
                logger.info("Tier 0 TTS cache lookup/generation took %.4fs", tts_duration)
                if audio_b64 and not is_cancelled(conversation_id):
                    _push(channel_layer, group, 'audio', audio_b64)
            except Exception as e:
                logger.warning("TTS cache lookup/generation failed for fast-path: %s", e)

            if is_cancelled(conversation_id):
                _push(channel_layer, group, 'status', 'cancelled')
                return True

            # Persist to conversation history
            _persist_conversation(conversation_id, user_id, text, fast.text)

            _push(channel_layer, group, 'status', 'done')
            return True

        # ── TIER 2: Full LLM pipeline ─────────────────────────────────────────
        # (Tier 1 — Intent Classifier — will be inserted here in Step 15)

        if is_cancelled(conversation_id):
            _push(channel_layer, group, 'status', 'cancelled')
            return True

        # Notify client: thinking / understanding
        _push(channel_layer, group, 'status', 'understanding')

        # ── Run agent & stream response tokens in real-time ──────────────────
        response_text = ""
        try:
            def handle_status(status_msg):
                _push(channel_layer, group, 'status', status_msg)

            for token in agent_instance.run_stream(
                text, 
                user_id=user_id, 
                conversation_id=conversation_id, 
                status_callback=handle_status
            ):
                if is_cancelled(conversation_id):
                    logger.info("Command processing cancelled for conversation %s", conversation_id)
                    _push(channel_layer, group, 'status', 'cancelled')
                    return True
                if token:
                    _push(channel_layer, group, 'text', token)
                    response_text += token
        except Exception as e:
            logger.error("LLM stream failed for conversation %s: %s", conversation_id, e)
            if is_cancelled(conversation_id):
                _push(channel_layer, group, 'status', 'cancelled')
                return True
            error_msg = "\n[Response generation interrupted due to a system error.]"
            _push(channel_layer, group, 'text', error_msg)
            response_text += error_msg
            has_error = True

        if is_cancelled(conversation_id):
            _push(channel_layer, group, 'status', 'cancelled')
            return True

        if not has_error:
            # ── Generate and stream TTS audio ─────────────────────────────────────
            try:
                tts_start = time.time()
                audio_b64 = tts_engine.generate_base64(response_text, voice=voice, speed=speed)
                tts_duration = time.time() - tts_start
                logger.info("TTS generation took %.4fs", tts_duration)
                if audio_b64 and not is_cancelled(conversation_id):
                    _push(channel_layer, group, 'audio', audio_b64)
            except Exception as e:
                logger.warning("TTS generation failed for conversation %s: %s", conversation_id, e)

        if is_cancelled(conversation_id):
            _push(channel_layer, group, 'status', 'cancelled')
            return True

        # ── Persist conversation to MongoDB ───────────────────────────────────
        _persist_conversation(conversation_id, user_id, text, response_text)

        # ── Notify client: done or failed ─────────────────────────────────────
        if has_error:
            _push(channel_layer, group, 'status', 'failed')
        else:
            _push(channel_layer, group, 'status', 'done')

    except Exception as e:
        logger.error("System error processing command: %s", e)
        try:
            _push(channel_layer, group, 'status', 'failed')
        except Exception:
            pass
        return False
    finally:
        unregister_cancellation(conversation_id)

    return True
