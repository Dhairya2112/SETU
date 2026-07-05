# Setu — Database Schema Document

> **AI coding agents must refer to this document when generating database models, ORMs, or queries.**
> All models use **MongoEngine** ODM. Primary key is `_id` (ObjectId). Client-facing IDs are `uuid4` strings.

---

## 1. Global Architecture

```mermaid
erDiagram
    USERS ||--o{ CONVERSATIONS : "starts"
    USERS ||--o{ COMMAND_LOGS : "generates"
    USERS ||--o{ REFRESH_TOKENS : "has"
    USERS ||--o{ REMINDERS : "owns"
    CONVERSATIONS ||--o{ MESSAGES : "contains"
```

---

## 2. Collections

### 2.1 `users`

```json
{
  "_id": "ObjectId",
  "user_id": "uuid4-string",
  "email": "string (unique)",
  "username": "string",
  "password_hash": "null (OAuth-only — never store passwords)",
  "auth_provider": "google | github",
  "oauth_provider_id": "string",
  "created_at": "ISODate",
  "last_active": "ISODate",
  "is_active": "boolean",
  "preferences": {
    "display_name": "string",
    "language": "en | hi | auto",
    "tts_voice_gender": "female | male",
    "tts_speed": "float (default 1.0)",
    "wake_word_sensitivity": "float (default 0.06)",
    "theme": "dark | light",
    "screenshot_preference": "always | ask | never",
    "trust_mode": "boolean (skip task plan confirmation)"
  },
  "permissions": {
    "level_2_granted": "boolean",
    "level_2_granted_at": "ISODate | null"
  }
}
```

Indexes: `{ "email": 1 }` unique, `{ "user_id": 1 }` unique

---

### 2.2 `conversations`

```json
{
  "_id": "ObjectId",
  "conversation_id": "uuid4-string",
  "user_id": "uuid4-string",
  "started_at": "ISODate",
  "last_updated": "ISODate",
  "platform": "windows | android",
  "source_device": "laptop | phone",
  "messages": [
    {
      "message_id": "uuid4-string",
      "role": "user | assistant",
      "content": "string",
      "timestamp": "ISODate",
      "metadata": {
        "intent_class": "OPEN_APP_LAPTOP | OPEN_APP_PHONE | SYSTEM_INFO | REPEAT_LAST | TIME_DATE | COMPLEX_TASK",
        "tool_used": "string | null",
        "llm_model": "string | null",
        "processing_time_ms": "integer",
        "input_type": "voice | text",
        "compressed": "boolean"
      }
    }
  ]
}
```

Indexes: `{ "conversation_id": 1 }` unique, `{ "user_id": 1, "started_at": -1 }` compound

---

### 2.3 `command_logs`

Audit log of every tool execution. Auto-expires after 90 days.

```json
{
  "_id": "ObjectId",
  "log_id": "uuid4-string",
  "user_id": "uuid4-string",
  "executed_at": "ISODate",
  "intent_class": "string",
  "tool_name": "string",
  "tool_parameters": "object",
  "result_success": "boolean",
  "error_message": "string | null",
  "execution_time_ms": "integer",
  "platform": "string",
  "source_device": "laptop | phone",
  "permission_level_used": "integer"
}
```

Indexes: `{ "user_id": 1, "executed_at": -1 }` compound, `{ "executed_at": 1 }` TTL 90 days

---

### 2.4 `refresh_tokens`

```json
{
  "_id": "ObjectId",
  "token_hash": "string (unique)",
  "user_id": "uuid4-string",
  "issued_at": "ISODate",
  "expires_at": "ISODate",
  "device_info": "string",
  "is_revoked": "boolean"
}
```

Indexes: `{ "token_hash": 1 }` unique, `{ "expires_at": 1 }` TTL 0s (auto-delete)

---

### 2.5 `device_pairings` 🚫 SKIP (MVP)
*Skipped for MVP. Replaced by direct PWA client WebSocket connection using standard JWT authorization.*

### 2.6 `user_memory` 🚫 SKIP (MVP)
*Skipped for MVP. Direct prompt context formatting is used instead of persistent memory storage.*

### 2.7 `contacts` 🚫 SKIP (MVP)
*Skipped for MVP.*

---

### 2.8 `reminders` ➡️ Step 13.5

Stores scheduled tasks/reminders triggered via voice or text.

```json
{
  "_id": "ObjectId",
  "reminder_id": "uuid4-string",
  "user_id": "uuid4-string",
  "title": "string",
  "body": "string",
  "trigger_at": "ISODate",
  "is_completed": "boolean",
  "created_at": "ISODate"
}
```

Indexes: `{ "user_id": 1, "trigger_at": 1 }` compound, `{ "trigger_at": 1, "is_completed": 1 }` compound

---

## 3. Index Summary

| Collection | Index | Type |
|---|---|---|
| `users` | `{ "email": 1 }` | Unique |
| `users` | `{ "user_id": 1 }` | Unique |
| `conversations` | `{ "conversation_id": 1 }` | Unique |
| `conversations` | `{ "user_id": 1, "started_at": -1 }` | Compound |
| `command_logs` | `{ "user_id": 1, "executed_at": -1 }` | Compound |
| `command_logs` | `{ "executed_at": 1 }` | TTL 90 days |
| `refresh_tokens` | `{ "token_hash": 1 }` | Unique |
| `refresh_tokens` | `{ "expires_at": 1 }` | TTL 0s |
| `device_pairings` | — | 🚫 SKIP (MVP) |
| `user_memory` | — | 🚫 SKIP (MVP) |
| `contacts` | — | 🚫 SKIP (MVP) |
| `reminders` | `{ "user_id": 1, "trigger_at": 1 }` | Compound |
| `reminders` | `{ "trigger_at": 1, "is_completed": 1 }` | Compound |
