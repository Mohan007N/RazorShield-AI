@echo off
REM RazorShield AI - Local Deployment Script (Windows)

echo ==========================================
echo RazorShield AI - Local Deployment
echo ==========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo.
    echo Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

echo [1/5] Docker is running...
echo.

REM Check if .env exists
if not exist .env (
    echo [2/5] Creating .env file from template...
    copy .env.example .env
    echo.
    echo [WARNING] Please edit .env file with your settings:
    echo   - Add OpenAI API key (optional)
    echo   - Add Razorpay webhook secret (optional)
    echo.
    pause
) else (
    echo [2/5] .env file found...
)
echo.

echo [3/5] Starting RazorShield AI services...
echo.
docker-compose up -d

echo.
echo [4/5] Waiting for services to start...
timeout /t 10 /nobreak >nul

echo.
echo [5/5] Checking service status...
echo.
docker-compose ps

echo.
echo ==========================================
echo RazorShield AI is running locally!
echo ==========================================
echo.
echo Access the application:
echo   Frontend:  http://localhost:5173
echo   API:       http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo.
echo Useful commands:
echo   View logs:     docker-compose logs -f
echo   Stop:          docker-compose down
echo   Restart:       docker-compose restart
echo.
echo Press any key to open the dashboard...
pause >nul

start http://localhost:5173

echo.
echo Dashboard opened in browser!
echo.
echo To stop the application, run:
echo   docker-compose down
echo.
pause
