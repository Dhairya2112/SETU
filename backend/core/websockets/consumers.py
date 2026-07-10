import json
from channels.generic.websocket import AsyncWebsocketConsumer

_stt_pipeline = None

def get_stt_pipeline():
    global _stt_pipeline
    if _stt_pipeline is None:
        from core.ai.stt import STTPipeline
        _stt_pipeline = STTPipeline()
    return _stt_pipeline


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
        
        # Signal cancellation to clear running threads/tasks on disconnect
        if hasattr(self, 'conversation_id'):
            from core.agent.cancellation import cancel_active_command
            cancel_active_command(self.conversation_id)

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            data = json.loads(text_data)
            
            # Handle user cancellation request (Step 14.1)
            if data.get('type') == 'cancel' or data.get('action') == 'cancel':
                from core.agent.cancellation import cancel_active_command
                cancel_active_command(self.conversation_id)
                # Reply immediately with cancelling status
                await self.send(text_data=json.dumps({
                    'chunk_type': 'status',
                    'message': 'cancelling'
                }))
                return

            command_text = data.get('text')
            audio_base64 = data.get('audio')

            if audio_base64:
                import os
                import base64
                import tempfile
                import numpy as np
                import soundfile as sf
                from core.ai.stt import STTPipeline

                try:
                    # Send instant acknowledgment
                    await self.send(text_data=json.dumps({
                        'chunk_type': 'status',
                        'message': 'acknowledged'
                    }))

                    # Decode base64 audio
                    audio_bytes = base64.b64decode(audio_base64)

                    # Save to temp file
                    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_file:
                        temp_file.write(audio_bytes)
                        temp_file_path = temp_file.name

                    try:
                        # Load using soundfile
                        data, samplerate = sf.read(temp_file_path)

                        # Convert to mono if stereo
                        if len(data.shape) > 1:
                            data = np.mean(data, axis=1)

                        # Resample to 16000Hz using numpy linear interpolation
                        if samplerate != 16000:
                            duration = len(data) / samplerate
                            num_samples = int(duration * 16000)
                            data = np.interp(
                                np.linspace(0, len(data), num_samples, endpoint=False),
                                np.arange(len(data)),
                                data
                            )

                        # Ensure float32 format
                        audio_float32 = data.astype(np.float32)

                        # Transcribe using pipeline
                        stt = get_stt_pipeline()
                        text_command, _, avg_logprob = stt.transcribe(audio_float32)
                        print(f"Websocket STT Transcribed: {text_command}")

                        # Confidence / length gate
                        import os
                        try:
                            min_logprob = float(os.getenv("STT_MIN_LOGPROB", "-1.50"))
                        except ValueError:
                            min_logprob = -1.50

                        is_valid = True
                        if not text_command.strip() or len(text_command.strip()) < 2:
                            is_valid = False
                        elif avg_logprob < min_logprob:
                            print(f"STT gate: Discarding low-confidence transcription '{text_command}' (avg_logprob={avg_logprob:.3f} < {min_logprob})")
                            is_valid = False

                        if not is_valid:
                            fallback_msg = "Sorry, I didn't catch that."
                            await self.send(text_data=json.dumps({
                                'chunk_type': 'status',
                                'message': 'thinking'
                            }))
                            await self.send(text_data=json.dumps({
                                'chunk_type': 'text',
                                'message': fallback_msg
                            }))
                            try:
                                from core.agent.tasks import tts_engine, _get_user_prefs
                                prefs = _get_user_prefs(self.scope["user"].user_id)
                                audio_b64 = tts_engine.generate_base64(fallback_msg, voice=prefs['voice'], speed=prefs['speed'])
                                if audio_b64:
                                    await self.send(text_data=json.dumps({
                                        'chunk_type': 'audio',
                                        'message': audio_b64
                                    }))
                            except Exception as e:
                                print(f"Error generating fallback TTS: {e}")

                            await self.send(text_data=json.dumps({
                                'chunk_type': 'status',
                                'message': 'done'
                            }))
                            # Clean up file in finally
                            return

                        if text_command.strip():
                            # Send transcribed command back to user
                            await self.send(text_data=json.dumps({
                                'chunk_type': 'text_user',
                                'message': text_command
                            }))

                            # Trigger agent command process task
                            import asyncio
                            from core.agent.tasks import process_agent_command
                            asyncio.create_task(
                                asyncio.to_thread(
                                    process_agent_command,
                                    text_command,
                                    self.conversation_id,
                                    self.scope["user"].user_id
                                )
                            )
                        else:
                            await self.send(text_data=json.dumps({
                                'chunk_type': 'status',
                                'message': 'done'
                            }))
                    finally:
                        try:
                            os.unlink(temp_file_path)
                        except Exception:
                            pass
                except Exception as e:
                    print(f"Error transcribing websocket audio: {e}")
                    await self.send(text_data=json.dumps({
                        'chunk_type': 'status',
                        'message': 'failed'
                    }))

            elif command_text:
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

    # ── Handler: reminder fired by background scheduler (Step 13) ──
    async def reminder_notification(self, event):
        await self.send(text_data=json.dumps({
            'chunk_type': 'reminder',
            'reminder_id': event['reminder_id'],
            'title': event['title'],
            'body': event['body'],
        }))
