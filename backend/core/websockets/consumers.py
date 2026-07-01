import json
from channels.generic.websocket import AsyncWebsocketConsumer


class AgentStreamConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if not self.scope["user"]:
            await self.close(code=4001)  # Unauthorized
            return

        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.user_id = self.scope['user'].user_id

        # Ownership check: verify if conversation exists and belongs to another user
        from asgiref.sync import sync_to_async
        from core.conversations.models import Conversation

        @sync_to_async
        def verify_conversation_ownership(conversation_id, user_id):
            try:
                conv = Conversation.objects(conversation_id=conversation_id).first()
                if conv and conv.user_id != user_id:
                    return False
            except Exception:
                pass
            return True

        if not await verify_conversation_ownership(self.conversation_id, self.user_id):
            await self.close(code=4003)  # Forbidden
            return

        # Conversation-scoped group — receives agent streaming messages
        self.room_group_name = f'chat_{self.conversation_id}'
        # User-scoped group — receives reminder notifications (any session)
        self.user_group_name = f'user_{self.user_id}'

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            data = json.loads(text_data)
            command_text = data.get('text')
            if command_text:
                # ── Instant acknowledgment (Step 14.6.3) ──────────────────
                # Send immediately so the user knows Setu heard them (~200ms)
                await self.send(text_data=json.dumps({
                    'chunk_type': 'status',
                    'message': 'acknowledged'
                }))

                import asyncio
                from core.agent.tasks import process_agent_command
                asyncio.create_task(
                    asyncio.to_thread(
                        process_agent_command,
                        command_text,
                        self.conversation_id,
                        self.scope["user"].user_id
                    )
                )

    # ── Handler: agent streaming chunks (text / audio / status) ──
    async def agent_message(self, event):
        await self.send(text_data=json.dumps({
            'chunk_type': event.get('chunk_type', 'text'),
            'message': event['message']
        }))

    # ── Handler: reminder fired by Celery Beat (Step 13) ──
    async def reminder_notification(self, event):
        await self.send(text_data=json.dumps({
            'chunk_type': 'reminder',
            'reminder_id': event['reminder_id'],
            'title': event['title'],
            'body': event['body'],
        }))
