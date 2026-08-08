@echo off
echo =================================================
echo         SETU Workstation - Setup Script          
echo =================================================
echo.
echo OS: Windows detected.
echo.

:: 1. Setup Backend
echo [1/4] Setting up Python backend...
cd backend

:: Create virtual environment
if not exist "venv" (
    python -m venv venv
    echo   -^> Virtual environment 'venv' created.
) else (
    echo   -^> Virtual environment 'venv' already exists.
)

:: Activate and install dependencies
call venv\Scripts\activate
echo   -^> Installing Python requirements...
python -m pip install --upgrade pip
pip install -r requirements.txt

:: Install Playwright browsers
echo   -^> Installing Playwright browsers...
playwright install chromium

:: Generate .env file if it doesn't exist
if not exist ".env" (
    echo   -^> Creating .env file template...
    echo DJANGO_SECRET_KEY=dummy-secret-key-for-local-dev> .env
    echo DJANGO_DEBUG=True>> .env
    echo DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,*>> .env
    echo.>> .env
    echo MONGODB_HOST=localhost>> .env
    echo MONGODB_PORT=27017>> .env
    echo MONGODB_DB=setu_db>> .env
    echo.>> .env
    echo # JWT>> .env
    echo JWT_SECRET_KEY=dummy-jwt-secret-key>> .env
    echo JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15>> .env
    echo JWT_REFRESH_TOKEN_LIFETIME_DAYS=7>> .env
    echo.>> .env
    echo # LLM APIs (FILL THESE IN)>> .env
    echo NVIDIA_API_KEY=your_nvidia_api_key_here>> .env
    echo OPENROUTER_API_KEY=your_openrouter_api_key_here>> .env
    echo GEMINI_API_KEY=your_gemini_api_key_here>> .env
    echo.>> .env
    echo # OAuth>> .env
    echo GOOGLE_CLIENT_ID=your_google_client_id>> .env
    echo GOOGLE_CLIENT_SECRET=your_google_client_secret>> .env
    echo GITHUB_CLIENT_ID=your_github_client_id>> .env
    echo GITHUB_CLIENT_SECRET=your_github_client_secret>> .env
    echo.>> .env
    echo # Playwright>> .env
    echo PLAYWRIGHT_HEADLESS=True>> .env
    echo   -^> .env created.
) else (
    echo   -^> .env file already exists, skipping.
)

cd ..

:: 2. Setup Frontend
echo.
echo [2/4] Setting up React Frontend...
cd frontend
echo   -^> Installing npm packages...
call npm install
cd ..

:: 3. Final Instructions
echo.
echo =================================================
echo                  SETUP COMPLETE!                 
echo =================================================
echo.
echo ACTION REQUIRED: API Keys
echo Please open the file 'backend\.env' in a text editor
echo and paste your actual API keys where it says:
echo 'your_gemini_api_key_here', etc.
echo.
echo -------------------------------------------------
echo To START the system, open two command prompts:
echo.
echo Terminal 1 (Backend):
echo   cd backend
echo   venv\Scripts\activate
echo   daphne -b 0.0.0.0 -p 8000 setu.asgi:application
echo.
echo Terminal 2 (Frontend):
echo   cd frontend
echo   npm run dev
echo =================================================
pause
