# Setu — Environment Setup Guide

> Brand name used in UI/voice: **Setu**.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11+ | Use pyenv for version management |
| Node.js | 18+ LTS | Use nvm for version management |
| MongoDB | 7.x | Run locally |
| Redis | 7+ | Run locally |
| Git | Any | — |

---

## 1. Clone & Directory Structure

```bash
git clone https://github.com/yourorg/setu.git
cd setu
```

```
setu/
├── backend/          # Django backend
├── frontend/         # React + Vite laptop dashboard
├── mobile/           # React Native phone app (Step 24)
├── ai/               # Wake word + intent classifier training (Steps 15, 26)
├── docs/             # All documentation
└── nginx/            # Nginx config (production)
```

---

## 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux)
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt

# Install Playwright browsers (Step 18)
playwright install chromium
```

### Environment Variables

Create `backend/.env` (never commit):

```env
# Django Core
DJANGO_SECRET_KEY=your-256-bit-secret-key-here
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# MongoDB
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DB=setu_db

# Redis
REDIS_URL=redis://127.0.0.1:6379/0

# JWT
JWT_SECRET_KEY=your-jwt-256-bit-secret-here
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# LLM APIs — all required for agent to work
NVIDIA_API_KEY=your_nvidia_nim_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
GEMINI_API_KEY=your_gemini_api_key

# OAuth — required from Step 13 onward
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### Get Free API Keys

| Service | URL | Role |
|---|---|---|
| NVIDIA NIM | https://build.nvidia.com | Primary LLM — free tier |
| OpenRouter | https://openrouter.ai | Secondary LLM — free models |
| Google Gemini | https://aistudio.google.com | Tertiary LLM — free tier |
| Google Cloud Console | https://console.cloud.google.com | OAuth — free |
| GitHub Developer Settings | https://github.com/settings/developers | OAuth — free |

### Run Django Migrations

```bash
cd backend

python manage.py migrate

# Verify MongoDB connection
python manage.py shell -c "from mongoengine import connect; print('MongoDB OK')"
```

---

## 3. Frontend Setup

```bash
cd frontend
npm install
```

### Environment Variables

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

---

## 4. Mobile Setup (Step 24)

```bash
cd mobile
npx react-native init SetuMobile --template react-native-template-typescript
npm install @react-native-community/voice react-native-zeroconf
```

---

## 5. Required Services

MongoDB and Redis must be running before starting any backend services.

### Option A — Native (Windows)

```powershell
# MongoDB
mongod --dbpath C:\data\db

# Redis (use WSL or Redis for Windows)
redis-server
```

### Option B — Docker (Recommended for dev)

```bash
docker-compose -f docker-compose.dev.yml up -d mongodb redis
```

`docker-compose.dev.yml`:
```yaml
version: '3.9'
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_dev_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_dev_data:/data

volumes:
  mongo_dev_data:
  redis_dev_data:
```

---

## 6. Running the Full Stack

Open **4 separate terminals:**

### Terminal 1 — Django ASGI Server

```bash
cd backend
venv\Scripts\activate        # Windows
daphne -b 0.0.0.0 -p 8000 setu.asgi:application
```

> Use `-b 0.0.0.0` so the phone app can connect over LAN.

### Terminal 2 — Celery Worker

```bash
cd backend
venv\Scripts\activate
celery -A setu worker --loglevel=info --pool=solo  # Windows must use solo pool
```

### Terminal 3 — React Frontend (Laptop Dashboard)

```bash
cd frontend
npm run dev
# Opens: http://localhost:5173
```

### Terminal 4 (optional) — Local Voice Loop

```bash
cd backend
venv\Scripts\activate
python listener.py
# Say "Hey Setu" to activate (uses hey_jarvis proxy model until Step 26)
```

### Terminal 5 — Landing Website (Static Preview)

```bash
# Start a simple static server to preview the landing page
python -m http.server 8080 --directory landing
# Opens: http://localhost:8080
```

---

## 7. AI Model Pre-Download

First run downloads models automatically. To pre-download:

```bash
cd backend && venv\Scripts\activate

# Faster-Whisper — multilingual (~244MB)
python -c "from faster_whisper import WhisperModel; WhisperModel('small')"

# OpenWakeWord proxy model
python -c "import openwakeword; openwakeword.utils.download_models()"

# Kokoro TTS — English
python -c "from kokoro import KPipeline; KPipeline(lang_code='a')"

# Kokoro TTS — Hindi (Step 14)
python -c "from kokoro import KPipeline; KPipeline(lang_code='h')"

# sentence-transformers for semantic cache (Step 16)
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
```

---

## 8. Required Python Packages (key additions for Setu MVP)

Add to `requirements.txt` as you implement each step:

```txt
# Step 13 — OAuth
google-auth>=2.0.0
PyGithub>=2.0.0

# Step 14 — Multilingual STT (model change, no new package)
# Change: WhisperModel('small.en') → WhisperModel('small')

# Step 15 — Intent Classifier
onnxruntime>=1.16.0
transformers>=4.35.0

# Step 16 — Semantic Cache
sentence-transformers>=2.2.2

# Step 17 — Cross-Device Protocol
zeroconf>=0.131.0
cryptography>=41.0.0

# Step 18 — Browser Automation
playwright>=1.40.0

# Step 19 — Desktop Automation
pywinauto>=0.6.8

# Step 21 — Screenshots
mss>=9.0.1

# Step 22 — Natural Language Date Parsing (contacts)
dateparser>=1.2.0
```

---

## 9. Verify Everything is Working

```bash
# 1. Check Django is up
curl http://localhost:8000/api/v1/auth/login/ -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'
# Expected: 401 Unauthorized

# 2. Check WebSocket
# Open browser → http://localhost:5173 → should see "WebSocket connected" in console

# 3. Check Celery
# Django terminal should show worker registration messages

# 4. Check MongoDB
mongosh
use setu_db
db.users.find()

# 5. Check Redis
redis-cli ping
# Expected: PONG
```

---

## 10. Common Issues & Fixes

| Issue | Cause | Fix |
|---|---|---|
| `MongoEngine connection error` | MongoDB not running | Start `mongod` first |
| `Redis connection refused` | Redis not running | Start `redis-server` first |
| `Celery task not executing` | Worker not started | Start Celery worker in separate terminal |
| `WebSocket 4001 Unauthorized` | JWT token expired | Re-login to get fresh token |
| `TTS no audio output` | No audio device | `pip install sounddevice` + check drivers |
| `Wake word not detecting` | Low mic sensitivity | Lower threshold in `detector.py` to `0.04` |
| `LLM API timeout` | NVIDIA NIM rate limit | Wait 1 min — Tenacity retries automatically |
| `CORS error in browser` | Frontend port mismatch | Verify `VITE_API_BASE_URL` matches Django port |
| `Phone cannot connect` | Daphne bound to 127.0.0.1 | Use `-b 0.0.0.0` in daphne command |
| `Playwright browser not found` | Not installed | Run `playwright install chromium` |
| `mDNS not discovering laptop` | Firewall blocking port 8008 | Allow port 8008 in Windows Firewall |

---

## 11. Production Checklist (Post-MVP)

- Set `DJANGO_DEBUG=False`
- Replace `CORS_ALLOW_ALL_ORIGINS = True` with explicit whitelist (`localhost:5173`)
- Set strong `DJANGO_SECRET_KEY` and `JWT_SECRET_KEY`
- Enable HTTPS/WSS via Nginx reverse proxy (for cross-device to use WSS)
- Set MongoDB authentication credentials
- Lock `DJANGO_ALLOWED_HOSTS` to specific domains
