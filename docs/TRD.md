# POOKIE — Technical Requirements Document (TRD)

## Document Information


| Field | Details |
| --- | --- |
| Product Name | POOKIE |
| Document Type | Technical Requirements Document (TRD) |
| Version | 1.0.0 |
| Status | Draft |
| Target Platforms | Windows, Android, Linux, Web (Landing Page) |
| Out of Scope | iOS, macOS |

## Table of Contents

System Architecture Overview
Technology Stack Specifications
Component Design
Data Architecture
API Specification
WebSocket Protocol
AI Pipeline Technical Design
Security Implementation
Platform-Specific Implementation
Infrastructure & Deployment
Development Environment Setup
Testing Requirements
Performance Benchmarks
Coding Standards & Conventions
## 1. System Architecture Overview

### 1.1 High-Level Architecture Diagram


```text

┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Electron    │  │ React Native │  │  Marketing   │               │
│  │  (Win/Linux) │  │  (Android)   │  │   Website    │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                  │                      │
│         └─────────────────┼──────────────────┘                      │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ HTTPS / WSS
┌───────────────────────────┼─────────────────────────────────────────┐
│                    BACKEND LAYER                                    │
│                           │                                         │
│  ┌────────────────────────▼──────────────────────────────────────┐  │
│  │                  Django REST Framework                        │  │
│  │              (API Gateway + Request Router)                   │  │
│  └───────────┬───────────────────────────────┬───────────────────┘  │
│              │                               │                      │
│  ┌───────────▼──────────┐      ┌─────────────▼────────────────┐     │
│  │  Django Channels     │      │     Celery Task Queue        │     │
│  │  (WebSocket Server)  │      │     (Redis Broker)           │     │
│  └───────────┬──────────┘      └─────────────┬────────────────┘     │
│              │                               │                      │
│  ┌───────────▼───────────────────────────────▼────────────────────┐ │
│  │                      AI ENGINE LAYER                           │ │
│  │                                                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │ │
│  │  │  Faster-Whisper STT│  │  Intent NLP  │  │  LangChain Agent  ││ │
│  │  │  Pipeline    │  │  Classifier  │  │  + Tool Executor     │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │ │
│  │                                                                │ │
│  │  ┌──────────────┐  ┌──────────────────────────────────────┐   │ │
│  │  │  TTS Engine  │  │  LLM Backend (Groq Cloud API)          │   │ │
│  │  │  (Kokoro/     │  │                                      │   │ │
│  │  │   Piper)     │  │                                      │   │ │
│  │  └──────────────┘  └──────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    DATA LAYER                                │   │
│  │              MongoDB (Primary DB)  |  Redis (Cache)         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────────┐
│                  DEVICE LAYER (Local Process)                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Wake Word Engine (OpenWakeWord / Custom PyTorch Model)         │   │
│  │  Always-running local process — zero network calls          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Request Processing Flow


```text

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Wake Word│───▶│  Voice   │───▶│  Faster-Whisper │───▶│  Intent  │───▶│LangChain │───▶│   LLM    │
│Detection │    │ Capture  │    │   STT    │    │Classifier│    │  Agent   │    │Response  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                                      │
                                                                                      ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   User   │◀───│  Voice   │◀───│   TTS    │◀───│ Response │◀───│WebSocket │◀───│ Response │
│(Hears it)│    │ Output   │    │  Engine  │    │  Stream  │    │  Push    │    │Formatter │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

## 2. Technology Stack Specifications

### 2.1 AI / ML Engine


| Technology | Version | Purpose | Justification |
| --- | --- | --- | --- |
| Python | 3.11+ | Core runtime | Ecosystem compatibility with all AI libs |
| PyTorch | 2.12.0 | Deep learning framework | Wake word model training, NLP inference |
| Faster-Whisper | 1.2.1 | Speech-to-Text | Multilingual, high accuracy, highly optimized for low-end, runs completely offline |
| Transformers | 5.9.0 | NLP pipelines | Pre-trained models for intent classification |
| LangChain | 1.3.2 | Agent orchestration | Tool chaining, memory, reasoning framework |
| Tenacity | 9.x | API Resiliency | Exponential backoff retries for Cloud LLM calls |
| OpenWakeWord | 0.6.0 | Wake word detection | Low CPU, proven accuracy, cross-platform |
| Kokoro TTS | 0.9.4 | Text-to-Speech (primary) | Natural voice, local execution |

### 2.2 Backend


| Technology | Version | Purpose |
| --- | --- | --- |
| Django | 6.0.5 | Web framework, admin, ORM |
| Django REST Framework | 3.17.1 | RESTful API endpoints |
| Django Channels | 4.3.2 | WebSocket support |
| Celery | 5.6.3 | Async task queue |
| Redis | 8.0.0 | Celery broker + response cache |
| MongoDB | 7.x | Primary document store |
| PyMongo / Motor | 4.17.0 / 3.7.1 | MongoDB async driver |
| Daphne | 4.2.1 | ASGI server for Django Channels |

### 2.3 Frontend


| Technology | Version | Purpose |
| --- | --- | --- |
| React.js | 18.x | Desktop UI framework |
| Electron.js | 30.x | Desktop app wrapper (Win/Linux) |
| React Native | 0.74+ | Android mobile app |
| TailwindCSS | 3.4+ | Utility-first CSS styling |
| Framer Motion | 11.x | UI animations, voice visualizer |
| Socket.io Client | 4.7+ | WebSocket client for real-time |
| Zustand | 4.x | Lightweight state management |
| React Query | 5.x | Server state, caching, sync |

### 2.4 Auth & Infrastructure


| Technology | Version | Purpose |
| --- | --- | --- |
| OAuth 2.0 | RFC 6749 | Social login (Google, GitHub, Microsoft) |
| djangorestframework-simplejwt | 5.x | JWT generation and validation |
| Docker | 25.x | Containerization |
| Docker Compose | 2.x | Local multi-service orchestration |
| Firebase | Latest | Android push notifications, hosting |
| Nginx | 1.25+ | Reverse proxy, SSL termination |
| Electron Builder | 24.x | Windows .exe and Linux .AppImage packaging |
| Gradle | 8.x | Android .apk build |

## 3. Component Design

### 3.1 Wake Word Detection Component


