import sys
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'setu.settings')
sys.path.append('a:\\SETU\\backend')
django.setup()

from core.agent.state import init_models
init_models()

from core.agent.pipeline import process_agent_command

class MockChannelLayer:
    def group_send(self, group, message):
        print(f"PUSH to {group}: chunk_type={message['chunk_type']}")
        if message['chunk_type'] == 'text':
            print(f"TEXT: {message['message']}")
        elif message['chunk_type'] == 'audio':
            print(f"AUDIO len: {len(message['message'])}")
            
        return

import asgiref.sync
asgiref.sync.async_to_sync = lambda f: f

from channels.layers import get_channel_layer
import core.agent.pipeline
core.agent.pipeline.get_channel_layer = lambda: MockChannelLayer()

print("Testing phase-0 'hey setu'...")
process_agent_command("hey setu", "test_conv", "local")
print("Done.")
