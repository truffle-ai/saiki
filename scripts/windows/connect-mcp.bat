@echo off
setlocal enabledelayedexpansion

echo Universal MCP Client Connector
echo =============================
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

set COMMAND=%~1
set ARGS=%~2 %~3 %~4 %~5 %~6 %~7 %~8 %~9

if "%COMMAND%"=="" (
    echo This script connects to any MCP server by providing the command to run it.
    echo.
    echo Usage:
    echo   connect-mcp.bat [command] [args...]
    echo.
    echo Examples:
    echo   connect-mcp.bat npx -y @wonderwhy-er/desktop-commander
    echo   connect-mcp.bat node dist\host.js stdio
    echo   connect-mcp.bat npx -y @modelcontextprotocol/server-filesystem C:\path\to\dir
    echo.
    set /p COMMAND=Enter server command: 
    
    if "!COMMAND!"=="" (
        echo No command provided. Exiting.
        exit /b 1
    )
    
    set ARGS=
    set /p ARGS=Enter arguments (space-separated): 
)

echo.
echo Connecting to MCP server: %COMMAND% %ARGS%
echo.

node dist\client.js connect "%COMMAND%" %ARGS%