```python

# Component: WakeWordDetector
# Location: core/wake_word/detector.py

class WakeWordDetector:
    """
    Responsibilities:
    - Run continuously as a background thread/process
    - Listen ONLY for the wake phrase 'Hey POOKIE'
    - Emit an event/signal when wake word detected
    - NO audio data is recorded or stored during idle listen
    
    Implementation:
    - Primary: OpenWakeWord
    - Fallback: Custom PyTorch model (trained on 'Hey POOKIE' samples)
    
    Constraints:
    - CPU usage MUST remain below 2% during idle listening
    - Detection sensitivity threshold explicitly tuned to 0.06 for increased responsiveness
    - Must support Windows, Android, Linux
    - Must release microphone immediately when deactivated
    """
    
    def __init__(self, sensitivity: float = 0.5):
        self.sensitivity = sensitivity
        self.is_active = False
        self._callback = None
    
    def start(self, on_detected: Callable) -> None: ...
    def stop(self) -> None: ...
    def set_sensitivity(self, value: float) -> None: ...
Technical Constraints:

OpenWakeWord requires no API keys and runs fully locally
Custom model alternative: trained using PyTorch on 1000+ positive samples of "Hey POOKIE" with negative hard mining
Must run in a separate OS process (not just a thread) to prevent GIL blocking
```

### 3.2 Speech-to-Text Pipeline


```python

# Component: STTPipeline
# Location: core/stt/pipeline.py

class STTPipeline:
    """
    Responsibilities:
    - Capture audio from microphone after wake word trigger
    - Detect end of speech using Voice Activity Detection (VAD)
    - Transcribe audio to text using Faster-Whisper
    - Output: string (e.g., "turn on the lights")

```

### 4.3 Execution Mode Configurations


