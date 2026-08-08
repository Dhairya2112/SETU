# SETU - Agentic Autonomous Workstation

SETU is an advanced AI-powered workstation that integrates a ReAct LangGraph agent to autonomously execute OS-level and browser-level tasks. 

## Features
- **Browser Automation:** A specialized Gemini-Flash sub-agent securely automates complex tasks like logging in or buying products using Playwright.
- **Micro-Services Architecture:** A robust Django backend paired with a React PWA frontend.
- **Cross-Device Control:** Connect your mobile device via Local Area Network (LAN) as a secure wireless remote to control the desktop agent.
- **Self-Healing Loop:** The agent observes terminal outputs and automatically resolves dependency errors autonomously.

---

## 🚀 Quick Setup (Automated)

### For macOS / Linux
Simply run the setup bash script in your terminal:
```bash
chmod +x install.sh
./install.sh
```

### For Windows
Double click the `install.bat` file, or run it in your command prompt:
```cmd
install.bat
```

Both scripts will automatically:
1. Create the Python virtual environment.
2. Install all required backend dependencies (`requirements.txt`).
3. Install Playwright browsers.
4. Install all frontend dependencies (`npm install`).
5. Generate a `.env` file template for you to insert your API keys.

---

## ⚙️ Manual Installation & Setup

If you prefer to install things manually, follow these steps:

### 1. Backend Setup (Django & AI Agents)

**macOS / Linux:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

**Windows:**
```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

### 2. Frontend Setup (React PWA)
```bash
cd frontend
npm install
```

### 3. Environment Variables (.env)
In the `backend/` directory, copy the `.env.example` file to `.env`:
```bash
cp backend/.env.example backend/.env
```
Open the `backend/.env` file and insert your respective API keys:
- `GEMINI_API_KEY=your_key_here`
- `NVIDIA_API_KEY=your_key_here`
- `OPENROUTER_API_KEY=your_key_here`

---

## 🏃‍♂️ Running SETU

You need two terminal windows open to run SETU:

### Terminal 1: Backend Server (Daphne)
**macOS / Linux:**
```bash
cd backend
source venv/bin/activate
daphne -b 0.0.0.0 -p 8000 setu.asgi:application
```

**Windows:**
```cmd
cd backend
venv\Scripts\activate
daphne -b 0.0.0.0 -p 8000 setu.asgi:application
```

### Terminal 2: Frontend Client (Vite)
**All OS:**
```bash
cd frontend
npm run dev
```

### Mobile Remote Connection
To connect your mobile device as a remote:
1. Ensure your phone and PC are connected to the **same WiFi network**.
2. Run the frontend using `npm run dev -- --host` instead of just `npm run dev`.
3. Locate your local network IP (e.g. `http://192.168.x.x:5173`) displayed in the Vite terminal.
4. Open that IP address in your mobile phone's browser.
5. In the SETU dashboard settings, click **Pair Mobile Device** and scan the QR code (or use the link).
