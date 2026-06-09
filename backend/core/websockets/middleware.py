import jwt
from django.conf import settings
from channels.middleware import BaseMiddleware
from urllib.parse import parse_qs
from asgiref.sync import sync_to_async
from core.users.models import User

@sync_to_async
def get_user_from_token(token):
    try:
        print(f"WS Auth Token: {token[:10]}...")
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") == "access":
            user = User.objects(user_id=payload['user_id']).first()
            if user and user.is_active:
                print(f"WS Auth Success: {user.username}")
                return user
            else:
                print("WS Auth Failed: User not found or inactive")
        else:
            print("WS Auth Failed: Token not access type")
    except Exception as e:
        print(f"WS Auth Exception: {e}")
    return None

class JwtAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        token = query_params.get("token", [None])[0]
        
        scope["user"] = None
        if token:
            scope["user"] = await get_user_from_token(token)
            
        return await super().__call__(scope, receive, send)
