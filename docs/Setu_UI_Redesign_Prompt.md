# Setu — UI Redesign Prompt (Google Stitch / Claude / Cursor)

> Copy-paste this entire file into any AI code generator to redesign the Setu frontend.

---

Redesign the desktop UI for "Setu" — a cross-device, voice-native AI automation assistant (Electron/Tauri desktop app). The product vision: you speak, Setu acts. It bridges your phone and laptop over LAN to execute real tasks (open apps, browser automation, send messages, etc). This is NOT a chatbot — the chat UI is a command log and fallback input.

Tech stack: React 18 + TypeScript + Vite + Tailwind CSS v4 + Framer Motion + Zustand. Fonts loaded: Space Grotesk + Syne.

---

## PART 1: AUTH SCREEN (Login / Signup)

Setu uses OAuth ONLY — Google and GitHub. NO email/password forms. NO local password storage.

Design a clean, centered auth card on a refined dark background (subtle radial gradient, NO particle canvases):

- Large brand logo (the existing SVG S-curve mark) at top, centered, with "SETU" wordmark beneath
- Subtitle: "Your voice. Your devices. One system."
- Two prominent OAuth buttons stacked vertically:
  - "Continue with Google" — white bg, Google "G" icon on left, dark text
  - "Continue with GitHub" — dark bg with border, GitHub icon on left, white text
- Buttons should be full-width, tall (48px+), with proper hover/active states
- No "register vs login" toggle — OAuth handles both
- Footer text (small, muted): "By continuing you agree to Setu's terms and privacy policy" (link to EULA)
- Remove all dev-mode badges like "LOCAL NETWORK / TLS ENCRYPTION / AES_256"
- When OAuth redirect happens, show a loading spinner on the clicked button (disable both buttons during auth)

Backend endpoint: clicking Google OAuth redirects to `/api/v1/auth/google/`. Clicking GitHub OAuth redirects to `/api/v1/auth/github/`. After OAuth callback, backend redirects to frontend with JWT in URL params.

---

## PART 2: ONBOARDING (8-Step Wizard)

Multi-step onboarding wizard. Each step PATCHes `/api/v1/user/profile/` before advancing. Steps can be skipped (phone pairing is optional).

Use a clean stepper at the top: numbered circles (1 through 8) with a connecting line. Current step is highlighted in accent color. Completed steps show a checkmark. Future steps are dimmed.

Each step renders inside a centered glass card (max-width 520px) with smooth framer-motion transitions.

### Step 1 — Welcome
- "Welcome to Setu" heading
- Brief tagline explaining what Setu does
- Single "Let's begin" button to advance
- Icon: friendly greeting illustration or simple sparkle

### Step 2 — Your Name
- "What should I call you?" heading
- Single text input, auto-focused, placeholder "Your name"
- Continue button (disabled until name entered)
- PATCH `{ username: name, preferences: { display_name: name } }` to backend

### Step 3 — Language
- "Choose Setu's language" heading
- Three large selectable cards in a row:
  - "English" — with 🇬🇧 or "EN" badge
  - "हिन्दी (Hindi)" — with 🇮🇳 or "HI" badge
  - "Auto-detect" — description: "Setu will detect language automatically"
- Selecting one highlights the card with accent border and bg
- PATCH `{ preferences: { language: "en" | "hi" | "auto" } }` to backend

### Step 4 — Voice
- "Choose Setu's voice" heading
- Two large selectable cards:
  - "Female" — with female icon, description "Warm and clear"
  - "Male" — with male icon, description "Deep and confident"
- Each card has a small "Preview" button that plays a TTS audio sample
- PATCH `{ preferences: { tts_voice_gender: "female" | "male" } }` to backend

### Step 5 — Permissions & EULA
- "Permissions and privacy" heading
- Toggle: "Allow OS automations" — description: "Let Setu execute system commands, open apps, and automate tasks on your computer"
- Below: compact EULA summary (3-4 bullet points covering: local-first data, no cloud relay, user controls permissions, data stays on device)
- Checkbox: "I agree to the local-first execution agreement" (required to continue)
- PATCH `{ permissions: { level_2_granted: true/false } }` and `{ preferences: { privacy_consent_granted: true } }` to backend

