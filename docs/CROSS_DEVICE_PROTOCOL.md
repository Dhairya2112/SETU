# Setu — Simplified Cross-Device Communication Protocol

This document defines the simplified cross-device protocol for connecting phone clients to the laptop server for remote command execution under the Setu MVP.

---

## 1. Protocol Architecture & Topology

Setu replaces the complex custom mDNS/ECDH pairing mechanism with a lightweight, browser-standard Progressive Web App (PWA) client connecting directly to the Django Daphne server.

- **Target Device (Laptop):** Acts as the standard HTTP/WS/WSS server. It runs Daphne on the local network (bound to `0.0.0.0:8000`).
- **Phone (PWA Client):** Runs in the mobile browser by navigating directly to the laptop's LAN IP (e.g., `http://192.168.1.50:5173`). Authentication is performed using the user's existing OAuth/JWT credentials.

```
┌─────────────────────────┐                      ┌─────────────────────────┐
│       Phone (PWA)       │                      │    Laptop (Server)      │
└────────────┬────────────┘                      └────────────┬────────────┘
             │                                                │
             │ 1. Open mobile browser to Laptop LAN IP        │
             ├───────────────────────────────────────────────>│ [Daphne serves HTTP/WebSockets]
             │                                                │
             │ 2. Authenticate (Google/GitHub or local JWT)   │
             ├───────────────────────────────────────────────>│ [Verifies credentials & returns JWT]
             │                                                │
             │ 3. WebSocket Upgrade (ws://laptop_ip:8000/)    │
             ├───────────────────────────────────────────────>│ [JwtAuthMiddleware validates JWT]
             │                                                │
             │ 4. Send Command / Live Voice (base64 audio)    │
             ├───────────────────────────────────────────────>│ [Processes command via LangGraph agent]
             │                                                │
             │ 5. Stream Real-time Output & TTS Chunks        │
             │<───────────────────────────────────────────────┤ [Streams logs + audio back to PWA]
             │                                                │
```

---

## 2. Zero-Configuration Local Connection

To connect the phone to the laptop:
1. The user checks the laptop's current local IP address (displayed on the dashboard, e.g., `192.168.1.50`).
2. The user enters this IP address on their mobile browser to load the dashboard PWA.
3. Once loaded, the app can be installed to the phone's home screen as a Progressive Web App (PWA).

---

## 3. Authentication & Security

Rather than inventing a new custom pairing protocol, Setu leverages standard web application security:

- **JWT Authentication:** The PWA connects to the WebSocket stream at:
  `ws://<laptop_ip>:8000/ws/stream/<conversation_id>/?token=<jwt_access_token>`
- **Subnet Verification:** The server verifies that the WebSocket request originates from the local subnet:
  ```python
  client_ip = scope['client'][0]
  # Ensure the connection is from local subnet (e.g., starts with 192.168. or 10.)
  ```
- **SSL/TLS (Optional / Staging):** When running in production/staging mode, Daphne is reverse-proxied behind Nginx supporting self-signed certificates or local CA certs to enable HTTPS and secure WebSockets (`wss://`).

---

## 4. Message Schema (JSON)

Communications use JSON frames sent over standard WebSockets.

### Input Command Frame (PWA → Laptop)
```json
{
  "text": "Open Chrome and go to YouTube",
  "conversation_id": "conv_67890"
}
```

### Input Audio Frame (PWA → Laptop for voice loop)
```json
{
  "audio": "<Base64 encoded Web Audio API PCM/WAV chunk>",
  "conversation_id": "conv_67890"
}
```

### Server Stream Frame (Laptop → PWA)
```json
{
  "role": "agent",
  "text": "Opening browser...",
  "chunk_type": "text",
  "audio": "<Base64 encoded Kokoro TTS audio chunk>",
  "status": "thinking"
}
```

---

## 5. Security & Prevention Measures

### Command Execution Sandboxing
* Remote commands are subjected to the exact same safety engine in `safety.py` (checking the command blacklist and locking down path access to the home directory).
* Any L3 actions (installing software, editing system files) will raise a native UAC prompt on the laptop screen, requiring manual confirmation.

### Network Isolation
* Django Daphne binds to `0.0.0.0` for local LAN communication.
* External public-internet access is blocked; Setu does not implement cloud relay endpoints.

---

## 6. Connection Lifecycle State Machine

```
     ┌──────────────┐
     │  DISCONNECTED│
     └──────┬───────┘
            │
            │  Open browser to LAN IP
            ▼
     ┌──────────────┐
     │  CONNECTED   │
     └──────┬───────┘
            │
            │  JWT Validation Success
            ▼
     ┌──────────────┐
     │  AUTHORIZED  │ (WebSocket active)
     └──────┬───────┘
            │
            │  PWA closes / browser backgrounded
            ▼
     ┌──────────────┐
     │  DISCONNECTED│
     └──────────────┘
```
