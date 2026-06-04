from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import uuid
from core.users.auth import PyJWTAuthentication
from rest_framework.permissions import IsAuthenticated

class CommandView(APIView):
    authentication_classes = [PyJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        text = request.data.get('text')
        conversation_id = request.data.get('conversation_id')
        
        if not conversation_id:
            conversation_id = str(uuid.uuid4())
            
        from .tasks import process_agent_command
        task = process_agent_command.delay(text, conversation_id, request.user.user_id)
        
        return Response({
            "task_id": task.id,
            "conversation_id": conversation_id,
            "message_id": str(uuid.uuid4()),
            "status": "processing",
            "websocket_channel": f"ws://api.pookie.app/ws/stream/{conversation_id}/"
        }, status=status.HTTP_202_ACCEPTED)

class StatusView(APIView):
    authentication_classes = [PyJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, task_id):
        # MOCK RESPONSE
        return Response({
            "task_id": task_id,
            "status": "pending",
            "result": None
        })