### Step 6 — Pair Your Phone (Skippable)
- "Connect your phone" heading
- Description: "Install Setu on your phone and pair it to control your laptop from anywhere on your network"
- Show a 6-digit PIN (large, monospace, in a highlighted box) — this is the pairing code
- Show a QR code placeholder area
- Two buttons: "Skip for now" (secondary, left) and "I've paired my phone" (primary, right)
- PATCH device pairing info when user confirms

### Step 7 — Screenshot Preference
- "Show screenshots of completed tasks?" heading
- Three large selectable cards:
  - "Always" — description: "Setu will capture and show a screenshot after every task step"
  - "Ask each time" — description: "Setu will ask before taking a screenshot"
  - "Never" — description: "No screenshots will be taken"
- PATCH `{ preferences: { screenshot_preference: "always" | "ask" | "never" } }` to backend

### Step 8 — Done
- Large checkmark animation or subtle celebration
- "You're all set, [name]!" heading
- Subtitle: "Say 'Hey Setu' to get started"
- Single "Enter Setu" button → navigate to Dashboard
- Set `onboardingCompleted: true` in Zustand store

---

## PART 3: DASHBOARD LAYOUT

The dashboard has a slim left sidebar + main content area.

### Sidebar (64px wide, icon-only)
- Logo mark at top (centered, 24px)
- 4 navigation items with tooltips on hover:
  1. **Chat** (message-square icon) — default/active view
  2. **Memory** (brain/bookmark icon) — what Setu remembers about you
  3. **Tasks** (checklist/clipboard icon) — reminders and scheduled automations
  4. **Settings** (gear icon) — all app configuration
- Active state: subtle bg fill (white/[0.06]) + 2px left accent bar in violet
- Hover: slight lighten (white/[0.03])
- User avatar + sign out at bottom (32px circle with initials)
- NO labels visible, NO notification badges, NO expand-collapse
- Background: zinc-950/90 with subtle right border

---

### VIEW 1: CHAT (Main Interaction Screen)

This is where all voice and text interaction happens. The chat UI is a command log — not the product.

Layout:
- **Top bar**: "Welcome, [name]" greeting left, connection status pill right (green dot + "Connected" or red dot + "Disconnected")
- **Center**: The AI orb/core — the visual centerpiece
  - **Idle state**: ~80px circle, subtle violet radial gradient, slow breathing animation (3-4 second ease-in-out pulse in scale + opacity)
  - **Listening state**: ~120px, brighter violet with an animated audio waveform ring around it (use actual audio level data from the microphone to drive the ring height)
  - **Thinking state**: orb pulses slowly with a "Thinking..." text below
  - **Speaking state**: warm amber/orange glow with expanding concentric rings outward
  - NO spinning dashed borders. NO CSS-only fake animations.
- **Below orb**: Contextual text that changes with state:
  - Idle: "How can I help you?"
  - Listening: "Listening..."
  - Thinking: "Working on it..."
  - Speaking: "Setu is speaking..."
- **Input bar**: Large, rounded, centered at bottom of viewport — text input with mic button (left) and send button (right). When mic is active, input bar glows subtly.
- **Conversation history**: Above the orb, scrollable transcript. User messages right-aligned in violet-tinted bubbles. AI messages left-aligned with subtle avatar dot. Streaming text appears character by character.
- **NO telemetry badges** — users don't need to see LLM model, TTS engine, mic energy percentage
- **NO terminal drawer** — no monospace log streams, no "$ " prompts, no hardcoded paths
- **Plan review**: When Setu generates a multi-step plan, show it as an inline card with numbered steps and [Proceed] / [Cancel] buttons
- **Task execution**: Show step-by-step progress inline as the task runs, with a completion checkmark when done
- **Error state**: Inline error card with retry button, auto-dismiss after 5 seconds

---

### VIEW 2: MEMORY (What Setu Knows About You)

Header: "Memory" title + subtitle "Things Setu remembers about you. You can edit or remove anything."

Layout:
- Sectioned by category:
  - **About You**: display name, language preference, voice preference, screenshot preference
  - **Preferences**: preferred browser, frequently used apps, work hours, etc.
  - **Saved Facts**: dynamically learned facts from conversations (e.g., "Your name is Rahul", "You use VS Code daily", "You prefer Chrome over Edge")
  - **Contacts**: stored contacts that enable "Message Rahul" type commands
