from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import time
from .llm_agent import POOKIEAgent

@shared_task
def process_agent_command(text, conversation_id, user_id):
    channel_layer = get_channel_layer()
    room_group_name = f'chat_{conversation_id}'
    
    # Notify start
    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': 'agent_message',
            'chunk_type': 'status',
            'message': 'thinking'
        }
    )
    
    # Initialize and run agent
    agent = POOKIEAgent()
    response_text = agent.run(text)
    
    # Stream the tokens to websocket
    words = response_text.split(' ')
    for i, word in enumerate(words):
        chunk = word + (' ' if i < len(words) - 1 else '')
        async_to_sync(channel_layer.group_send)(
            room_group_name,
            {
                'type': 'agent_message',
                'chunk_type': 'text',
                'message': chunk
            }
        )
        time.sleep(0.05)
        
    # Notify end
    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': 'agent_message',
            'chunk_type': 'status',
            'message': 'done'
        }
    )
    
    return True
