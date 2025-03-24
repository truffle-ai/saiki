@echo off
setlocal enabledelayedexpansion

echo MCP Command Line Interface
echo =========================
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: npm is not installed or not in the PATH.
    echo Please install Node.js and npm before running this script.
    pause
    exit /b 1
)

REM Check if the project is built
if not exist "dist" (
    echo Building the project...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install dependencies.
        pause
        exit /b 1
    )
    
    call npm run build
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to build the project.
        pause
        exit /b 1
    )
    echo Project built successfully.
    echo.
)

echo Starting MCP client with connection to a local server...
echo.
echo When connected, try these commands:
echo   list-tools
echo   tool calculate
echo   call calculate {"operation":"add","a":5,"b":3}
echo   call get_weather {"location":"New York","units":"metric"}
echo   server-info
echo   help
echo   exit
echo.
echo Note: Server logging is sent to stderr and should be visible
echo       when the server is spawned.
echo.

node dist\client.js connect "node" "dist\host.js" "stdio"
