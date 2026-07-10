from django.test import SimpleTestCase
from core.agent.cancellation import (
    register_cancellation,
    unregister_cancellation,
    cancel_active_command,
    is_cancelled
)

class CancellationTestCase(SimpleTestCase):
    def test_cancellation_flow(self):
        conv_id = "test-conv-123"
        
        # Initially, it shouldn't be cancelled
        self.assertFalse(is_cancelled(conv_id))
        
        # Registering should create the event, set to false
        event = register_cancellation(conv_id)
        self.assertFalse(event.is_set())
        self.assertFalse(is_cancelled(conv_id))
        
        # Cancelling should set the event and return true for is_cancelled
        cancel_active_command(conv_id)
        self.assertTrue(event.is_set())
        self.assertTrue(is_cancelled(conv_id))
        
        # Unregistering should clear it from the registry
        unregister_cancellation(conv_id)
        self.assertFalse(is_cancelled(conv_id))
