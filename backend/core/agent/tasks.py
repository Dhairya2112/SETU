from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .llm_agent import POOKIEAgent
from core.ai.tts import TTSEngine
from core.conversations.models import Conversation, Message, MessageMetadata
from datetime import datetime, timezone

# Initialize Agent and TTS globally so they load once per Celery worker process
agent_instance = POOKIEAgent()
tts_engine = TTSEngine()

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
    
    # Run globally initialized agent instance
    response_text = agent_instance.run(text)
    
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
        
    # Generate Audio and send it
    try:
        audio_b64 = tts_engine.generate_base64(response_text)
        if audio_b64:
            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'agent_message',
                    'chunk_type': 'audio',
                    'message': audio_b64
                }
            )
    except Exception as e:
        print(f"TTS Error: {e}")

    # Save conversation messages to MongoDB
    try:
        conv = Conversation.objects(conversation_id=conversation_id).first()
        if not conv:
            conv = Conversation(conversation_id=conversation_id, user_id=user_id)
        
        user_msg = Message(
            role='user',
            content=text,
            metadata=MessageMetadata(input_type='text', llm_model='deepseek-ai/deepseek-v4-flash')
        )
        agent_msg = Message(
            role='assistant',
            content=response_text,
            metadata=MessageMetadata(input_type='text', llm_model='deepseek-ai/deepseek-v4-flash')
        )
        
        conv.messages.append(user_msg)
        conv.messages.append(agent_msg)
        conv.last_updated = datetime.now(timezone.utc)
        conv.save()
    except Exception as e:
        print(f"Conversation Save Error: {e}")
        
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
