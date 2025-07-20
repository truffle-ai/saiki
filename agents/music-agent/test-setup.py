#!/usr/bin/env python3

"""
Test script to verify Music Creator MCP Server setup
"""

import sys
import importlib

def test_import(module_name, package_name=None):
    """Test if a module can be imported"""
    try:
        importlib.import_module(module_name)
        print(f"✅ {package_name or module_name}")
        return True
    except ImportError as e:
        print(f"❌ {package_name or module_name}: {e}")
        return False

def main():
    print("🎵 Testing Music Creator MCP Server Dependencies...")
    print("=" * 50)
    
    # Core dependencies
    dependencies = [
        ("librosa", "librosa"),
        ("pydub", "pydub"),
        ("music21", "music21"),
        ("numpy", "numpy"),
        ("scipy", "scipy"),
        ("matplotlib", "matplotlib"),
        ("soundfile", "soundfile"),
        ("pretty_midi", "pretty_midi"),
        ("sklearn", "scikit-learn"),
        ("mcp", "MCP SDK"),
    ]
    
    all_passed = True
    
    for module, name in dependencies:
        if not test_import(module, name):
            all_passed = False
    
    print("\n" + "=" * 50)
    
    if all_passed:
        print("🎉 All dependencies installed successfully!")
        print("\n🎼 You can now run the Music Creator MCP Server:")
        print("   uv run python main.py")
    else:
        print("❌ Some dependencies failed to import.")
        print("\n🔧 Please run the setup script:")
        print("   ./setup-python-server.sh")
        sys.exit(1)
    
    # Test basic functionality
    print("\n🧪 Testing basic functionality...")
    
    try:
        import librosa
        import pydub
        import music21
        
        # Test librosa
        print("✅ librosa: Audio analysis library loaded")
        
        # Test pydub
        print("✅ pydub: Audio processing library loaded")
        
        # Test music21
        print("✅ music21: Music notation library loaded")
        
        # Test MCP
        from mcp.server.fastmcp import FastMCP
        print("✅ MCP: Model Context Protocol SDK loaded")
        
        print("\n🎵 Music Creator MCP Server is ready to use!")
        
    except Exception as e:
        print(f"❌ Error testing functionality: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 