- Each memory as a clean card with:
  - The fact/value on the left
  - Date learned (small, muted) on the right
  - A small delete (×) button that appears on hover
- Editable fields for About You section (inline editing)
- Toggle section: "What Setu is allowed to remember" — toggles for:
  - Remember app preferences
  - Remember contact names
  - Remember conversation patterns
  - Remember work schedule
- Empty state: "Setu doesn't know much about you yet. The more you chat, the better it understands your preferences."
- "Clear all memories" button (danger zone, requires confirmation)

Data: Fetch from `/api/v1/user/memory/` (GET), delete individual with DELETE, clear all with POST to `/api/v1/user/memory/clear/`. Contacts: `/api/v1/contacts/`. User profile: `/api/v1/user/profile/`.

---

### VIEW 3: TASKS (Reminders & Scheduled Automations)

Header: "Tasks" title + subtitle "Reminders and scheduled automations. Ask Setu to create one, or add manually."

Layout:
- "Create Task" button (primary) at top-right → opens inline form or modal
- Tasks grouped by time:
  - **Today** — tasks scheduled for today
  - **Tomorrow** — tasks for tomorrow
  - **Later** — everything else
  - **Completed** — past/completed tasks (collapsed by default)
- Each task as a clean card:
  - Left: time badge (e.g., "5:00 PM") in a colored pill
  - Middle: task title + optional description
  - Right: status indicator (upcoming dot, completed checkmark, overdue warning) + delete button
- Inline create form when clicking "Create Task":
  - Title input (required)
  - Date/time picker
  - Optional description textarea
  - "Schedule" button
- POST to `/api/v1/reminders/` to create, DELETE to `/api/v1/reminders/{id}/` to remove
- Empty state: illustration + "No tasks scheduled. Say 'Remind me to...' or create one manually."
- Toast notification when a reminder fires (already implemented in codebase)

---

### VIEW 4: SETTINGS (Complete Settings Hub)

This is the most important view to get right. It manages ALL app configuration. Organize into clearly labeled sections with dividers. Each setting row has: label + description on the left, control on the right.

**Section 1: Profile**
- Display name — editable text field, save button on change
- Email — read-only, shows OAuth provider (Google/GitHub icon + email)
- Account created date — read-only
- "Sign out" button — danger style, full-width at bottom of section

**Section 2: Voice & Language**
- Language — select dropdown: [English] [हिन्दी Hindi] [Auto-detect]
  - PATCH `{ preferences: { language: "en" | "hi" | "auto" } }`
- Voice gender — segmented control: [Female] [Male]
  - PATCH `{ preferences: { tts_voice_gender: "female" | "male" } }`
- Voice speed — slider (0.5x to 2.0x, default 1.0x) with preview button
  - PATCH `{ preferences: { tts_speed: float } }`
- "Preview voice" button — plays a short TTS sample with current settings

**Section 3: Wake Word**
- Wake word sensitivity — slider (Low → Medium → High, default 0.06 threshold)
  - PATCH `{ preferences: { wake_word_sensitivity: float } }`
- Description: "Controls how sensitive Setu is to the 'Hey Setu' wake word. Higher means it responds more easily but may trigger falsely."

**Section 4: Devices**
- Paired devices list — shows each paired phone:
  - Device name (e.g., "Pixel 8 Pro")
  - Status: Online/Offline (green/red dot)
  - Last seen timestamp
  - "Unpair" button (danger style)
- If no devices paired: "No devices paired. Install Setu on your phone and scan the QR code to connect."
- "Add Device" button → shows pairing PIN and QR code in a modal
- Data from `/api/v1/devices/`

**Section 5: Behavior**
- Task plan confirmation — toggle on/off
  - Description: "When enabled, Setu shows you a plan before executing multi-step tasks. Disable for instant execution (Trust Mode)."
  - PATCH `{ preferences: { trust_mode: boolean } }` (note: trust_mode=true means SKIP confirmation)
- Screenshot preference — segmented control: [Always] [Ask] [Never]
  - Description: "Whether Setu captures and shows screenshots after completing task steps."
  - PATCH `{ preferences: { screenshot_preference: "always" | "ask" | "never" } }`
