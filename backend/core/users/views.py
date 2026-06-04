from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import bcrypt
import jwt
import hashlib
from datetime import datetime, timezone
from django.conf import settings

from .models import User, RefreshToken
from .serializers import (
    RegisterSerializer, LoginSerializer, RefreshSerializer,
    UserSerializer, UserPreferencesSerializer, UserPermissionsSerializer
)
from .auth import generate_tokens, PyJWTAuthentication
from rest_framework.permissions import IsAuthenticated

class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            if User.objects(email=email).first():
                return Response({'error': {'code': 'VALIDATION_ERROR', 'message': 'Email already exists'}}, status=status.HTTP_400_BAD_REQUEST)
                
            password = serializer.validated_data['password'].encode('utf-8')
            password_hash = bcrypt.hashpw(password, bcrypt.gensalt()).decode('utf-8')
            user = User(
                email=email,
                username=serializer.validated_data['username'],
                password_hash=password_hash,
                auth_provider='local'
            ).save()
            
            tokens = generate_tokens(user, request.META.get('HTTP_USER_AGENT'))
            
            return Response({
                'user_id': user.user_id,
                'email': user.email,
                'access_token': tokens['access_token'],
                'refresh_token': tokens['refresh_token'],
                'token_type': 'Bearer',
                'expires_in': tokens['expires_in']
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = User.objects(email=serializer.validated_data['email']).first()
            if not user or not user.password_hash:
                return Response({'error': {'code': 'PERMISSION_DENIED', 'message': 'Invalid credentials'}}, status=status.HTTP_401_UNAUTHORIZED)
                
            password = serializer.validated_data['password'].encode('utf-8')
            if not bcrypt.checkpw(password, user.password_hash.encode('utf-8')):
                return Response({'error': {'code': 'PERMISSION_DENIED', 'message': 'Invalid credentials'}}, status=status.HTTP_401_UNAUTHORIZED)
                
            user.last_active = datetime.now(timezone.utc)
            user.save()
            
            tokens = generate_tokens(user, request.META.get('HTTP_USER_AGENT'))
            
            return Response({
                'access_token': tokens['access_token'],
                'refresh_token': tokens['refresh_token'],
                'token_type': 'Bearer',
                'expires_in': tokens['expires_in'],
                'user': UserSerializer(user).data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RefreshView(APIView):
    def post(self, request):
        serializer = RefreshSerializer(data=request.data)
        if serializer.is_valid():
            token_string = serializer.validated_data['refresh_token']
            
            try:
                payload = jwt.decode(token_string, settings.SECRET_KEY, algorithms=['HS256'])
                if payload.get('type') != 'refresh':
                    return Response({'error': {'code': 'INVALID_TOKEN', 'message': 'Invalid token type'}}, status=status.HTTP_401_UNAUTHORIZED)
                    
                token_hash = hashlib.sha256(token_string.encode()).hexdigest()
                rt = RefreshToken.objects(token_hash=token_hash, is_revoked=False).first()
                if not rt:
                    return Response({'error': {'code': 'INVALID_TOKEN', 'message': 'Token has been revoked or does not exist'}}, status=status.HTTP_401_UNAUTHORIZED)
                    
                user = User.objects(user_id=payload['user_id']).first()
                if not user or not user.is_active:
                    return Response({'error': {'code': 'INVALID_TOKEN', 'message': 'User not found'}}, status=status.HTTP_401_UNAUTHORIZED)
                    
                # Revoke old token
                rt.is_revoked = True
                rt.save()
                
                # Issue new tokens
                tokens = generate_tokens(user, request.META.get('HTTP_USER_AGENT'))
                
                return Response({
                    'access_token': tokens['access_token'],
                    'refresh_token': tokens['refresh_token'],
                    'expires_in': tokens['expires_in']
                })
                
            except jwt.ExpiredSignatureError:
                return Response({'error': {'code': 'INVALID_TOKEN', 'message': 'Refresh token expired'}}, status=status.HTTP_401_UNAUTHORIZED)
            except jwt.InvalidTokenError:
                return Response({'error': {'code': 'INVALID_TOKEN', 'message': 'Invalid token'}}, status=status.HTTP_401_UNAUTHORIZED)
                
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(APIView):
    authentication_classes = [PyJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        return Response(UserSerializer(request.user).data)
        
    def patch(self, request):
        # We allow updating username and preferences
        user = request.user
        if 'username' in request.data:
            user.username = request.data['username']
            
        if 'preferences' in request.data:
            pref_serializer = UserPreferencesSerializer(data=request.data['preferences'])
            if pref_serializer.is_valid():
                for k, v in pref_serializer.validated_data.items():
                    setattr(user.preferences, k, v)
            else:
                return Response(pref_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        user.save()
        return Response(UserSerializer(user).data)

class UserPermissionsView(APIView):
    authentication_classes = [PyJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        return Response(UserPermissionsSerializer(request.user.permissions).data)
        
    def patch(self, request):
        perm_serializer = UserPermissionsSerializer(data=request.data)
        if perm_serializer.is_valid():
            user = request.user
            for k, v in perm_serializer.validated_data.items():
                setattr(user.permissions, k, v)
                if k == 'level_2_granted' and v is True:
                    user.permissions.level_2_granted_at = datetime.now(timezone.utc)
            user.save()
            return Response(UserPermissionsSerializer(user.permissions).data)
        return Response(perm_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
