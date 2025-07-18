# Image Editor Agent - Complete Setup Guide

This guide will help you set up and use the Image Editor Agent, a comprehensive AI-powered image processing tool.

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- OpenCV development libraries
- Saiki CLI installed and configured

### 2. Automated Setup (Recommended)
```bash
# Run the automated setup script
./agents/image-editor-agent/setup-image-editor.sh
```

### 3. Manual Setup
If you prefer manual setup or encounter issues:

#### Install OpenCV Dependencies

**macOS:**
```bash
brew install opencv
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y libopencv-dev python3-opencv
```

**Windows:**
Download and install OpenCV from https://opencv.org/releases/

#### Install Node.js Dependencies
```bash
cd agents/image-editor-agent/image-server
npm install
npm run build
```

### 4. Test the Setup
```bash
# Create a test image and verify the setup
node agents/image-editor-agent/test-server.js
```

## 📁 Project Structure

```
agents/image-editor-agent/
├── image-server/                 # MCP server implementation
│   ├── src/
│   │   └── index.ts             # Main server code
│   ├── package.json             # Dependencies
│   ├── tsconfig.json            # TypeScript config
│   └── dist/                    # Built server (after npm run build)
├── image-editor-agent.yml       # Saiki agent configuration
├── README.md                    # Comprehensive documentation
├── example-usage.md             # Usage examples
├── setup-image-editor.sh        # Automated setup script
├── test-server.js               # Test script
├── test-images/                 # Test images directory
└── SETUP.md                     # This file
```

## 🛠️ Available Tools

The Image Editor Agent provides 8 powerful tools:

### Core Operations
1. **`get_image_info`** - Get detailed image metadata
2. **`resize_image`** - Resize images with aspect ratio preservation
3. **`crop_image`** - Crop images to specific dimensions
4. **`convert_format`** - Convert between image formats

### Enhancement
5. **`adjust_brightness_contrast`** - Adjust brightness and contrast
6. **`apply_filter`** - Apply filters (blur, sharpen, grayscale, sepia, etc.)
7. **`add_text_to_image`** - Add text overlays

### Computer Vision
8. **`detect_objects`** - Detect faces, edges, contours, circles

## 🎯 Usage Examples

### Start the Agent
```bash
# Use the agent directly
saiki --agent agents/image-editor-agent/image-editor-agent.yml
```

### Basic Commands
```
# Get image information
"Get information about the image at /path/to/image.jpg"

# Resize an image
"Resize the image to 800x600 pixels while maintaining aspect ratio"

# Apply a filter
"Apply a sepia filter to make the image look vintage"

# Add text
"Add the text 'Hello World' at coordinates (50, 50) with white color"

# Convert format
"Convert the image to WebP format for better compression"
```

## 🔧 Configuration

### Agent Configuration (`image-editor-agent.yml`)
- **LLM Provider**: OpenAI GPT-4o
- **MCP Server**: Local stdio connection to the image server
- **Storage**: SQLite database for session persistence

### MCP Server Configuration
- **Transport**: stdio (standard input/output)
- **Tools**: 8 comprehensive image processing tools
- **Temporary Storage**: Automatic `temp_images/` directory creation

## 🐛 Troubleshooting

### Common Issues

#### OpenCV Installation Problems
**Error**: `Cannot find module 'opencv4nodejs'`
**Solution**: 
```bash
# macOS
brew install opencv
cd agents/image-editor-agent/image-server
npm rebuild opencv4nodejs

# Linux
sudo apt-get install libopencv-dev
npm rebuild opencv4nodejs
```

#### Permission Issues
**Error**: `EACCES: permission denied`
**Solution**:
```bash
# Ensure write permissions
chmod +x agents/image-editor-agent/setup-image-editor.sh
chmod +x agents/image-editor-agent/test-server.js
```

#### Build Issues
**Error**: `TypeScript compilation failed`
**Solution**:
```bash
cd agents/image-editor-agent/image-server
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Performance Tips

1. **Large Images**: Resize before processing to improve performance
2. **Batch Processing**: Process multiple images sequentially
3. **Memory Usage**: Monitor system memory during heavy operations
4. **Output Quality**: Use appropriate quality settings (90% is usually sufficient)

## 📊 Supported Formats

### Input Formats
- JPG/JPEG
- PNG
- BMP
- TIFF
- WebP

### Output Formats
- JPG/JPEG (configurable quality)
- PNG (lossless)
- WebP (configurable quality)
- BMP (lossless)
- TIFF (lossless)

## 🔄 Development Workflow

### Making Changes
1. Edit `agents/image-editor-agent/image-server/src/index.ts`
2. Run `npm run build` to compile
3. Test with `node test-server.js`
4. Restart the agent to see changes

### Adding New Tools
1. Add tool definition in `registerTools()` method
2. Implement the tool logic
3. Add proper error handling
4. Update documentation
5. Test thoroughly

## 📚 Additional Resources

- **README.md**: Comprehensive feature documentation
- **example-usage.md**: Detailed usage examples
- **OpenCV Documentation**: https://docs.opencv.org/
- **Sharp Documentation**: https://sharp.pixelplumbing.com/
- **MCP Specification**: https://modelcontextprotocol.io/

## 🤝 Contributing

To contribute to the Image Editor Agent:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## 📄 License

This project is part of the Saiki AI Agent framework and follows the same licensing terms.

---

**Need Help?** Check the troubleshooting section above or create an issue in the repository. 