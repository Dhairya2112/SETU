from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Conversation
from .serializers import ConversationSerializer
from core.users.auth import PyJWTAuthentication
from rest_framework.permissions import IsAuthenticated

class ConversationListView(APIView):
    authentication_classes = [PyJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            limit = int(request.GET.get('limit', 20))
            limit = max(1, min(100, limit))
        except ValueError:
            limit = 20

        try:
            skip = int(request.GET.get('skip', 0))
            skip = max(0, skip)
        except ValueError:
            skip = 0

        platform = request.GET.get('platform', None)
        
        query = Conversation.objects(user_id=request.user.user_id)
        if platform:
            query = query.filter(platform=platform)
            
        conversations = query.order_by('-started_at').skip(skip).limit(limit)
        
        # We might not want to return all messages for the list view, just previews.
        # But for simplicity, we return the full serialized objects.
        serializer = ConversationSerializer(conversations, many=True)
        return Response({
            'count': query.count(),
            'results': serializer.data
        })

class ConversationDetailView(APIView):
    authentication_classes = [PyJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, conversation_id):
        conversation = Conversation.objects(conversation_id=conversation_id, user_id=request.user.user_id).first()
        if not conversation:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Conversation not found'}}, status=status.HTTP_404_NOT_FOUND)
            
        return Response(ConversationSerializer(conversation).data)
        
    def delete(self, request, conversation_id):
        conversation = Conversation.objects(conversation_id=conversation_id, user_id=request.user.user_id).first()
        if not conversation:
            return Response({'error': {'code': 'NOT_FOUND', 'message': 'Conversation not found'}}, status=status.HTTP_404_NOT_FOUND)
            
        conversation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
