#!/bin/bash

echo "AI-Powered MCP Client"
echo "===================="
echo

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found."
    echo "Please create a .env file with your OpenAI API key."
    echo "You can copy .env.example and fill in your API key."
    echo
    echo "Example .env content:"
    echo "OPENAI_API_KEY=your_openai_api_key_here"
    echo
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if the project is built
if [ ! -d "dist" ]; then
    echo "Building the project..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install dependencies."
        read -p "Press Enter to exit..."
        exit 1
    fi
    
    npm run build
    if [ $? -ne 0 ]; then
        echo "Error: Failed to build the project."
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo "Project built successfully."
    echo
fi

echo "Starting AI-powered MCP client connected to ClaudeDesktopCommander..."
echo
echo "This client uses OpenAI to interpret your commands and call appropriate MCP tools."
echo "You can interact with the ClaudeDesktopCommander tools using natural language."
echo
echo "Examples:"
echo "- \"List all files in the current directory\""
echo "- \"Show system information\""
echo "- \"Create a new file called test.txt with 'Hello World' as content\""
echo "- \"Run a simple python script that prints numbers from 1 to 10\""
echo

node dist/ai.js connect "npx" -- -y @wonderwhy-er/desktop-commander -v 