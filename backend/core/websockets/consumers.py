import json
from channels.generic.websocket import AsyncWebsocketConsumer

class AgentStreamConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if not self.scope["user"]:
            await self.close(code=4001) # Unauthorized
            return
            
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            data = json.loads(text_data)
            command_text = data.get('text')
            if command_text:
                from asgiref.sync import sync_to_async
                from core.agent.tasks import process_agent_command
                await sync_to_async(process_agent_command.delay)(
                    command_text, 
                    self.conversation_id, 
                    self.scope["user"].user_id
                )

    # Receive message from room group
    async def agent_message(self, event):
        message = event['message']
        chunk_type = event.get('chunk_type', 'text')

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'chunk_type': chunk_type,
            'message': message
        }))
