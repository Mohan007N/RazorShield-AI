@echo off
REM RazorShield AI - Quick Start Script for Workers (Windows)

echo ==========================================
echo RazorShield AI - Production Stack Startup
echo ==========================================
echo.

REM Check if .env exists
if not exist .env (
    echo Warning: .env file not found. Creating from .env.example...
    copy .env.example .env
    echo Created .env file
    echo.
    echo IMPORTANT: Edit .env and set:
    echo    - NO_KAFKA=false
    echo    - OPENAI_API_KEY=your_key
    echo.
    pause
)

echo Starting production stack...
echo.

REM Start with scalable profile
echo Starting services...
docker-compose --profile scalable up -d

echo.
echo Waiting for services to be healthy...
timeout /t 10 /nobreak >nul

REM Check status
echo.
echo Service Status:
docker-compose ps

echo.
echo ==========================================
echo RazorShield AI is ready!
echo ==========================================
echo.
echo Services running:
echo   * API: http://localhost:8000
echo   * Frontend: http://localhost:80
echo   * PostgreSQL: localhost:5432
echo   * Redis: localhost:6379
echo   * Kafka: localhost:9092
echo.
echo Workers running:
echo   * Risk Worker (fraud detection)
echo   * Analytics Worker (metrics)
echo   * Audit Worker (compliance)
echo.
echo Quick Commands:
echo.
echo   # View worker logs
echo   docker-compose logs -f risk-worker
echo.
echo   # Stop everything
echo   docker-compose --profile scalable down
echo.
echo Documentation:
echo   * WORKERS_QUICKSTART.md - Quick start guide
echo   * IMPLEMENTATION_SUMMARY.md - What was built
echo   * backend\app\workers\README.md - Detailed docs
echo.
pause
