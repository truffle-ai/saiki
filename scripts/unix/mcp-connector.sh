#!/bin/bash

echo "MCP Connector - Universal Toolkit"
echo "==============================="
echo

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed or not in the PATH."
    echo "Please install Node.js and npm before running this script."
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

while true; do
    clear
    echo "MCP Connector - Universal Toolkit"
    echo "==============================="
    echo
    echo "Choose a connection method:"
    echo
    echo "[Regular Client]"
    echo "1. Connect to any MCP server"
    echo "2. Connect to ClaudeDesktopCommander"
    echo "3. Connect to local MCP host"
    echo
    echo "[AI-Powered Client]"
    echo "4. AI-powered natural language interface"
    echo
    echo "[Testing & Utilities]"
    echo "5. Test ClaudeDesktopCommander connection"
    echo "6. Rebuild project"
    echo "7. Exit"
    echo

    read -p "Enter your choice (1-7): " choice

    case $choice in
        1)
            clear
            echo "Starting universal connector..."
            echo
            ./connect-mcp.sh
            ;;
        2)
            clear
            echo "Connecting to ClaudeDesktopCommander..."
            echo
            ./connect-to-commander.sh
            ;;
        3)
            clear
            echo "Connecting to local MCP host..."
            echo
            ./mcp-cli.sh
            ;;
        4)
            clear
            echo "Starting AI-powered interface..."
            echo
            ./ai-cli.sh
            ;;
        5)
            clear
            echo "Testing ClaudeDesktopCommander connection..."
            echo
            ./test-commander.sh
            ;;
        6)
            clear
            echo "Rebuilding the project..."
            npm run build
            if [ $? -ne 0 ]; then
                echo "Error: Failed to build the project."
            else
                echo "Project rebuilt successfully."
            fi
            read -p "Press Enter to continue..."
            ;;
        7)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo "Invalid choice. Please try again."
            sleep 2
            ;;
    esac
done 