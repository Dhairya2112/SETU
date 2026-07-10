import threading
import logging

logger = logging.getLogger('core.cancellation')

_cancellation_registry = {}  # { conversation_id: threading.Event }
_lock = threading.Lock()

def register_cancellation(conversation_id: str) -> threading.Event:
    """Register a new cancellation event for a conversation."""
    with _lock:
        event = threading.Event()
        _cancellation_registry[conversation_id] = event
        logger.debug("Registered cancellation event for conversation: %s", conversation_id)
        return event

def unregister_cancellation(conversation_id: str):
    """Unregister the cancellation event for a conversation."""
    with _lock:
        _cancellation_registry.pop(conversation_id, None)
        logger.debug("Unregistered cancellation event for conversation: %s", conversation_id)

def cancel_active_command(conversation_id: str):
    """Signal cancellation for the active command in a conversation."""
    with _lock:
        event = _cancellation_registry.get(conversation_id)
        if event:
            event.set()
            logger.info("Signalled cancellation for conversation: %s", conversation_id)
        else:
            logger.info("No active cancellation event found for conversation: %s", conversation_id)

def is_cancelled(conversation_id: str) -> bool:
    """Check if the active command for a conversation has been cancelled."""
    with _lock:
        event = _cancellation_registry.get(conversation_id)
        if event:
            return event.is_set()
        return False