The system supports two primary STT operational modes:
    - LOCAL: faster-whisper (Tiny/Base) runs on-device using minimal resources
    - CLOUD: Faster-Whisper hosted endpoint or OpenAI Whisper API for higher accuracy
    
    Audio Spec:
    - Sample Rate: 16000 Hz
    - Channels: Mono
    - Format: float32 PCM
    - VAD: Silero VAD or WebRTC VAD
    - Max recording duration: 30 seconds
    """
    
    def transcribe(self, audio_data: np.ndarray) -> TranscriptionResult: ...
    def record_until_silence(self, timeout: int = 30) -> np.ndarray: ...
Faster-Whisper Model Size Selection:


| Model | Size | Speed | Accuracy | Use Case |
| --- | --- | --- | --- | --- |
| tiny | 75MB | Very Fast | Basic | Low-end hardware |
| small.en | 400MB | Fast | Very Good | Default recommended (Optimal size vs accuracy) |
| base | 145MB | Fast | Good | Lightweight alternative |
| medium | 1.5GB | Moderate | Very Good | High-accuracy mode |
| large | 3GB | Slow | Best | Cloud/high-end only |

### 3.3 Intent Classification Component


```python

# Component: IntentClassifier
# Location: core/nlp/intent_classifier.py

class IntentClassifier:
    """
    Responsibilities:
    - Accept raw transcribed text
    - Return classified intent with confidence score and extracted entities
    
    Architecture:
    - Base Model: distilbert-base-uncased (fine-tuned)
    - Training: Custom dataset of POOKIE-specific intents
    - Inference: HuggingFace Transformers pipeline
    
    Intent Categories:
    - OPEN_APP, CLOSE_APP
    - WEB_SEARCH, OPEN_URL
    - FILE_READ, FILE_WRITE, FILE_OPEN, FILE_DELETE
    - SET_REMINDER, GET_REMINDER
    - SYSTEM_INFO
    - CLIPBOARD_READ, CLIPBOARD_WRITE
    - SCREEN_CAPTURE
    - GENERAL_QA (fallback to LLM)
    - MATH_COMPUTE
    - CODE_EXECUTE
    """
    
    def classify(self, text: str) -> IntentResult: ...
    
# IntentResult schema
@dataclass
class IntentResult:
    intent: str           # e.g., "OPEN_APP"
    confidence: float     # 0.0 - 1.0
    entities: dict        # e.g., {"app_name": "Chrome"}
    raw_text: str
```

### 3.4 LangChain Agent Component


```python

# Component: POOKIEAgent
# Location: core/agent/pookie_agent.py

class POOKIEAgent:
    """
    Responsibilities:
    - Receive IntentResult from classifier
    - Select appropriate tool(s) from tool registry
    - Execute tool with extracted parameters
    - Pass execution result to LLM for response generation
    - Stream response tokens via callback
    
    LLM Backends (configurable multi-layer resiliency):
    - Layer 1: InMemoryCache to prevent redundant API calls
    - Layer 2: Tenacity framework for exponential backoff retries (rate-limit protection)
    - Layer 3: Primary API (Groq - llama-3.1-8b-instant) with seamless cross-provider fallback to OpenRouter (meta-llama/llama-3-8b-instruct:free)
    
    Formatting Rules:
    - The LLM System Prompt must write the agent's name strictly as "Pookie" (capitalized, not all-caps) to prevent TTS engines from spelling it out as an acronym.
    
    Memory:
    - Short-term: ConversationBufferWindowMemory (last 10 turns)
    - Long-term: MongoDB stored history (loaded on session start)
    """
    
    tools: List[BaseTool] = [
        WebSearchTool(),
        FileManagerTool(),
        AppLauncherTool(),
        ReminderTool(),
        ClipboardTool(),
        BrowserControlTool(),
        SystemInfoTool(),
        MathTool(),
        CodeExecutionTool(),
        ScreenCaptureTool(),
    ]
    
    def run(self, intent: IntentResult, stream_callback: Callable) -> AgentResult: ...
```

### 3.5 Tool Specifications

Each tool MUST implement the following interface:


```python

class BasePOOKIETool(BaseTool):
    name: str
    description: str
    required_permission_level: int  # 1, 2, or 3
    
    def _run(self, **kwargs) -> ToolResult: ...
    def _validate_permissions(self) -> bool: ...
    
    # ToolResult schema
    # success: bool
    # output: str
    # data: Optional[dict]
    # error: Optional[str]
Tool Permission Mapping:

Tool	Permission Level	Platform Availability
WebSearchTool	L1	All
SystemInfoTool	L1	All
ReminderTool	L1	All
MathTool	L1	All
AppLauncherTool	L2	Win, Linux, Android
FileManagerTool	L2	Win, Linux
BrowserControlTool	L2	Win, Linux
ClipboardTool	L2	Win, Linux
ScreenCaptureTool	L2	Win, Linux
CodeExecutionTool	L2	Win, Linux
AppInstallerTool	L3	Win, Linux
ProcessManagerTool	L3	Win, Linux
```

### 3.6 TTS Engine Component


```python

# Component: TTSEngine
# Location: core/tts/engine.py

class TTSEngine:
    """
    Primary: Kokoro TTS (natural voice)
    Fallback: Piper TTS (fast offline fallback)
    
    Output:
    - Audio played through system speakers
    - Audio streamed as WAV bytes to frontend for waveform visualization
    
    Voice Config:
    - Language: English (default), multilingual support via XTTS
    - Speed: Configurable 0.5x to 2.0x
    - Voice: Selectable from preset voices
    """
    
    def speak(self, text: str) -> None: ...
    def synthesize_to_bytes(self, text: str) -> bytes: ...
    def set_voice(self, voice_id: str) -> None: ...
    def set_speed(self, speed: float) -> None: ...
```

## 4. Data Architecture

### 4.1 MongoDB Collections Schema

users Collection

```json

{
  "_id": "ObjectId",
  "user_id": "uuid4-string",
  "email": "string (indexed, unique)",
  "username": "string",
  "password_hash": "string (bcrypt, null if OAuth)",
  "auth_provider": "local | google | github | microsoft",
  "oauth_provider_id": "string | null",
  "created_at": "ISODate",
  "last_active": "ISODate",
  "is_active": "boolean",
  "preferences": {
    "llm_mode": "local | cloud",
    "llm_model": "llama3 | gpt-4o | mistral",
    "tts_voice": "string",
    "tts_speed": "float",
    "wake_word_sensitivity": "float",
    "theme": "dark | light",
    "language": "string (ISO 639-1)"
  },
  "permissions": {
    "level_2_granted": "boolean",
    "level_2_granted_at": "ISODate | null",
    "level_3_tools": ["array of tool names granted"]
  }
}
conversations Collection
JSON

{
  "_id": "ObjectId",
  "conversation_id": "uuid4-string (indexed)",
  "user_id": "uuid4-string (indexed)",
  "started_at": "ISODate",
  "last_updated": "ISODate",
  "platform": "windows | android | linux | web",
  "messages": [
    {
      "message_id": "uuid4-string",
      "role": "user | assistant",
      "content": "string",
      "timestamp": "ISODate",
      "metadata": {
        "intent": "string | null",
        "tool_used": "string | null",
        "llm_model": "string",
        "processing_time_ms": "integer",
        "input_type": "voice | text"
      }
    }
  ]
}
command_logs Collection
JSON

{
  "_id": "ObjectId",
  "log_id": "uuid4-string",
  "user_id": "uuid4-string (indexed)",
  "timestamp": "ISODate (indexed)",
  "intent": "string",
  "tool_name": "string",
  "tool_parameters": "object",
  "result_success": "boolean",
  "error_message": "string | null",
  "execution_time_ms": "integer",
  "platform": "string",
  "permission_level_used": "integer"
}
reminders Collection
JSON

{
  "_id": "ObjectId",
  "reminder_id": "uuid4-string",
  "user_id": "uuid4-string (indexed)",
  "title": "string",
  "body": "string",
  "trigger_at": "ISODate (indexed)",
  "is_recurring": "boolean",
  "recurrence_rule": "string | null (iCal RRULE format)",
  "is_completed": "boolean",
  "created_at": "ISODate",
  "platform_target": "string"
}
refresh_tokens Collection
JSON

{
  "_id": "ObjectId",
  "token_hash": "string (indexed, unique)",
  "user_id": "uuid4-string (indexed)",
  "issued_at": "ISODate",
  "expires_at": "ISODate (TTL indexed)",
  "device_info": "string",
  "is_revoked": "boolean"
}
```

### 4.2 MongoDB Indexes

JavaScript

// Performance-critical indexes
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "user_id": 1 }, { unique: true })

db.conversations.createIndex({ "user_id": 1, "started_at": -1 })
db.conversations.createIndex({ "conversation_id": 1 }, { unique: true })

db.command_logs.createIndex({ "user_id": 1, "timestamp": -1 })
db.command_logs.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 7776000 }) // 90-day TTL

db.reminders.createIndex({ "user_id": 1, "trigger_at": 1 })
db.reminders.createIndex({ "trigger_at": 1, "is_completed": 1 })

db.refresh_tokens.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 }) // Auto-expire
db.refresh_tokens.createIndex({ "token_hash": 1 }, { unique: true })
### 4.3 Redis Data Structures


```text

# Active WebSocket sessions
KEY: ws:session:{user_id}
TYPE: Hash
TTL: 24 hours
FIELDS: { connection_id, connected_at, platform }

# Response streaming buffer
KEY: stream:{conversation_id}:{message_id}
TYPE: List (LPUSH / BRPOP for streaming)
TTL: 5 minutes

# Rate limiting
KEY: ratelimit:{user_id}:{endpoint}
TYPE: String (counter)
TTL: 60 seconds

# Celery task results cache
KEY: task:{task_id}
TYPE: String (JSON)
TTL: 1 hour

# User preference cache
KEY: prefs:{user_id}
TYPE: Hash
TTL: 1 hour
```

## 5. API Specification

### 5.1 Base Configuration


```text

Base URL: https://api.pookie.app/api/v1/
Auth Header: Authorization: Bearer <access_token>
Content-Type: application/json
API Version Header: X-API-Version: 1
```

### 5.2 Authentication Endpoints

POST /auth/register/

```json

// Request
{
  "email": "user@example.com",
  "username": "devdarren",
  "password": "SecurePass123!"
}

// Response 201
{
  "user_id": "uuid",
  "email": "user@example.com",
  "access_token": "jwt...",
  "refresh_token": "jwt...",
  "token_type": "Bearer",
  "expires_in": 900
}
POST /auth/login/
JSON

// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

// Response 200
{
  "access_token": "jwt...",
  "refresh_token": "jwt...",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": { "user_id": "uuid", "email": "...", "username": "..." }
}
POST /auth/refresh/
JSON

// Request
{ "refresh_token": "jwt..." }

// Response 200
{
  "access_token": "new_jwt...",
  "refresh_token": "new_refresh_jwt...",
  "expires_in": 900
}
POST /auth/oauth/{provider}/
text

Providers: google | github | microsoft

// Request
{ "code": "oauth_authorization_code", "redirect_uri": "..." }

// Response 200 — same as login response
POST /auth/logout/
JSON

// Request (authenticated)
{ "refresh_token": "jwt..." }

// Response 204 No Content
```

### 5.3 Agent / Command Endpoints

POST /agent/command/

```json

// Request (authenticated)
{
  "input_type": "text",
  "text": "Open Chrome and search for AI news",
  "conversation_id": "uuid | null (null = new conversation)"
}

// Response 202 Accepted
{
  "task_id": "celery-task-uuid",
  "conversation_id": "uuid",
  "message_id": "uuid",
  "status": "processing",
  "websocket_channel": "ws://api.pookie.app/ws/stream/{conversation_id}/"
}
POST /agent/voice/
JSON

// Request (multipart/form-data)
// audio_file: .wav or .webm audio binary
// conversation_id: uuid (optional)

// Response 202 — same as /agent/command/
GET /agent/status/{task_id}/
JSON

// Response 200
{
  "task_id": "uuid",
  "status": "pending | processing | completed | failed",
  "result": {
    "response_text": "string",
    "tool_used": "string",
    "execution_success": "boolean"
  } // null if still processing
}
```

### 5.4 Conversation Endpoints

GET /conversations/

```json

// Query params: ?page=1&limit=20&platform=windows
// Response 200
{
  "count": 143,
  "next": "/conversations/?page=2",
  "results": [
    {
      "conversation_id": "uuid",
      "started_at": "ISO8601",
      "last_updated": "ISO8601",
      "platform": "windows",
      "message_count": 14,
      "preview": "Hey POOKIE, open Chrome..."
    }
  ]
}
GET /conversations/{conversation_id}/
JSON

// Response 200
{
  "conversation_id": "uuid",
  "started_at": "ISO8601",
  "messages": [
    {
      "message_id": "uuid",
      "role": "user | assistant",
      "content": "string",
      "timestamp": "ISO8601",
      "metadata": { "intent": "OPEN_APP", "tool_used": "AppLauncherTool" }
    }
  ]
}
DELETE /conversations/{conversation_id}/
text

// Response 204 No Content
```

### 5.5 User & Settings Endpoints

GET /user/profile/
PATCH /user/profile/

```json

// PATCH Request
{
  "username": "new_name",
  "preferences": {
    "llm_mode": "local",
    "tts_voice": "voice_id_01",
    "theme": "dark"
  }
}
// Response 200 — updated user object
GET /user/permissions/
PATCH /user/permissions/
JSON

// PATCH Request
{
  "level_2_granted": true
}
// Response 200 — updated permissions object
```

### 5.6 Reminders Endpoints

POST /reminders/
GET /reminders/
PATCH /reminders/{reminder_id}/
DELETE /reminders/{reminder_id}/
### 5.7 Error Response Schema

All errors follow this structure:


```json

{
  "error": {
    "code": "PERMISSION_DENIED | INVALID_TOKEN | NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR",
    "message": "Human readable description",
    "field": "field_name (for VALIDATION_ERROR only)",
    "request_id": "uuid (for tracing)"
  }
}
```

### 5.8 Rate Limiting


| Endpoint Group | Rate Limit |
| --- | --- |
| /auth/* | 10 requests/minute per IP |
| /agent/command/ | 60 requests/minute per user |
| /agent/voice/ | 30 requests/minute per user |
| /conversations/* | 100 requests/minute per user |
| /user/* | 30 requests/minute per user |

## 6. WebSocket Protocol

### 6.1 Connection


```text

URL: wss://api.pookie.app/ws/stream/{conversation_id}/
Protocol: WebSocket over TLS
Auth: ?token=<access_token> query param OR Authorization header
```

### 6.2 Message Schema

All WebSocket messages use JSON with this envelope:


```json

{
  "type": "message_type_string",
  "payload": { },
  "timestamp": "ISO8601"
}
```

### 6.3 Server → Client Message Types

stream.start

```json

{
  "type": "stream.start",
  "payload": {
    "message_id": "uuid",
    "conversation_id": "uuid"
  }
}
stream.token
JSON

{
  "type": "stream.token",
  "payload": {
    "message_id": "uuid",
    "token": "word or partial word from LLM",
    "index": 42
  }
}
stream.end
JSON

{
  "type": "stream.end",
  "payload": {
    "message_id": "uuid",
    "full_response": "complete assembled response text",
    "tool_used": "AppLauncherTool | null",
    "execution_success": true,
    "processing_time_ms": 1240
  }
}
agent.status
JSON

{
  "type": "agent.status",
  "payload": {
    "state": "listening | processing | tool_executing | generating | speaking",
    "detail": "Searching the web..."
  }
}
tts.audio
JSON

{
  "type": "tts.audio",
  "payload": {
    "message_id": "uuid",
    "audio_base64": "base64-encoded WAV chunk",
    "chunk_index": 0,
    "is_final": false
  }
}
error
JSON

{
  "type": "error",
  "payload": {
    "code": "ERROR_CODE",
    "message": "Human-readable error"
  }
}
```

### 6.4 Client → Server Message Types

command.text

```json

{
  "type": "command.text",
  "payload": {
    "text": "Open VS Code",
    "conversation_id": "uuid"
  }
}
command.interrupt
JSON

{
  "type": "command.interrupt",
  "payload": {
    "message_id": "uuid"
  }
}
ping
JSON

{ "type": "ping", "payload": {} }
// Server responds with { "type": "pong" }
```

## 7. AI Pipeline Technical Design

### 7.1 Wake Word Detection — Technical Spec


```text

Engine: OpenWakeWord (Primary)
Keyword File: pookie_hey-pookie_en_windows.ppn (custom trained via Picovoice Console)
Sample Rate: 16000 Hz
Frame Length: 512 samples (32ms frames)
Sensitivity: 0.5 (default, user-configurable 0.0–1.0)
CPU Target: < 2% on modern hardware

Fallback Custom Model:
  Framework: PyTorch
  Architecture: Lightweight CNN (MobileNetV3-inspired)
  Input: 1-second MFCC spectrogram (40 mel bins)
  Output: Binary (wake / not-wake)
  Training Data: 5000+ positive samples, 50000+ negative samples
  Quantization: INT8 for production deployment
```

### 7.2 STT Pipeline — Technical Spec


```text

Engine: Faster-Whisper
Default Model: faster-whisper-base (approx 150MB, heavily optimized)
Audio Format: 16-bit PCM, 16kHz, Mono
VAD (Voice Activity Detection): Silero VAD v4
Silence Threshold: 700ms of silence → end of utterance
Max Recording Duration: 30 seconds hard limit
Temperature: 0.0 (deterministic)
Initial Prompt: "Hey POOKIE" (helps Faster-Whisper filter wake word)
Language Detection: Auto-detect (or user-configured)

Processing:
```

## 1. VAD detects voice start → begin buffering audio

## 2. VAD detects 700ms silence → stop buffering

## 3. Buffer sent to Faster-Whisper transcribe()

## 4. Result cleaned (remove wake word artifacts)

## 5. Return TranscriptionResult

### 7.3 Intent Classification — Training Spec


```text

Base Model: distilbert-base-uncased
Fine-tuning Dataset: 5000 labeled examples (custom, POOKIE-specific)
  - 20 intent classes
  - ~250 examples per intent
  - Augmented with paraphrase generation
Training:
  - Epochs: 10
  - Batch Size: 32
  - Learning Rate: 2e-5 with linear decay
  - Optimizer: AdamW
  - Validation Split: 15%
  - Target Accuracy: > 92%
Inference:
  - Pipeline: text-classification
  - Max Input Length: 128 tokens
  - Latency Target: < 200ms on CPU
NER (Entity Extraction):
  - Model: spacy en_core_web_sm
  - Custom entity patterns for app names, file paths, dates/times
```

### 7.4 LLM Integration


```python

# LLM Configuration
class LLMConfig:
    # LOCAL MODE
    llm_provider = "groq"
    local_base_url = "http://localhost:11434"
    local_models = ["llama3:8b", "mistral:7b", "phi3:mini"]
    default_local_model = "llama3:8b"
    
    # CLOUD MODE
    cloud_provider = "openai"
    cloud_model = "gpt-4o"
    cloud_api_key = os.environ["OPENAI_API_KEY"]
    
    # Shared params
    temperature = 0.7
    max_tokens = 1024
    stream = True  # Always stream for real-time UX
    
    system_prompt = """
    You are POOKIE, a helpful AI assistant running on the user's device.
    You have access to system tools and can execute tasks on behalf of the user.
    Be concise, friendly, and accurate. When you execute a tool, briefly confirm what you did.
    Never perform Level 4 prohibited actions under any circumstances.
    """
```

### 7.5 LangChain Agent Configuration


```python

agent_config = {
    "agent_type": AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
    "memory": ConversationBufferWindowMemory(
        k=10,  # Last 10 conversation turns
        return_messages=True,
        memory_key="chat_history"
    ),
    "max_iterations": 5,          # Prevent infinite tool loops
    "max_execution_time": 30,     # 30 second hard timeout
    "early_stopping_method": "generate",
    "handle_parsing_errors": True,
    "verbose": True               # Set False in production
}
```

## 8. Security Implementation

### 8.1 JWT Configuration


```python

# settings.py — JWT Config
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": env("JWT_SECRET_KEY"),  # 256-bit secret from env
    "AUTH_HEADER_TYPES": ("Bearer",),
    "TOKEN_OBTAIN_SERIALIZER": "core.auth.serializers.CustomTokenObtainSerializer",
}
```

### 8.2 OAuth 2.0 Flow


```text

```

## 1. Client → GET /auth/oauth/google/?redirect_uri=...

## 2. Server → Returns Google OAuth2 authorization URL

## 3. Client → Redirects to Google auth page

## 4. Google → Redirects back to redirect_uri with ?code=...

## 5. Client → POST /auth/oauth/google/ { code, redirect_uri }

## 6. Server → Exchanges code for Google access token

## 7. Server → Fetches user profile from Google API

## 8. Server → Creates/updates POOKIE user record

## 9. Server → Issues POOKIE JWT tokens

## 10. Client → Stores tokens, user is logged in

### 8.3 Permission Enforcement


```python

# Middleware: PermissionGuard
class PermissionGuard:
    """
    Enforces permission levels before tool execution.
    Runs synchronously in the tool validation layer.
    """
    
    def check(self, tool: BasePOOKIETool, user: User) -> PermissionCheckResult:
        required = tool.required_permission_level
        
        if required == 1:
            return PermissionCheckResult(allowed=True)
        
        if required == 2:
            if not user.permissions.level_2_granted:
                return PermissionCheckResult(
                    allowed=False,
                    action_required="request_level2",
                    message="Please grant elevated permissions in settings."
                )
            return PermissionCheckResult(allowed=True)
        
        if required == 3:
            # Trigger OS-level consent prompt
            return PermissionCheckResult(
                allowed=False,
                action_required="os_prompt",
                message=f"Admin action required: {tool.description}"
            )
        
        # Level 4 — should never reach here
        raise ProhibitedActionError("This action is strictly prohibited.")
```

### 8.4 Audio Privacy Implementation


```python

class AudioPrivacyManager:
    """
    Ensures microphone is ONLY active when needed.
    """
    
    _is_recording: bool = False
    _wake_word_stream = None  # Low-level, minimal data stream
    
    def on_wake_word_detected(self):
        """Activate full microphone recording."""
        self._is_recording = True
        self._notify_ui("listening")
        # Start recording to buffer...
    
    def on_recording_complete(self):
        """Immediately stop recording and release mic."""
        self._is_recording = False
        self._notify_ui("processing")
        # Mic released — no further audio captured
    
    # Wake word engine only processes 32ms frames through
    # OpenWakeWord's local model — no audio is stored or transmitted
```

### 8.5 Input Sanitization


```python

# All tool inputs MUST be sanitized before execution
class InputSanitizer:
    
    @staticmethod
    def sanitize_file_path(path: str) -> str:
        """Prevent path traversal attacks."""
        resolved = Path(path).resolve()
        allowed_base = Path(USER_HOME_DIR).resolve()
        if not str(resolved).startswith(str(allowed_base)):
            raise SecurityError(f"Path traversal detected: {path}")
        return str(resolved)
    
    @staticmethod  
    def sanitize_shell_command(cmd: str) -> str:
        """Prevent shell injection in code execution tool."""
        blocked_patterns = ["rm -rf", "sudo", "chmod 777", "mkfs", "> /dev/"]
        for pattern in blocked_patterns:
            if pattern in cmd.lower():
                raise SecurityError(f"Blocked command pattern: {pattern}")
        return cmd
```

## 9. Platform-Specific Implementation

### 9.1 Windows — Desktop App

Electron Main Process Configuration
JavaScript

// main.js — Electron Main Process

const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron')

app.whenReady().then(() => {
  // Create system tray icon
  const tray = new Tray('assets/pookie-tray.png')
  tray.setToolTip('POOKIE — AI Agent')
  
  // Main window — hidden by default, shown on hotkey
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    frame: false,         // Frameless for custom UI
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,     // Security: context isolation ON
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true               // Security: sandbox renderer
    }
  })
  
  // Global hotkey: Ctrl+Shift+P to toggle POOKIE
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
})
Windows Background Service

```text

Service Type: Windows Task Scheduler (no admin required)
Task Name: POOKIEWakeWordService
Trigger: At log on, continue indefinitely
Action: python pookie_wake_service.py
Restart on failure: Yes (3 retries, 1 min interval)
Communication: Named pipe or local HTTP to Electron renderer
Windows Installer Spec (NSIS)
text

Installer: Electron Builder + NSIS
Output: POOKIE-Setup-1.0.0.exe
Install Dir: %LOCALAPPDATA%\POOKIE
Shortcuts: Desktop + Start Menu
UAC Level: asInvoker (no admin required for base install)
Auto-start: Registry key HKCU\Software\Microsoft\Windows\CurrentVersion\Run
Uninstaller: Full clean including registry entries and app data
```

### 9.2 Linux — Desktop App

AppImage / .deb Spec

```text

Electron Builder targets: ['AppImage', 'deb']
AppImage: Self-contained, no install required
.deb: dpkg install, creates systemd service

systemd Service Unit:
  File: ~/.config/systemd/user/pookie-wake.service
  
  [Unit]
  Description=POOKIE Wake Word Detection Service
  After=network.target

  [Service]
  Type=simple
  ExecStart=/usr/bin/python3 /opt/pookie/pookie_wake_service.py
  Restart=always
  RestartSec=5

  [Install]
  WantedBy=default.target

Elevated permissions: pkexec (polkit) for Level 3 actions
```

### 9.3 Android — React Native App

Foreground Service Implementation
Java

// POOKIEForegroundService.java
public class POOKIEForegroundService extends Service {
    
    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "pookie_service";
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("POOKIE is active")
            .setContentText("Listening for 'Hey POOKIE'")
            .setSmallIcon(R.drawable.pookie_icon)
            .setPriority(NOTIFICATION_PRIORITY_LOW)
            .build();
        
        startForeground(NOTIFICATION_ID, notification);
        
        // Start wake word detection thread
        startWakeWordDetection();
        
        return START_STICKY; // Restart if killed
    }
}
Android Manifest Permissions
XML

<!-- AndroidManifest.xml — Required Permissions -->

<!-- Level 1 — Auto granted -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Level 2 — Runtime permission request -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_CONTACTS" />

<!-- Level 3 — Accessibility Services (user must enable in settings) -->
<uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE"
    tools:ignore="ProtectedPermissions" />
Firebase Configuration

```text

Services Used:
  - Firebase Cloud Messaging (FCM) — Push notifications for reminders
  - Firebase Analytics — Usage tracking (opt-in only)
  - Firebase Crashlytics — Crash reporting
  - Firebase Hosting — Web PWA hosting

FCM Notification Types:
  - reminder.trigger — Scheduled reminder fired
  - task.completed — Long-running background task done
  - agent.response — Response ready (when app is backgrounded)
```

### 9.4 Web (Marketing & Distribution Site)

Instead of a functional PWA, the web platform serves purely as a distribution and trust-building portal.

```text
Purpose: SEO, marketing, feature explanation, permission transparency, app downloads.
Tech Stack: React (Vite) + Tailwind CSS (exported as static HTML).
Hosting: Firebase Hosting.
Features:
  - Hero section explaining POOKIE.
  - Visual breakdown of the 4-Level Permission system.
  - Download Links: 
    - Windows: Direct link to latest .exe release.
    - Linux: Direct link to .AppImage.
    - Android: Link to Google Play Store and direct .apk download.
Security: No OAuth login required for download. Hosted separately from the backend API.
```

## 10. Infrastructure & Deployment

### 10.1 Docker Architecture

YAML

# docker-compose.yml

version: '3.9'

services:

  django:
    build: ./backend
    image: pookie-backend:latest
    ports:
      - "8000:8000"
    environment:
      - DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_URL=redis://redis:6379/0
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
    depends_on:
      - redis
      - mongodb
    volumes:
      - ai_models:/app/models  # Persistent model storage
    command: daphne -b 0.0.0.0 -p 8000 pookie.asgi:application

  celery_worker:
    build: ./backend
    image: pookie-backend:latest
    command: celery -A pookie worker -l info -c 4
    environment:
      - REDIS_URL=redis://redis:6379/0
      - MONGODB_URI=${MONGODB_URI}
    depends_on:
      - redis
      - django
    volumes:
      - ai_models:/app/models

  celery_beat:
    build: ./backend
    image: pookie-backend:latest
    command: celery -A pookie beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    depends_on:
      - redis
      - django

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD}
    volumes:
      - mongo_data:/data/db

  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/certs:/etc/nginx/certs
    depends_on:
      - django

    environment:
      - REDIS_URL=redis://redis:6379/0
      - MONGO_URL=mongodb://mongo:27017
      - GROQ_API_KEY=${GROQ_API_KEY}
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]  # Optional GPU support

volumes:
  mongo_data:
  redis_data:
  ai_models:
### 10.2 Nginx Configuration

nginx

# nginx.conf

upstream django_app {
    server django:8000;
}

server {
    listen 443 ssl http2;
    server_name api.pookie.app;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # REST API
    location /api/ {
        proxy_pass http://django_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 25M;  # For voice file uploads
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://django_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;  # Long-lived WS connections
    }
}
### 10.3 Environment Variables


```bash

# .env — Backend (NEVER commit to git)

# Django
DJANGO_SECRET_KEY=your-256-bit-secret-key
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=api.pookie.app,localhost

# Database
MONGODB_URI=mongodb://user:pass@mongodb:27017/pookie_db
MONGO_USER=pookie_admin
MONGO_PASSWORD=strong_password_here

# Redis
REDIS_URL=redis://redis:6379/0

# Auth
JWT_SECRET_KEY=your-jwt-256-bit-secret
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx

# AI
OPENAI_API_KEY=sk-...
WAKE_WORD_ENGINE=openwakeword
GROQ_API_KEY=gsk_your_groq_api_key_here

# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON=/secrets/firebase-sa.json
```

## 11. Development Environment Setup

### 11.1 Backend Setup


```bash

# Prerequisites: Python 3.11+, Docker, MongoDB, Redis

# Clone repo
git clone https://github.com/yourorg/pookie.git
cd pookie/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your credentials

# Run migrations (for Django Celery Beat scheduler)
python manage.py migrate

# Start development services
docker-compose up -d redis mongodb

# Run Django dev server
daphne -b 0.0.0.0 -p 8000 pookie.asgi:application

# In a separate terminal — run Celery worker
celery -A pookie worker -l info

# In another terminal — run Celery beat
celery -A pookie beat -l info
```

### 11.2 Frontend (Electron) Setup


```bash

cd pookie/frontend

# Install dependencies
npm install

# Start React dev server
npm run dev

# Start Electron with React (dev mode)
npm run electron:dev

# Build for Windows
npm run build:win

# Build for Linux
npm run build:linux
```

### 11.3 Mobile (React Native) Setup


```bash

cd pookie/mobile

# Install dependencies
npm install

# Install pods (not needed — iOS skipped)

# Start Metro bundler
npx react-native start

# Run on Android (emulator or device)
npx react-native run-android

# Build release APK
cd android && ./gradlew assembleRelease
```

### 11.4 AI Model Setup


```bash

cd pookie/ai

# Install Faster-Whisper
pip install faster-whisper

# 3. Model Pre-download Script (setup.py or similar)
python -c "from faster_whisper import WhisperModel; WhisperModel('base')"

# Set up environment variables
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Fine-tune intent classifier (after dataset preparation)
python scripts/train_intent_classifier.py \
  --model distilbert-base-uncased \
  --data data/intent_dataset.json \
  --epochs 10 \
  --output models/intent_classifier/
```

## 12. Testing Requirements

### 12.1 Backend Tests


```python

# Test structure: backend/tests/

tests/
├── unit/
│   ├── test_wake_word_detector.py
│   ├── test_stt_pipeline.py
│   ├── test_intent_classifier.py
│   ├── test_tts_engine.py
│   ├── test_tools/
│   │   ├── test_web_search_tool.py
│   │   ├── test_file_manager_tool.py
│   │   ├── test_app_launcher_tool.py
│   │   └── ...
│   ├── test_permission_guard.py
│   └── test_input_sanitizer.py
├── integration/
│   ├── test_agent_pipeline.py       # Full STT → Intent → Tool → LLM flow
│   ├── test_auth_flow.py
│   ├── test_websocket_streaming.py
│   └── test_celery_tasks.py
├── api/
│   ├── test_auth_endpoints.py
│   ├── test_agent_endpoints.py
│   ├── test_conversation_endpoints.py
│   └── test_user_endpoints.py
└── security/
    ├── test_path_traversal.py
    ├── test_jwt_validation.py
    ├── test_rate_limiting.py
    └── test_permission_levels.py
Test Coverage Target: > 80%

Bash

# Run all tests
pytest --cov=. --cov-report=html -v

# Run specific suite
pytest tests/security/ -v

# Run with coverage enforcement
pytest --cov=. --cov-fail-under=80
```

### 12.2 Frontend Tests

JavaScript

// Test stack: Jest + React Testing Library + Playwright

// Unit tests: Component rendering, state management
// Integration tests: API mocking, WS event handling
// E2E tests: Playwright — full user flows

// Run tests
npm run test              // Jest unit + integration
npm run test:e2e          // Playwright end-to-end
npm run test:coverage     // With coverage report
### 12.3 AI Model Tests


```python

# Intent Classifier Accuracy Test
def test_intent_classifier_accuracy():
    classifier = IntentClassifier.load("models/intent_classifier/")
    test_dataset = load_json("data/intent_test_set.json")
    
    correct = 0
    for sample in test_dataset:
        result = classifier.classify(sample["text"])
        if result.intent == sample["expected_intent"]:
            correct += 1
    
    accuracy = correct / len(test_dataset)
    assert accuracy >= 0.90, f"Accuracy {accuracy:.2%} below 90% threshold"

# Wake Word False Positive Test
def test_wake_word_false_positive_rate():
    detector = WakeWordDetector()
    negative_audio_samples = load_negative_audio_dataset()  # 1 hour audio
    
    false_positives = 0
    for chunk in negative_audio_samples:
        if detector.process_frame(chunk):
            false_positives += 1
    
    # Max 1 false positive per simulated hour
    assert false_positives <= 1, f"Too many false positives: {false_positives}"
```

### 12.4 Performance Tests


```python

# Load test with Locust
# locustfile.py

from locust import HttpUser, task, between

class POOKIEUser(HttpUser):
    wait_time = between(1, 5)
    
    def on_start(self):
        self.token = self.get_auth_token()
    
    @task(3)
    def send_text_command(self):
        self.client.post("/api/v1/agent/command/", 
            json={"input_type": "text", "text": "What time is it?"},
            headers={"Authorization": f"Bearer {self.token}"}
        )
    
    @task(1)
    def get_conversations(self):
        self.client.get("/api/v1/conversations/",
            headers={"Authorization": f"Bearer {self.token}"}
        )

# Run: locust -f locustfile.py --users 100 --spawn-rate 10
```

## 13. Performance Benchmarks

### 13.1 Target Benchmarks


| Component | Metric | Target | Measurement |
| --- | --- | --- | --- |
| Wake Word Detection | Latency | < 500ms | Time from utterance end to event emit |
| Wake Word Detection | CPU Usage (idle) | < 2% | psutil monitoring during 1hr idle |
| Faster-Whisper STT (base, local) | Transcription time (5s audio) | < 1s | Average over 100 samples |
| Intent Classifier | Inference latency | < 200ms | Average on CPU |
| LLM First Token (local) | Time to first streamed token | < 3s | llama3:8b on 8GB RAM |
| LLM First Token (cloud) | Time to first streamed token | < 1.5s | GPT-4o API |
| API Response (non-AI) | P95 latency | < 200ms | Load test |
| WebSocket Connection | Time to establish | < 300ms | Client measurement |
| TTS Synthesis (Piper)   | 100-word text to audio | < 500ms | Average over 50 samples |
| TTS Synthesis (Kokoro) | 100-word text to audio | < 2s | Average over 50 samples |
| App Startup (Electron) | Cold start to interactive | < 4s | Electron performance API |
| App Startup (Android) | Cold start to interactive | < 3s | Android systrace |

### 13.2 Minimum Hardware Requirements


| Platform | CPU | RAM | Storage | GPU |
| --- | --- | --- | --- | --- |
| Windows (local LLM) | Intel i5 8th gen / AMD Ryzen 5 | 16GB | 10GB free | Optional (CUDA) |
| Windows (cloud mode) | Intel i3 / AMD Ryzen 3 | 8GB | 2GB free | Not required |
| Linux (local LLM) | Same as Windows | 16GB | 10GB free | Optional |
| Linux (cloud mode) | Same as Windows | 8GB | 2GB free | Not required |
| Android | Snapdragon 660 / Equivalent | 4GB | 500MB free | Not required |
| Web PWA | Any modern browser | N/A | N/A | Not required |

## 14. Coding Standards & Conventions

### 14.1 Python (Backend / AI)


```python

# Style: PEP 8 + Black formatter
# Linting: Flake8 + Pylint
# Type hints: Required on all function signatures
# Docstrings: Google-style docstrings

# Example — compliant code
from typing import Optional
from dataclasses import dataclass


@dataclass
class TranscriptionResult:
    """Result from the STT pipeline.
    
    Attributes:
        text: The transcribed text from audio input.
        language: Detected language ISO code.
        confidence: Confidence score between 0.0 and 1.0.
        duration_ms: Audio duration in milliseconds.
    """
    text: str
    language: str
    confidence: float
    duration_ms: int


def transcribe_audio(
    audio_data: np.ndarray,
    model_size: str = "base",
    language: Optional[str] = None,
) -> TranscriptionResult:
    """Transcribe audio data to text using Faster-Whisper.
    
    Args:
        audio_data: Raw audio as float32 numpy array at 16kHz.
        model_size: Faster-Whisper model size identifier.
        language: ISO language code, or None for auto-detect.
        
    Returns:
        TranscriptionResult with text and metadata.
        
    Raises:
        STTError: If transcription fails.
    """
    ...
Bash

# Formatting commands
black backend/
flake8 backend/ --max-line-length=100
mypy backend/ --strict
```

### 14.2 JavaScript / TypeScript (Frontend)


```typescript

// Style: ESLint (Airbnb config) + Prettier
// Type system: TypeScript strict mode
// Component style: Functional components + hooks only
// File naming: PascalCase for components, camelCase for utilities

// Example — compliant component
interface ConversationMessageProps {
  messageId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

const ConversationMessage: React.FC<ConversationMessageProps> = ({
  messageId,
  role,
  content,
  timestamp,
  isStreaming = false,
}) => {
  return (
    <div className={`message message--${role}`} data-id={messageId}>
      <span className="message__content">{content}</span>
      {isStreaming && <span className="message__cursor" aria-label="streaming" />}
      <time className="message__timestamp">{timestamp}</time>
    </div>
  )
}

export default ConversationMessage
Bash

# Formatting commands
npx prettier --write frontend/src/
npx eslint frontend/src/ --fix
npx tsc --noEmit  # Type check without emitting
```

### 14.3 Git Conventions


```text

Branch Naming:
  feature/wake-word-detector
  fix/stt-timeout-bug
  chore/update-dependencies
  docs/api-documentation

Commit Message Format (Conventional Commits):
  feat(stt): add silero VAD for end-of-speech detection
  fix(auth): resolve JWT refresh token rotation edge case
  chore(deps): upgrade LangChain to 0.2.5
  docs(api): add WebSocket protocol documentation
  test(tools): add unit tests for FileManagerTool
  perf(wake): reduce idle CPU usage from 3% to 1.5%
  security(auth): enforce HTTPS-only cookie for refresh token

PR Requirements:
  - All tests passing (CI enforced)
  - Code coverage must not decrease
  - At least 1 reviewer approval
  - No merge conflicts
  - Linked to issue/ticket
```

### 14.4 Folder Structure


```text

pookie/
├── backend/
│   ├── pookie/               # Django project root
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   └── production.py
│   │   ├── urls.py
│   │   └── asgi.py
│   ├── core/                 # Main Django app
│   │   ├── agent/            # LangChain agent + tools
│   │   ├── ai/               # STT, TTS, intent classifier
│   │   ├── auth/             # JWT, OAuth views/serializers
│   │   ├── conversations/    # Conversation CRUD
│   │   ├── tasks/            # Celery task definitions
│   │   ├── users/            # User model, preferences
│   │   ├── wake_word/        # Wake word detection module
│   │   └── websockets/       # Django Channels consumers
│   ├── tests/                # All test files
│   ├── requirements.txt
│   ├── Dockerfile
│   └── manage.py
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Route-level page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── store/            # Zustand state stores
│   │   ├── services/         # API client, WebSocket client
│   │   ├── types/            # TypeScript interfaces
│   │   └── utils/            # Utility functions
│   ├── electron/
│   │   ├── main.js           # Electron main process
│   │   └── preload.js        # Electron preload script
│   ├── package.json
│   └── electron-builder.yml
│
├── mobile/
│   ├── android/              # Android native code
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── services/
│   │   └── navigation/
│   └── package.json
│
├── ai/
│   ├── models/               # Trained model files (gitignored)
│   ├── data/                 # Training datasets
│   ├── scripts/              # Training scripts
│   └── notebooks/            # Jupyter exploration notebooks
│
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── README.md
```