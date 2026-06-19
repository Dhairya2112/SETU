# Setu — Cross-Device Communication Protocol

This document defines the peer-to-peer (P2P) protocol for discovery, pairing, authentication, and execution of remote commands between Setu instances (e.g., Android Phone to Windows/Linux Laptop).

---

## 1. Protocol Architecture & Topology

The cross-device protocol operates over the local area network (LAN) using a hybrid client-server model:

-   **Target Device (typically Laptop):** Acts as the **mDNS Responder** and **HTTPS/WSS Server**. It advertises its availability and listens for secure inbound connections.
-   **Initiator Device (typically Phone):** Acts as the **mDNS Scanner** and **Client**. It scans the local network, discovers Target Devices, and initiates pairing/command execution.

```
┌─────────────────────────┐                      ┌─────────────────────────┐
│     Phone (Client)      │                      │    Laptop (Server)      │
└────────────┬────────────┘                      └────────────┬────────────┘
             │                                                │
             │ 1. Scan Local mDNS Services                    │
             ├───────────────────────────────────────────────>│ [Advertises _setu-sync._tcp]
             │                                                │
             │ 2. Establish Connection (HTTPS)                │
             ├───────────────────────────────────────────────>│ [Pairing / ECDH Handshake]
             │                                                │
             │ 3. WebSocket Upgrade (Secure Session)          │
             ├───────────────────────────────────────────────>│ [Listens on secure WebSocket]
             │                                                │
             │ 4. Send Encrypted Command Payload              │
             ├───────────────────────────────────────────────>│ [Decrypts, Sanitizes, Runs]
             │                                                │
             │ 5. Stream Real-time Output & TTS Chunk         │
             │<───────────────────────────────────────────────┤ [Streams logs + audio]
             │                                                │
```

---

## 2. Local Discovery (mDNS)

To avoid hardcoded IP addresses or manual router configuration, Setu uses Multicast DNS (mDNS) for zero-configuration network discovery.

-   **Service Type:** `_setu-sync._tcp.local.`
-   **Port:** Dynamically allocated (defaults to `8008` if free).
-   **TXT Records:**
    -   `device_id`: Unique hash identifying the target machine.
    -   `friendly_name`: User-facing name (e.g., "Dhaval's Laptop").
    -   `os`: Target operating system (`windows` / `linux`).
    -   `pairing_status`: `paired` / `discoverable`.

### Technology Stack
*   **Python (Backend/Laptop):** `zeroconf` library for registering the service.
*   **React Native (Mobile/Phone):** `react-native-zeroconf` or `react-native-nsd` for service discovery.

---

## 3. Secure Pairing Handshake

To prevent unauthorized devices from executing commands on your system, Setu implements a secure pairing flow utilizing **ECDH (Elliptic Curve Diffie-Hellman)** and a **shared validation secret** (QR Code / PIN).

### The Handshake Sequence

1.  **Discovery:** Phone finds the Laptop via mDNS and requests pairing.
2.  **Visual Authentication:**
    -   Laptop generates a dynamic **6-digit PIN** and a **QR Code** containing its ECDH Public Key ($PK_{laptop}$) and a random pairing challenge (nonce).
    -   User scans the QR Code or enters the PIN on the Phone.
3.  **Key Exchange (ECDH):**
    -   Phone generates its own ECDH Key Pair ($SK_{phone}$, $PK_{phone}$).
    -   Phone sends $PK_{phone}$ to the Laptop.
    -   Both devices compute the shared secret $S_{shared} = ECDH(SK, PK)$.
4.  **Key Derivation:**
    -   Using Key Derivation Function (HKDF) with the shared secret $S_{shared}$ and the PIN/QR nonce, both devices derive:
        -   `Session_AES_Key` (256-bit key for encrypting messages).
        -   `Session_HMAC_Key` (256-bit key for message integrity verification).
5.  **Mutual Verification:**
    -   Phone encrypts a test message: `{"challenge": nonce, "device_name": friendly_name}` using the derived key.
    -   Laptop decrypts, verifies the nonce, registers the Phone's device ID as `PAIRED`, and stores the derived keys in MongoDB (`device_pairings` collection).

---

## 4. Message Schema (JSON)

Once paired, all communications occur over a TLS/WSS WebSocket connection using JSON frames encrypted with **AES-256-GCM**.

### Envelope Structure (Cleartext Wrapper)
```json
{
  "sender_id": "phone_uuid_12345",
  "recipient_id": "laptop_uuid_67890",
  "timestamp": 1781234567,
  "nonce": "unique-random-nonce-per-message",
  "payload": "<Base64 encoded ciphertext of the actual command payload>",
  "tag": "<Base64 encoded auth tag from AES-GCM>"
}
```

### Decrypted Command Payload
```json
{
  "action": "EXECUTE_COMMAND",
  "command_type": "shell",
  "command": "python script.py",
  "permission_level": "L2",
  "options": {
    "stream_output": true,
    "generate_tts": true,
    "timeout_seconds": 30
  }
}
```

### Decrypted Response Payload
```json
{
  "status": "RUNNING",
  "stdout_chunk": "Processing line 4...",
  "stderr_chunk": "",
  "tts_audio_chunk": "<Base64 encoded Kokoro TTS audio chunk>",
  "is_finished": false
}
```

---

## 5. Security & Prevention Measures

Because remote code execution is highly sensitive, the protocol enforces several layers of security:

### Replay Attack Prevention
*   Every message includes a `timestamp` and a unique `nonce`.
*   The target device checks that the timestamp is within $\pm 5$ seconds of local system time.
*   The target device tracks used nonces in Redis (with a 10-second TTL). Repeated nonces are silently dropped.

### Command Execution Sandboxing
*   Remote commands are subjected to the exact same safety engine in `safety.py` (checking the command blacklist and locking down path access to the home directory).
*   Any L3 level actions (installing software, editing system files) will **block** and raise a native prompt on the target machine's screen. The initiating device will receive a `WAITING_FOR_USER_CONSENT` state frame.

### Network Isolation
*   By default, the server socket bound by Daphne/Channels only listens on local interfaces. 
*   Connections from external networks (outside the local subnet mask) are blocked at the application level.

---

## 6. Connection Lifecycle State Machine

```
     ┌──────────────┐
     │  DISCONNECTED│
     └──────┬───────┘
            │
            │  mDNS Discover
            ▼
     ┌──────────────┐
     │  DISCOVERED  │
     └──────┬───────┘
            │
            │  Initiate Pairing / PIN Entry
            ▼
     ┌──────────────┐          Pairing Fail
     │   PAIRING    ├───────────────────────┐
     └──────┬───────┘                       │
            │                               │
            │  ECDH Handshake Success       │
            ▼                               │
     ┌──────────────┐                       │
     │    PAIRED    │                       │
     └──────┬───────┘                       │
            │                               │
            │  Establish TLS WebSocket      │
            ▼                               │
     ┌──────────────┐                       │
     │  AUTHORIZED  │                       │
     └──────┬───────┘                       │
            │                               │
            │  Session Terminated / Error   │
            ▼                               ▼
     ┌──────────────┐               ┌──────────────┐
     │  DISCONNECTING ─────────────>│    ERROR     │
     └──────────────┘               └──────────────┘
```
