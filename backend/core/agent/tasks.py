"""
Setu Celery Tasks — Agent Command Processing (Step 8.5)

This module contains the Celery task that:
  1. Runs the LLM agent on a user command
  2. Streams the response word-by-word to the WebSocket channel
  3. Generates TTS audio and sends it to the client
  4. Persists the conversation to MongoDB

The agent and TTS engine are initialized once at module level (singleton pattern)
to avoid reloading heavy models on every task execution (Bug B3 fix).
"""

import logging
import re

from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from datetime import datetime, timezone

from .llm_agent import SetuAgent
from core.ai.tts import TTSEngine
from core.conversations.models import Conversation, Message, MessageMetadata

logger = logging.getLogger('core.agent')

# Module-level singletons — loaded once per Celery worker process
agent_instance = SetuAgent()
tts_engine     = TTSEngine()


def _push(channel_layer, group: str, chunk_type: str, message: str) -> None:
    """Helper: synchronously push a message to a WebSocket channel group."""
    async_to_sync(channel_layer.group_send)(
        group,
        {'type': 'agent_message', 'chunk_type': chunk_type, 'message': message}
    )


@shared_task
def process_agent_command(text: str, conversation_id: str, user_id: str) -> bool:
    """
    Process a user command through the Setu agent pipeline.

    Args:
        text:            The user's text command.
        conversation_id: UUID for the active conversation (WebSocket group key).
        user_id:         UUID of the requesting user.
    """
    channel_layer = get_channel_layer()
    group = f'chat_{conversation_id}'

    # ── Notify client: thinking ───────────────────────────────────────────
    _push(channel_layer, group, 'status', 'thinking')

    # ── Run agent ─────────────────────────────────────────────────────────
    response_text = agent_instance.run(text, user_id=user_id, conversation_id=conversation_id)

    # ── Stream response tokens ────────────────────────────────────────────
    words = response_text.split(' ')
    for i, word in enumerate(words):
        chunk = word + (' ' if i < len(words) - 1 else '')
        _push(channel_layer, group, 'text', chunk)

    # ── Generate and stream TTS audio ─────────────────────────────────────
    try:
        # Generate full TTS audio for the response without truncation
        audio_b64 = tts_engine.generate_base64(response_text)
        if audio_b64:
            _push(channel_layer, group, 'audio', audio_b64)
    except Exception as e:
        logger.warning("TTS generation failed for conversation %s: %s", conversation_id, e)

    # ── Persist conversation to MongoDB ───────────────────────────────────
    try:
        conv = Conversation.objects(conversation_id=conversation_id).first()
        if not conv:
            conv = Conversation(conversation_id=conversation_id, user_id=user_id)

        conv.messages.append(Message(
            role='user',
            content=text,
            metadata=MessageMetadata(input_type='text')
        ))
        conv.messages.append(Message(
            role='assistant',
            content=response_text,
            metadata=MessageMetadata(input_type='text')
        ))
        conv.last_updated = datetime.now(timezone.utc)
        conv.save()
    except Exception as e:
        logger.error("Failed to save conversation %s to MongoDB: %s", conversation_id, e)

    # ── Notify client: done ───────────────────────────────────────────────
    _push(channel_layer, group, 'status', 'done')

    return True
