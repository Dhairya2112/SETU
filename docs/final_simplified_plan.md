# Setu — Definitive Simplification Plan

> **Status:** Celery fully removed ✅ | Django check passes ✅
> **Deadline:** July 20, 2026 | **Frontend:** JavaScript (no TypeScript)

---

## Complete Codebase Audit (What Exists Right Now)

### Backend — `backend/` (42 Python files)

```
backend/
├── listener.py                          ✅ KEEP — voice loop (wake word → STT → agent → TTS)
├── manage.py                            ✅ KEEP
├── requirements.txt                     ✅ KEEP (already cleaned)
├── .env                                 ✅ KEEP
├── db.sqlite3                           ✅ KEEP (Django internal tables)
│
├── setu/
│   ├── __init__.py                      ✅ KEEP (empty — clean)
│   ├── settings.py                      ✅ KEEP (already cleaned)
│   ├── asgi.py                          ✅ KEEP
│   ├── urls.py                          ✅ KEEP
│   ├── wsgi.py                          ✅ KEEP
│   └── celery.py                        🗑️ DELETED (just now)
│
├── core/
│   ├── agent/
│   │   ├── llm_agent.py                 ✅ KEEP — LangGraph agent, 3-layer LLM fallback
│   │   ├── tools.py                     ✅ KEEP + EDIT — add Playwright browser tools (Phase A)
│   │   ├── tasks.py                     ✅ KEEP (Celery cleaned ✅)
│   │   ├── fast_responses.py            ✅ KEEP — Tier 0 regex router
│   │   ├── tts_cache.py                 ✅ KEEP (Celery comment cleaned ✅)
│   │   ├── safety.py                    ✅ KEEP — command blacklist + sandboxing
│   │   ├── permissions.py               ✅ KEEP — L1/L2/L3 permission checks
│   │   ├── models.py                    ✅ KEEP — CommandLog model
│   │   ├── views.py                     ✅ KEEP (Celery cleaned ✅)
│   │   └── urls.py                      ✅ KEEP
│   │
│   ├── ai/
│   │   ├── stt.py                       ✅ KEEP — Faster-Whisper multilingual STT
│   │   └── tts.py                       ✅ KEEP — Kokoro TTS (Hindi/English, male/female)
│   │
│   ├── conversations/
│   │   ├── models.py                    ✅ KEEP — Conversation, Message models
│   │   ├── serializers.py               ✅ KEEP
│   │   ├── views.py                     ✅ KEEP
│   │   └── urls.py                      ✅ KEEP
│   │
│   ├── tasks/
│   │   ├── apps.py                      ✅ KEEP — daemon thread reminder scheduler
│   │   ├── tasks.py                     ✅ KEEP (Celery cleaned ✅)
│   │   ├── models.py                    ✅ KEEP — Reminder model
│   │   ├── serializers.py               ✅ KEEP
│   │   ├── views.py                     ✅ KEEP
│   │   └── urls.py                      ✅ KEEP
│   │
│   ├── users/
│   │   ├── models.py                    ✅ KEEP — User, Preferences, Permissions models
│   │   ├── auth.py                      ✅ KEEP — JWT auth, PyJWTAuthentication
│   │   ├── views.py                     ✅ KEEP — Register, Login, OAuth, Profile
│   │   ├── serializers.py               ✅ KEEP
│   │   ├── adapters.py                  ✅ KEEP — NoNewUsersAccountAdapter
│   │   ├── urls.py                      ✅ KEEP
│   │   └── tests.py                     ✅ KEEP
│   │
│   ├── websockets/
│   │   ├── consumers.py                 ✅ KEEP (Celery comment cleaned ✅)
│   │   ├── middleware.py                ✅ KEEP — JWT WebSocket auth
│   │   └── routing.py                   ✅ KEEP
│   │
│   ├── wake_word/
│   │   └── detector.py                  ✅ KEEP — OpenWakeWord + Silero VAD
│   │
│   └── auth/                            🗑️ EMPTY DIR — can delete
```

### Frontend — `frontend/src/` (10 files to convert TS → JS)

```
frontend/src/
├── App.tsx              → CONVERT to App.jsx
├── main.tsx             → CONVERT to main.jsx
├── index.css            ✅ KEEP (no change needed)
├── components/
│   ├── Login.tsx        → CONVERT to Login.jsx
│   ├── NeuralMesh.tsx   → CONVERT to NeuralMesh.jsx
│   └── TitleBar.tsx     → CONVERT to TitleBar.jsx
├── hooks/
│   └── useAgentSocket.ts → CONVERT to useAgentSocket.js
├── pages/
│   ├── Dashboard.tsx    → CONVERT to Dashboard.jsx (80KB — biggest file!)
│   └── Onboarding.tsx   → CONVERT to Onboarding.jsx
└── store/
    └── useAppStore.ts   → CONVERT to useAppStore.js

Config files to update:
├── vite.config.ts       → CONVERT to vite.config.js
├── eslint.config.js     → EDIT (remove TS plugins)
├── tsconfig.json        → DELETE
├── tsconfig.app.json    → DELETE
├── tsconfig.node.json   → DELETE
├── package.json         → EDIT (remove TS dependencies)
```

### Other Directories

```
landing/                 ✅ KEEP — static HTML landing page (index.html, style.css, script.js)
ai/intent_classifier/    ⚡ IGNORE — trained model exists but not integrating for MVP
```

---

## The 4 Phases

### Phase 0: TypeScript → JavaScript (Day 1)
> Clean slate — your frontend, your language

