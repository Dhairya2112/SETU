#!/bin/bash
echo "Setting up macOS environment for SETU..."

# Setup Backend
echo "Setting up Backend..."
cd backend
python3.12 -m venv venv_mac
source venv_mac/bin/activate
pip install -r requirements.txt
cd ..

# Setup Frontend
echo "Setting up Frontend..."
cd frontend
npm install
cd ..

echo "========================================="
echo "Setup complete!"
echo "To run the backend:"
echo "  cd backend"
echo "  source venv_mac/bin/activate"
echo "  daphne -b 0.0.0.0 -p 8000 setu.asgi:application"
echo ""
echo "To run the frontend:"
echo "  cd frontend"
echo "  npm run dev"
echo "========================================="
