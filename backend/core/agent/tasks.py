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


# ── User preference cache (Step 14.6.5) ──────────────────────────────────
# Avoids a MongoDB lookup on every single command.
_user_pref_cache = {}   # { user_id: { name, voice, speed, lang, cached_at } }
_PREF_CACHE_TTL  = 300  # 5 minutes


def _get_user_prefs(user_id: str) -> dict:
    """
    Get user display name + TTS preferences, with a 5-minute in-memory cache.
    Falls back to safe defaults if the user is not found (e.g. user_id='local').
    """
    now = time.time()
    cached = _user_pref_cache.get(user_id)
    if cached and (now - cached['cached_at']) < _PREF_CACHE_TTL:
        return cached

    # Defaults (used for local listener or if DB is unreachable)
    prefs = {
        'name': 'there',
        'voice': 'af_heart',
        'speed': 1.0,
        'lang': 'en',
        'cached_at': now,
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

    _user_pref_cache[user_id] = prefs
    return prefs


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

    # ── Load cached user preferences ──────────────────────────────────────
    prefs = _get_user_prefs(user_id)
    voice = prefs['voice']
    speed = prefs['speed']

    # ── TIER 0: Fast-path check (< 0.3s) ─────────────────────────────────
    fast = fast_router.check(text, user_name=prefs['name'], language=prefs['lang'])
    if fast:
        logger.info("Tier 0 fast response [%s]: '%s' → '%s'", fast.category, text, fast.text)

        _push(channel_layer, group, 'text', fast.text)

        # Use cached TTS audio (generates on first hit, instant on subsequent)
        audio_b64 = tts_cache.get_or_generate(fast.text, voice, tts_engine, speed)
        if audio_b64:
            _push(channel_layer, group, 'audio', audio_b64)

        # Persist to conversation history
        _persist_conversation(conversation_id, user_id, text, fast.text)

        _push(channel_layer, group, 'status', 'done')
        return True

    # ── TIER 2: Full LLM pipeline ─────────────────────────────────────────
    # (Tier 1 — Intent Classifier — will be inserted here in Step 15)

    # Notify client: thinking
    _push(channel_layer, group, 'status', 'thinking')

    # ── Run agent & stream response tokens in real-time ──────────────────
    response_text = ""
    try:
        for token in agent_instance.run_stream(text, user_id=user_id, conversation_id=conversation_id):
            if token:
                _push(channel_layer, group, 'text', token)
                response_text += token
    except Exception as e:
        logger.error("LLM stream failed for conversation %s: %s", conversation_id, e)
        error_msg = "\n[Response generation interrupted due to a system error.]"
        _push(channel_layer, group, 'text', error_msg)
        response_text += error_msg

    # ── Generate and stream TTS audio ─────────────────────────────────────
    try:
        audio_b64 = tts_engine.generate_base64(response_text, voice=voice, speed=speed)
        if audio_b64:
            _push(channel_layer, group, 'audio', audio_b64)
    except Exception as e:
        logger.warning("TTS generation failed for conversation %s: %s", conversation_id, e)

    # ── Persist conversation to MongoDB ───────────────────────────────────
    _persist_conversation(conversation_id, user_id, text, response_text)

    # ── Notify client: done ───────────────────────────────────────────────
    _push(channel_layer, group, 'status', 'done')

    return True