**Step 0.1 — Convert files** (~1 hour)
| File | Action |
|---|---|
| `App.tsx` → `App.jsx` | Remove type imports, `: React.FC`, etc. |
| `main.tsx` → `main.jsx` | Remove type annotations |
| `Login.tsx` → `Login.jsx` | Remove interfaces, type casts |
| `NeuralMesh.tsx` → `NeuralMesh.jsx` | Remove type annotations |
| `TitleBar.tsx` → `TitleBar.jsx` | Remove type annotations |
| `Dashboard.tsx` → `Dashboard.jsx` | Remove interfaces, type casts (biggest file ~80KB) |
| `Onboarding.tsx` → `Onboarding.jsx` | Remove type annotations |
| `useAgentSocket.ts` → `useAgentSocket.js` | Remove type annotations |
| `useAppStore.ts` → `useAppStore.js` | Remove type annotations |
| `vite.config.ts` → `vite.config.js` | Remove TS plugin reference |

**Step 0.2 — Update configs** (~15 min)
- Delete `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Edit `package.json`: remove `typescript`, `@types/react`, `@types/react-dom`
- Edit `eslint.config.js`: remove `@typescript-eslint/*` plugins
- Edit `index.html`: change `main.tsx` → `main.jsx`

**Step 0.3 — Verify** (~10 min)
- `npm install`
- `npm run dev`
- Test: login, onboarding, dashboard all work

**Step 0.4 — Delete empty dir** (~1 min)
- Delete `backend/core/auth/` (empty folder)

---

### Phase A: Playwright Browser Automation (Days 2-4)
> The #1 demo feature — "Open YouTube" actually works

**Day 2 — Browser session manager**
- New file: `backend/core/agent/browser.py`
  - `BrowserManager` class — launches Chromium, manages persistent page
  - Auto-closes after 5 min inactivity
  - `pip install playwright && playwright install chromium`

**Day 3 — Browser tools**  
- Edit: `backend/core/agent/tools.py` — add:
  - `navigate_browser(url)` — open URL in browser
  - `click_element(text_or_selector)` — click buttons/links
  - `type_into_field(selector, text)` — type in search bars
  - `get_page_content()` — read page content

**Day 4 — Agent integration + testing**
- Update agent system prompt in `llm_agent.py` to know about browser tools
- Test scenarios: "open YouTube", "search for Django tutorials", "go to google"

---

### Phase B: Phone PWA + Voice (Days 5-7)
> Phone opens Setu in browser → speak → laptop executes

**Day 5 — Mobile-responsive dashboard**
- Edit `Dashboard.jsx` + `index.css`
  - CSS media queries for phones (< 768px)
  - Big floating mic button
  - Collapsible sidebar → hamburger menu
  - Touch-friendly cards

**Day 6 — PWA setup + mic recording**
- New: `frontend/public/manifest.json` (app name, icon, theme)
- New: `frontend/public/sw.js` (service worker)
- Add mic recording via Web Audio API in dashboard
- Generate app icon via image tool

**Day 7 — Phone → laptop voice pipeline**
- Send audio from phone browser → WebSocket → backend
- Backend receives audio → Faster-Whisper STT → agent → result
- Stream result back to phone
- Test on actual phone over WiFi

---

### Phase C: Polish & Demo (Days 8-10+)
> Make it bulletproof for presentation

- End-to-end testing all demo scenarios
- Bug fixes
- Polish landing page
- Write and rehearse demo script
- Backup plans (what if WiFi/mic fails)

---

## Files Created/Modified Summary

| Phase | New Files | Modified Files | Deleted Files |
|---|---|---|---|
| Celery cleanup ✅ | — | 4 files cleaned | `setu/celery.py` |
| Phase 0 | — | 10 TS→JS + 3 configs | 3 tsconfig files |
| Phase A | `browser.py` (1 new) | `tools.py`, `llm_agent.py` | — |
| Phase B | `manifest.json`, `sw.js` (2 new) | `Dashboard.jsx`, `index.css`, `useAgentSocket.js` | — |
| Phase C | — | Landing page files | — |
| **Total** | **3 new files** | **~18 modified** | **4 deleted** |

---

## What You're NOT Touching

These documented features exist in the docs but are **skipped for MVP**:

| Feature | Doc Reference | Status |
|---|---|---|
| Intent classifier (PyTorch) | Step 15 | Model trained, not integrating |
| Redis semantic cache | Step 16 | Redis removed from stack |
| Cross-device ECDH protocol | Step 17 | Using simple WebSocket instead |
| pywinauto desktop automation | Step 19 | Skipped — Playwright is enough |
| Task plan confirmation UI | Step 20 | Skipped — agent just executes |
| Screenshot auto-capture | Step 21 | Skipped — manual "take screenshot" possible |
| Memory/contacts system | Step 22 | Skipped — post-MVP |
| 8-step onboarding | Step 23 | Keep current 4-step |
| React Native app | Step 24 | PWA instead |
| Custom wake word | Step 26 | Keep hey_jarvis proxy |

---

## Day-by-Day Schedule

| Day | Date | Phase | Task |
|---|---|---|---|
| 1 | **Jul 4** | **0** | TypeScript → JavaScript conversion |
| 2 | Jul 5 | **A** | Playwright setup + browser manager |
| 3 | Jul 6 | A | Browser tools (navigate, click, type, read) |
| 4 | Jul 7 | A | Agent integration + test demo flows |
| 5 | Jul 8 | **B** | Dashboard mobile-responsive CSS |
| 6 | Jul 9 | B | PWA manifest + phone mic recording |
| 7 | Jul 10 | B | Phone voice → WebSocket → STT → agent pipeline |
| 8-9 | Jul 11-13 | **C** | Bug fixes + end-to-end testing |
| 10 | Jul 14-16 | C | Polish UI, landing page, demo script |
| — | Jul 17-19 | — | Rehearse, rest, final fixes |
| 🎯 | **Jul 20** | — | **DEMO DAY** |
