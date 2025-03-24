@echo off
echo AI-Powered MCP Client
echo =====================
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ERROR: .env file not found.
    echo Please create a .env file with your OpenAI API key.
    echo You can copy .env.example and fill in your API key.
    echo.
    echo Example .env content:
    echo OPENAI_API_KEY=your_openai_api_key_here
    echo.
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

echo Starting AI-powered MCP client connected to ClaudeDesktopCommander...
echo.
echo This client uses OpenAI to interpret your commands and call appropriate MCP tools.
echo You can interact with the ClaudeDesktopCommander tools using natural language.
echo.
echo Examples:
echo - "List all files in the current directory"
echo - "Show system information"
echo - "Create a new file called test.txt with 'Hello World' as content"
echo - "Run a simple python script that prints numbers from 1 to 10"
echo.

node dist\ai.js connect "C:\Program Files\nodejs\npx.cmd" -- -y @wonderwhy-er/desktop-commander -v
