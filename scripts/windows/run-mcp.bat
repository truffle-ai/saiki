@echo off
setlocal enabledelayedexpansion

echo MCP Host and Client CLI Tool Runner
echo ===================================
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

:menu
cls
echo MCP Host and Client CLI Tool Runner
echo ===================================
echo.
echo Choose an option:
echo 1. Start MCP Host (stdio transport)
echo 2. Connect to MCP Host with Client
echo 3. Test Connection (start both host and client)
echo 4. Rebuild Project
echo 5. Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    start "MCP Host (stdio)" cmd /k "node dist\host.js stdio"
    echo MCP Host with stdio transport started in a new window.
    timeout /t 2 >nul
    goto menu
)

if "%choice%"=="2" (
    echo Starting MCP Client with stdio transport...
    start "MCP Client (stdio)" cmd /k "node dist\client.js stdio "node dist\host.js stdio""
    timeout /t 2 >nul
    goto menu
)

if "%choice%"=="3" (
    echo Starting test with both host and client...
    start "MCP Host (stdio)" cmd /k "node dist\host.js stdio"
    timeout /t 2 >nul
    start "MCP Client (stdio)" cmd /k "node dist\client.js stdio "node dist\host.js stdio""
    timeout /t 2 >nul
    goto menu
)

if "%choice%"=="4" (
    echo Rebuilding the project...
    call npm run build
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to build the project.
    ) else (
        echo Project rebuilt successfully.
    )
    pause
    goto menu
)

if "%choice%"=="5" (
    echo Exiting...
    exit /b 0
)

echo Invalid choice. Please try again.
timeout /t 2 >nul
goto menu