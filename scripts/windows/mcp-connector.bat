@echo off
setlocal enabledelayedexpansion

echo MCP Connector - Universal Toolkit
echo ===============================
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
echo MCP Connector - Universal Toolkit
echo ===============================
echo.
echo Choose a connection method:
echo.
echo [Regular Client]
echo 1. Interactive menu (run-mcp.bat)
echo 2. Connect to any MCP server (connect-mcp.bat)
echo 3. Connect to ClaudeDesktopCommander (connect-to-commander.bat)
echo 4. Connect to local MCP host (mcp-cli.bat)
echo.
echo [AI-Powered Client]
echo 5. AI-powered natural language interface (ai-cli.bat)
echo.
echo [Testing & Utilities]
echo 6. Test ClaudeDesktopCommander connection (test-commander.bat)
echo 7. Rebuild project (npm run build)
echo 8. Exit
echo.

set /p choice="Enter your choice (1-8): "

if "%choice%"=="1" (
    cls
    echo Starting interactive menu...
    echo.
    call run-mcp.bat
    goto menu
)

if "%choice%"=="2" (
    cls
    echo Starting universal connector...
    echo.
    call connect-mcp.bat
    goto menu
)

if "%choice%"=="3" (
    cls
    echo Connecting to ClaudeDesktopCommander...
    echo.
    call connect-to-commander.bat
    goto menu
)

if "%choice%"=="4" (
    cls
    echo Connecting to local MCP host...
    echo.
    call mcp-cli.bat
    goto menu
)

if "%choice%"=="5" (
    cls
    echo Starting AI-powered interface...
    echo.
    call ai-cli.bat
    goto menu
)

if "%choice%"=="6" (
    cls
    echo Testing ClaudeDesktopCommander connection...
    echo.
    call test-commander.bat
    goto menu
)

if "%choice%"=="7" (
    cls
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

if "%choice%"=="8" (
    echo Exiting...
    exit /b 0
)

echo Invalid choice. Please try again.
timeout /t 2 >nul
goto menu