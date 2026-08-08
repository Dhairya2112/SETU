#!/bin/bash

echo "================================================="
echo "        SETU Workstation - Setup Script          "
echo "================================================="
echo ""
echo "OS: macOS / Linux detected."
echo ""

# 1. Setup Backend
echo "[1/4] Setting up Python backend..."
cd backend || exit

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  -> Virtual environment 'venv' created."
else
    echo "  -> Virtual environment 'venv' already exists."
fi

# Activate and install dependencies
source venv/bin/activate
echo "  -> Installing Python requirements..."
pip install --upgrade pip
pip install -r requirements.txt

# Install Playwright browsers
echo "  -> Installing Playwright browsers..."
playwright install chromium

# Generate .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "  -> Creating .env file template..."
    cat <<EOT > .env
DJANGO_SECRET_KEY=dummy-secret-key-for-local-dev
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,*

MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DB=setu_db

# JWT
JWT_SECRET_KEY=dummy-jwt-secret-key
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# LLM APIs (FILL THESE IN)
NVIDIA_API_KEY=your_nvidia_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Playwright
PLAYWRIGHT_HEADLESS=True
EOT
    echo "  -> .env created."
else
    echo "  -> .env file already exists, skipping."
fi

cd ..

# 2. Setup Frontend
echo ""
echo "[2/4] Setting up React Frontend..."
cd frontend || exit
echo "  -> Installing npm packages..."
npm install
cd ..

# 3. Final Instructions
echo ""
echo "================================================="
echo "                 SETUP COMPLETE!                 "
echo "================================================="
echo ""
echo "ACTION REQUIRED: API Keys"
echo "Please open the file 'backend/.env' in a text editor"
echo "and paste your actual API keys where it says:"
echo "'your_gemini_api_key_here', etc."
echo ""
echo "-------------------------------------------------"
echo "To START the system, open two terminal windows:"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  daphne -b 0.0.0.0 -p 8000 setu.asgi:application"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend"
echo "  npm run dev"
echo "================================================="
