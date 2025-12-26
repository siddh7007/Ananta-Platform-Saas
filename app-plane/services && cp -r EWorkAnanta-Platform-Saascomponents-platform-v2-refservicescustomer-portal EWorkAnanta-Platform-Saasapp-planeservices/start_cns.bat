@echo off
REM CNS Service Startup Script - Windows (Host-based Development)
REM NOTE: For production, use Docker Compose instead
REM Clears system environment variables that conflict with .env file

echo Starting CNS Service on Host...
echo WARNING: This runs CNS on the host. For production, use Docker Compose.
echo.

REM Load CNS_PORT from .env or use default
if not defined CNS_PORT set CNS_PORT=27800

REM Clear conflicting environment variables from docker-compose
set DATABASE_URL=
set CORS_ORIGINS=
set ALLOWED_FILE_EXTENSIONS=

REM Start CNS service
cd /d "%~dp0"
echo Starting on port %CNS_PORT%...
python -m uvicorn app.main:app --host 0.0.0.0 --port %CNS_PORT% --reload
