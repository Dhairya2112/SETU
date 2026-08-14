import os
import sys
import django
sys.path.append(r'a:\SETU\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'setu.settings')
django.setup()

from core.users.models import User
from core.users.auth import generate_tokens
import requests

user = User.objects.first()
if user:
    tokens = generate_tokens(user)
    access_token = tokens['access_token']
    headers = {'Authorization': f'Bearer {access_token}'}
    res = requests.get('http://127.0.0.1:8000/api/v1/user/mobile-pairing/', headers=headers)
    print("STATUS:", res.status_code)
    print("RESPONSE:", res.text)
else:
    print("No users found.")