- Theme — segmented control: [Dark] [Light]
  - PATCH `{ preferences: { theme: "dark" | "light" } }`

**Section 6: Safety & Permissions**
- Safety level — three selectable cards in a horizontal row:
  - **L1 — Isolated**: "Complete filesystem sandboxing. Writes restricted to workspace only."
  - **L2 — Consent Required**: "Prompt confirmation for edits outside workspace." (default)
  - **L3 — Restricted**: "Blocks critical operations like registry or system directory changes."
  - Click to select, active card highlighted with accent border
- OS Automations — toggle (maps to `permissions.level_2_granted`)
  - Description: "Allow Setu to execute system commands, open applications, and automate window interactions."
- Whitelisted paths — list of directories where Setu can write files:
  - Each path in a row with a remove (×) button
  - "Add path" button to add new directory
- Audit log — compact table of recent safety events:
  - Columns: Action | Target | Level | Status | Time
  - Scrollable, max 20 entries
  - "View full log" link (opens modal or expands)

**Section 7: Data & Privacy**
- Conversation history:
  - "Clear all conversations" button (danger, requires confirmation)
  - "Export conversations" button (downloads JSON)
- Memory:
  - "View memory" link → navigates to Memory view
  - "Clear all memories" button (danger, requires confirmation)
- Command logs:
  - "Command logs auto-delete after 90 days" — info text
  - "View command logs" link
- Data statement: "All your data is stored locally on this device. Nothing is sent to external servers."

**Section 8: About**
- App version — e.g., "Setu v1.0.0-beta"
- Built with — small text listing key technologies
- Links: [Documentation] [GitHub] [Report a Bug]
- EULA & Privacy Policy — link to view full text

Settings layout design:
- Single scrollable page, max-width 800px, centered
- Section headers with 16px bold uppercase text, tracking-wide, muted color
- 1px white/5 dividers between sections
- Each setting row: flex justify-between, py-4 gap-6
- Left side: setting label (14px semibold) + description (12px muted) stacked
- Right side: the control (toggle, select, slider, button) aligned to the right
- Consistent spacing: 24px between sections, 16px between rows within a section

---

## DESIGN PRINCIPLES (Non-negotiable)

1. **NO particle backgrounds, NO constellation canvases, NO floating dots-and-lines** — replace NeuralMesh with a simple dark radial gradient component
2. **Color restraint** — violet (#8052ff) ONLY for active states, CTAs, and live indicators. Everything else is neutral zinc/slate. No rainbow badges.
3. **Typography hierarchy** — H1: 28px/600, H2: 22px/600, H3: 16px/600, Body: 14px/400, Caption: 12px/400, Micro: 11px/500 uppercase tracking-wide
4. **8px spacing grid** — 4, 8, 12, 16, 24, 32, 48, 64. No arbitrary values
5. **Depth over glow** — layered surfaces, subtle inner shadows, purposeful blur. Physical surfaces, not neon
6. **One card style** — rounded-2xl, 1px solid white/5 border, fill white/[0.02]. No mixing radii
7. **Motion with purpose** — 200-300ms ease-out fades for transitions. Subtle hover lifts. No scale: 1.01 on every button
8. **Professional empty states** — illustration + headline + action text. Never just "No data found"
9. **Accessible controls** — toggles have labels, sliders have values shown, buttons have text not just icons
10. **Responsive within desktop** — handle window resize gracefully. Sidebar stays 64px. Content areas use max-width containers

---

## OUTPUT

Provide complete redesigned code for ALL frontend files:
- `index.html`
- `src/index.css` (keep Tailwind v4 @theme block, update component classes)
- `src/App.tsx` (routing)
- `src/components/TitleBar.tsx`
- `src/components/Login.tsx` → redesign for OAuth
- `src/pages/Onboarding.tsx` → 8-step wizard
- `src/pages/Dashboard.tsx` → Chat, Memory, Tasks, Settings views
- `src/components/Background.tsx` → replaces NeuralMesh with gradient
- `src/store/useAppStore.ts` → keep existing, add any new state fields
- Keep `src/hooks/useAgentSocket.ts` and `src/hooks/useAudioAnalyser.ts` unchanged

Do NOT change business logic, API calls, WebSocket handling, or state management patterns. Only redesign the visual layer and component layout. Maintain all existing functionality.
