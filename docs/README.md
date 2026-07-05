# Setu — Technical Documentation Suite

Welcome to the **Setu (सेतु)** developer documentation hub. Setu is a local-first, privacy-native AI automation engine that bridges Android devices and Windows/Linux laptops over LAN.

This directory serves as the Single Source of Truth (SSoT) for technical design, implementation schedules, database schemas, and protocols.

---

## 1. Documentation Index

Use this directory map to locate specific design specs and playbooks:

| Document | Audience | Core Contents | When to Reference |
| :--- | :--- | :--- | :--- |
| [**STEP_BY_STEP_GUIDE.md**](file:///a:/SETU/docs/STEP_BY_STEP_GUIDE.md) | AI Agents / Devs | Structured 26-step implementation roadmap, complete with status legend (`COMPLETED`, `NEXT`, `PENDING`), completed tasks, and bug registry logs. | **Before starting any coding task** to verify the active implementation step. |
| [**AI_CONTEXT.md**](file:///a:/SETU/docs/AI_CONTEXT.md) | AI Agents / Devs | System requirements, complete module-level file maps, and strict security limits (such as UAC requirements, sandboxing, and name casing). | **When writing new modules or functions** to ensure architectural alignment. |
| [**DATABASE_SCHEMA.md**](file:///a:/SETU/docs/DATABASE_SCHEMA.md) | DBAs / Devs | MongoDB collections (MongoEngine ODM), schema structures, query indexes, and TTL configurations. | **When adding database fields, query models, or serializers.** |
| [**CROSS_DEVICE_PROTOCOL.md**](file:///a:/SETU/docs/CROSS_DEVICE_PROTOCOL.md) | Network / Devs | LAN mDNS discovery specs, visual pairing handshakes, and WebSocket message schemas. | **During Phase B** implementation to set up PWA-to-Laptop tunnels. |
| [**APP_FLOW.md**](file:///a:/SETU/docs/APP_FLOW.md) | Architects / Devs | Sequence diagrams for the STT/TTS pipeline, task planning confirmations, and the reliability model. | **To understand how data flows** between components. |
| [**UI_UX_FLOW.md**](file:///a:/SETU/docs/UI_UX_FLOW.md) | Frontend Devs | Complete screen routing, State Machine mapping, keyboard shortcuts, accessibility guidelines, and canvas theme rules. | **When adding views, modifying state flags, or designing pages.** |
| [**ENVIRONMENT_SETUP.md**](file:///a:/SETU/docs/ENVIRONMENT_SETUP.md) | Developers | Step-by-step setup commands, required `.env` parameters, static servers, and model pre-downloads. | **When setting up a new dev machine or staging environment.** |
| [**context_memory_log.md**](file:///a:/SETU/docs/context_memory_log.md) | AI Agents / Devs | A chronological journal of development events, security changes, refactors, and next session planning. | **At the start of every developer session.** |
| [**PROJECT_VISION.md**](file:///a:/SETU/docs/PROJECT_VISION.md) | PMs / Stakeholders | High-level product definition, MVP boundaries, zero-budget constraints, and target user profiles. | **To assess scope creep or post-MVP feature requests.** |
| [**EULA_PRIVACY_POLICY.md**](file:///a:/SETU/docs/EULA_PRIVACY_POLICY.md) | Legal / End Users | Legal agreements, data usage statements, local-first storage limits, and prohibited operations. | **When editing Onboarding Step 5** (Terms of Service check). |

---

## 2. Command Quick-Reference Playbook

### 2.1 Backend Operations (Django Daphne)
```powershell
# Navigate to backend
cd backend

# Activate virtual environment
venv\Scripts\activate

# Run django system checks (Verifies MongoEngine connectivity & model validity)
python manage.py check

# Run tests
python manage.py test

# Apply migrations (for SQL relational tokens, non-Mongo models)
python manage.py migrate

# Launch ASGI Server (binds to 0.0.0.0 for LAN communication)
daphne -b 0.0.0.0 -p 8000 setu.asgi:application

# Run local console-based listener (Bypasses UI to test STT/TTS/Agent loop)
python listener.py
```

### 2.2 Frontend Operations (React + Vite)
```powershell
# Navigate to frontend
cd frontend

# Run linter
npm run lint

# Start dev server
npm run dev

# Compile production bundle
npm run build
```

---

## 3. Mandatory Safety Filters (Rules of the House)

Every line of code committed to Setu must adhere to these structural constraints:

1. **Local-First Isolation:** No user audio, transcripts, or screenshot buffers may ever be sent to external cloud servers. All model inferences (Wake Word, STT, TTS, Classifier) must execute locally on the host CPU. The only outbound network requests allowed are directly to user-configured LLM API endpoints.
2. **Subnet Verification:** For cross-device WebSocket commands, the system must assert that `REMOTE_ADDR` belongs to the same `/24` local network subnet as the host laptop to block remote WAN routing attempts.
3. **Sandbox Enforcement:** Filesystem actions (reading, writing, deleting) inside `core/agent/safety.py` must restrict file handles to subdirectories of `Path.home()` or explicit directories listed in the user's `whitelisted_paths` preference document.
4. **Admin UAC Escalation:** Any task resolving to a Level 3 action (e.g., modifying registries, starting system daemons, software installs) must pause and trigger a native OS UAC prompt. Silent bypasses are prohibited.
5. **No Letter Spelling in TTS:** Keep AI name references written in Title Case (`"Setu"`). Never write `"SETU"` in output text strings as Kokoro will spell it out letter-by-letter as *S-E-T-U*.

---

## 4. Troubleshooting & Debugging Guide

### 4.1 WebSocket Reconnection Loops
* **Symptoms:** The UI log repeatedly prints `WebSocket Connected` followed immediately by `WebSocket Disconnected`.
* **Investigation:** Check if any reactive state dependency is triggering a HMR reload. Ensure callbacks passed to the `useAgentSocket` hook (like `onReminderFired`) are wrapped in a React `useRef` rather than being passed as raw anonymous functions from the parent render.

### 4.2 Audio Device Lockouts
* **Symptoms:** Wake word engine or TTS fail to boot, complaining of unavailable audio hardware.
* **Investigation:** Verify no other process is holding a blocking exclusive lock on the microphone or audio card. Ensure `sounddevice` drivers are correctly installed and matching default OS endpoints.
