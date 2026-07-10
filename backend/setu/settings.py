"""
Django settings for the Setu project.

All sensitive values (SECRET_KEY, API keys, DB credentials) must be set
in backend/.env — never committed to version control.

See: https://docs.djangoproject.com/en/6.0/topics/settings/
"""

import os
import logging
from pathlib import Path
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()  # Must be first — loads backend/.env before any os.environ.get() calls

# ── Paths ─────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent


# ── Core Security ─────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-o=go3%4sss1rr$jaw9rmp11xrj)xw!&mn)1^7gl0pp9ak3%krw'
)
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,*').split(',')


# ── Installed Applications ────────────────────────────────────────────────
INSTALLED_APPS = [
    # ASGI server — must be first
    'daphne',

    # Django core
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',

    # Third-party
    'channels',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'dj_rest_auth',
    'dj_rest_auth.registration',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'allauth.socialaccount.providers.github',
    # Setu apps
    'core.users',
    'core.conversations',
    'core.tasks',
    'core.agent',
    'core.websockets',
]

SITE_ID = 1


# ── Middleware ────────────────────────────────────────────────────────────
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',        # Must be before CommonMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'setu.urls'
WSGI_APPLICATION = 'setu.wsgi.application'
ASGI_APPLICATION = 'setu.asgi.application'


# ── Templates ─────────────────────────────────────────────────────────────
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


# ── Databases ─────────────────────────────────────────────────────────────
# SQLite is used for Django's internal tables (admin, auth, sessions, sites).
# All Setu application data lives in MongoDB (via MongoEngine).
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# MongoDB — MongoEngine (application data)
import socket
import subprocess

def ensure_mongodb_running():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.5)
    is_open = sock.connect_ex(('127.0.0.1', 27017)) == 0
    sock.close()
    
    if is_open:
        return
    
    print("MongoDB is not running. Starting mongod automatically in the background...")
    import os
    from pathlib import Path
    app_data = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
    db_path = Path(app_data) / "Setu" / "mongodb_data"
    db_path.mkdir(parents=True, exist_ok=True)
    
    mongod_cmd = 'mongod'
    if os.name == 'nt':
        import glob
        possible_paths = glob.glob('C:/Program Files/MongoDB/Server/*/bin/mongod.exe')
        if possible_paths:
            mongod_cmd = possible_paths[-1] # use the latest version found
            
    try:
        subprocess.Popen(
            [mongod_cmd, '--dbpath', str(db_path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=0x08000000 if os.name == 'nt' else 0
        )
        import time
        time.sleep(2)
    except FileNotFoundError:
        print("WARNING: 'mongod' executable not found in PATH or Program Files. Please install MongoDB.")

ensure_mongodb_running()

import mongoengine
mongoengine.connect(
    db=os.environ.get('MONGODB_DB', 'setu_db'),
    host=os.environ.get('MONGODB_HOST', 'mongodb://localhost:27017/setu_db'),
    serverSelectionTimeoutMS=5000
)


# ── Authentication & Password Validation ──────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Allauth — OAuth only (local sign-up disabled via NoNewUsersAccountAdapter)
ACCOUNT_EMAIL_VERIFICATION    = 'none'
ACCOUNT_SIGNUP_FIELDS         = ['email*', 'username*', 'password1*', 'password2*']
SOCIALACCOUNT_EMAIL_VERIFICATION = 'none'
SOCIALACCOUNT_EMAIL_REQUIRED  = True
ACCOUNT_ADAPTER = 'core.users.adapters.NoNewUsersAccountAdapter'


# ── REST Framework ────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'core.users.auth.PyJWTAuthentication',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'auth': '5/minute',
    }
}

REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': 'setu-auth',
    'JWT_AUTH_REFRESH_COOKIE': 'setu-refresh-token',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}


# ── CORS ─────────────────────────────────────────────────────────────────
# DEV only — lock to explicit whitelist in Step 15.5 (Security Audit)
CORS_ALLOW_ALL_ORIGINS = True


# ── Internationalisation ──────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'UTC'
USE_I18N      = True
USE_TZ        = True


# ── Static Files ──────────────────────────────────────────────────────────
STATIC_URL = 'static/'


# ── Django Channels (WebSockets In-Memory) ────────────────────────────────
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    },
}


# ── Logging ───────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'setu': {
            'format': '[{asctime}] {levelname} {name}: {message}',
            'style': '{',
            'datefmt': '%H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'setu',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'setu': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'core': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# OAuth Credentials
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', 'dummy_google_client_id')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', 'dummy_google_client_secret')
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID', 'dummy_github_client_id')
GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET', 'dummy_github_client_secret')

