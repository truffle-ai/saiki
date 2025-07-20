#!/bin/bash

# Music Creator MCP Server Setup Script
# This script sets up the Python environment and installs dependencies

set -e

echo "🎵 Setting up Music Creator MCP Server..."

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo "❌ Error: pyproject.toml not found. Please run this script from the python-server directory."
    exit 1
fi

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ Error: uv is not installed. Please install uv first:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo "📦 Installing dependencies with uv..."
uv sync

echo "🔧 Setting up virtual environment..."
uv venv

echo "✅ Music Creator MCP Server setup complete!"
echo ""
echo "🎼 To run the server:"
echo "   uv run python main.py"
echo ""
echo "🎵 To test the server:"
echo "   uv run python -c \"import librosa; import pydub; import music21; print('✅ All dependencies installed successfully!')\""
echo ""
echo "📚 For more information, see README.md" 