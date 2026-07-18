# pyrefly: ignore [missing-import]
from rest_framework.views import APIView
# pyrefly: ignore [missing-import]
from rest_framework.response import Response
# pyrefly: ignore [missing-import]
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

        if not text or not text.strip():
            return Response(
                {'error': {'code': 'VALIDATION_ERROR', 'message': 'text field is required and cannot be empty.'}},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not conversation_id:
            conversation_id = str(uuid.uuid4())

        from .pipeline import process_agent_command
        import threading
        task_id = str(uuid.uuid4())
        threading.Thread(
            target=process_agent_command,
            args=(text, conversation_id, request.user.user_id),
            daemon=True
        ).start()
        
        host = request.get_host()
        ws_protocol = "wss" if request.is_secure() else "ws"
        websocket_channel = f"{ws_protocol}://{host}/ws/stream/{conversation_id}/"

        return Response({
            "task_id": task_id,
            "conversation_id": conversation_id,
            "message_id": str(uuid.uuid4()),
            "status": "processing",
            "websocket_channel": websocket_channel
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

class CommandLogListView(APIView):
    authentication_classes = [PyJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import CommandLog
        logs = CommandLog.objects(user_id=request.user.user_id).order_by('-executed_at')[:50]
        serialized_logs = []
        for log in logs:
            serialized_logs.append({
                "log_id": log.log_id,
                "tool_name": log.tool_name,
                "tool_input": log.tool_input,
                "tool_output": log.tool_output,
                "status": log.status.upper(),
                "executed_at": log.executed_at.isoformat() if log.executed_at else None
            })
        return Response({"results": serialized_logs}, status=status.HTTP_200_OK)
