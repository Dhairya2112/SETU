import jwt
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from django.conf import settings
from rest_framework import authentication
from rest_framework import exceptions
from .models import User, RefreshToken

def generate_tokens(user, device_info=None):
    now = datetime.now(timezone.utc)
    access_expiry = now + timedelta(minutes=15)
    refresh_expiry = now + timedelta(days=7)
    
    access_token = jwt.encode({
        'user_id': user.user_id,
        'exp': access_expiry,
        'type': 'access'
    }, settings.SECRET_KEY, algorithm='HS256')
    
    refresh_token_string = str(uuid.uuid4())
    refresh_token = jwt.encode({
        'user_id': user.user_id,
        'jti': refresh_token_string,
        'exp': refresh_expiry,
        'type': 'refresh'
    }, settings.SECRET_KEY, algorithm='HS256')
    
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    RefreshToken(
        token_hash=token_hash,
        user_id=user.user_id,
        issued_at=now,
        expires_at=refresh_expiry,
        device_info=device_info
    ).save()
    
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'expires_in': 900
    }

class PyJWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
            
        token = auth_header.split(' ')[1]
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            if payload.get('type') != 'access':
                raise exceptions.AuthenticationFailed('Invalid token type.')
                
            user = User.objects(user_id=payload['user_id']).first()
            if not user or not user.is_active:
                print(f"PyJWT Auth Failed: User not found {payload['user_id']}")
                raise exceptions.AuthenticationFailed('User not found or inactive.')
                
            # For Django REST Framework, request.user needs to have is_authenticated property
            # We mock it dynamically since we are using MongoEngine Document, not auth.User
            user.is_authenticated = True
            return (user, token)
        except jwt.ExpiredSignatureError:
            print("PyJWT Auth Failed: Token expired")
            raise exceptions.AuthenticationFailed('Token has expired.')
        except jwt.InvalidTokenError as e:
            print(f"PyJWT Auth Failed: Invalid token {e}")
            raise exceptions.AuthenticationFailed('Invalid token.')
