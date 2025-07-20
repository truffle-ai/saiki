#!/bin/bash

# Setup script for Python Image Editor MCP Server
# This script installs dependencies and tests the server

set -e

echo "🚀 Setting up Python Image Editor MCP Server..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "📦 Installing uv package manager..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    echo "✅ uv installed successfully"
else
    echo "✅ uv is already installed"
fi

# Navigate to python-server directory
cd python-server

echo "📦 Installing Python dependencies..."
uv sync

echo "🧪 Testing OpenCV and Pillow installation..."
if [ -f "test_basic.py" ]; then
  python3 test_basic.py
  echo "✅ Basic tests passed!"
else
  echo "⚠️  test_basic.py not found, skipping basic tests"
fi

echo "🧪 Testing agent configuration..."
if [ -f "test-agent-config.py" ]; then
  if python3 test-agent-config.py; then
    echo "✅ Agent configuration test passed!"
  else
    echo "❌ Agent configuration test failed. Please check the error messages above."
    exit 1
  fi
else
  echo "⚠️  test-agent-config.py not found, skipping configuration test"
fi

echo "🧪 Testing agent from root directory..."
if [ -f "test-from-root.py" ]; then
  if python3 test-from-root.py; then
    echo "✅ Root directory test passed!"
  else
    echo "❌ Root directory test failed. Please check the error messages above."
    exit 1
  fi
else
  echo "⚠️  test-from-root.py not found, skipping root directory test"
fi

echo ""
echo "🎉 Python Image Editor MCP Server setup complete!"
echo ""
echo "📝 Usage:"
echo "  1. Run the server: cd python-server && uv run python main.py"
echo "  2. Use with Saiki: saiki --agent image-editor-agent-python.yml"
echo ""
echo "📚 For more information, see python-server/README.md" 