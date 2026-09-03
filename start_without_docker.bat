@echo off
REM RazorShield AI - Start Without Docker (Development Mode)

echo ==========================================
echo RazorShield AI - Local Development Start
echo ==========================================
echo.

echo [INFO] Running without Docker - Development Mode
echo [INFO] Some features will use lightweight alternatives:
echo   - Database: SQLite (already configured)
echo   - Redis: Not required for basic testing
echo   - Kafka: Disabled (sync mode)
echo.

REM Check if backend dependencies are installed
echo [1/4] Checking backend dependencies...
cd backend
if not exist "venv\" (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
    echo [INFO] Installing dependencies...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    echo [SUCCESS] Backend dependencies installed
) else (
    echo [SUCCESS] Backend venv found
    call venv\Scripts\activate.bat
)
cd ..
echo.

REM Check if frontend dependencies are installed
echo [2/4] Checking frontend dependencies...
cd frontend
if not exist "node_modules\" (
    echo [INFO] Installing frontend dependencies...
    call npm install
    echo [SUCCESS] Frontend dependencies installed
) else (
    echo [SUCCESS] Frontend node_modules found
)
cd ..
echo.

REM Start backend in background
echo [3/4] Starting FastAPI backend...
cd backend
start "RazorShield API" cmd /k "venv\Scripts\activate.bat && uvicorn backend.app.main:app --reload --port 8000"
echo [SUCCESS] Backend starting on http://localhost:8000
cd ..
echo.

REM Wait for backend to start
echo Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

REM Start frontend
echo [4/4] Starting React frontend...
cd frontend
start "RazorShield Frontend" cmd /k "npm run dev"
echo [SUCCESS] Frontend starting on http://localhost:5173
cd ..
echo.

echo ==========================================
echo RazorShield AI is starting!
echo ==========================================
echo.
echo Services:
echo   Backend API:  http://localhost:8000
echo   API Docs:     http://localhost:8000/docs
echo   Frontend:     http://localhost:5173
echo.
echo Note: Two command windows will open:
echo   1. FastAPI Backend (port 8000)
echo   2. React Frontend (port 5173)
echo.
echo To stop: Close both command windows
echo.
echo Press any key to open the dashboard...
pause >nul

timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo Dashboard opened! Wait a few seconds for services to fully start.
echo.
pause
