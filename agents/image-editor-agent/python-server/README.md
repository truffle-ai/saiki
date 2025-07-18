# Image Editor MCP Server (Python)

A comprehensive image processing MCP server built with Python, OpenCV, and Pillow.

## Features

### 🖼️ **Viewing & Preview**
- **Image Preview**: Get base64 previews for display in chat interfaces
- **System Viewer**: Open images in the system's default image viewer
- **Image Details**: Show detailed information in a user-friendly format
- **Thumbnail Generation**: Create quick thumbnail versions
- **Image Comparison**: Compare two images and highlight differences
- **Detailed Analysis**: Comprehensive image statistics and color analysis

### ✂️ **Basic Image Operations**
- **Resize**: Resize images with aspect ratio preservation
- **Crop**: Crop images to specified dimensions
- **Format Conversion**: Convert between JPG, PNG, WebP, BMP, TIFF

### 🎨 **Filters & Effects**
- **Basic**: Blur, sharpen, grayscale, invert
- **Artistic**: Sepia, vintage, cartoon, sketch
- **Detection**: Edge detection, emboss

### ⚙️ **Adjustments**
- **Brightness**: Adjust brightness (-100 to 100)
- **Contrast**: Adjust contrast (0.1 to 3.0)

### 📝 **Drawing & Annotations**
- **Basic Shapes**: Draw rectangles, circles, lines, and arrows
- **Text Overlay**: Add text with customizable font, size, color, and position
- **Annotations**: Add text with background for better visibility
- **Shape Properties**: Control thickness, fill, and positioning

### 🔍 **Computer Vision**
- **Face Detection**: Detect faces using Haar cascades
- **Edge Analysis**: Analyze edge density and distribution
- **Contour Detection**: Find and analyze object contours
- **Circle Detection**: Detect circular objects
- **Line Detection**: Detect straight lines using Hough transform

### 🎯 **Advanced Features**
- **Collage Creation**: Create collages with multiple layout types and templates
- **Batch Processing**: Process multiple images with the same operation
- **Filter Discovery**: List all available filters and effects
- **Template System**: Predefined layouts for professional collages

## Setup

### Prerequisites
- Python 3.10 or higher
- `uv` package manager

### Installation

1. **Install uv** (if not already installed):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Install dependencies**:
   ```bash
   cd python-server
   uv sync
   ```

3. **Test the installation**:
   ```bash
   uv run python main.py
   ```

## Usage

### Run the MCP Server
```bash
uv run python main.py
```

### Use with Saiki Agent
```bash
saiki --agent ../image-editor-agent-python.yml
```

## Available Tools

### Viewing & Preview Tools

#### `preview_image`
Get a base64 preview of an image for display in chat interfaces.

**Parameters:**
- `filePath` (string): Path to the image file
- `maxSize` (integer, optional): Maximum size for preview (default: 800)

#### `open_image_viewer`
Open an image in the system's default image viewer.

**Parameters:**
- `filePath` (string): Path to the image file

#### `show_image_details`
Display detailed information about an image in a user-friendly format.

**Parameters:**
- `filePath` (string): Path to the image file

#### `create_thumbnail`
Create a thumbnail version of an image for quick preview.

**Parameters:**
- `filePath` (string): Path to the image file
- `size` (integer, optional): Thumbnail size (default: 150)
- `outputPath` (string, optional): Path for the output thumbnail

#### `compare_images`
Compare two images and show differences.

**Parameters:**
- `image1Path` (string): Path to the first image
- `image2Path` (string): Path to the second image

### Basic Image Operations

#### `get_image_info`
Get detailed information about an image file.

**Parameters:**
- `filePath` (string): Path to the image file to analyze

#### `resize_image`
Resize an image to specified dimensions.

**Parameters:**
- `inputPath` (string): Path to the input image file
- `outputPath` (string, optional): Path for the output image
- `width` (integer, optional): Target width in pixels
- `height` (integer, optional): Target height in pixels
- `maintainAspectRatio` (boolean, optional): Whether to maintain aspect ratio (default: true)
- `quality` (integer, optional): Output quality 1-100 (default: 90)

#### `crop_image`
Crop an image to specified dimensions.

**Parameters:**
- `inputPath` (string): Path to the input image file
- `outputPath` (string, optional): Path for the output image
- `x` (integer): Starting X coordinate for cropping
- `y` (integer): Starting Y coordinate for cropping
- `width` (integer): Width of the crop area
- `height` (integer): Height of the crop area

#### `convert_format`
Convert an image to a different format.

**Parameters:**
- `inputPath` (string): Path to the input image file
- `outputPath` (string, optional): Path for the output image
- `format` (string): Target format (jpg, jpeg, png, webp, bmp, tiff)
- `quality` (integer, optional): Output quality 1-100 for lossy formats (default: 90)

### Filters & Effects

#### `apply_filter`
Apply various filters and effects to an image.

**Parameters:**
- `inputPath` (string): Path to the input image file
- `outputPath` (string, optional): Path for the output image
- `filter` (string): Type of filter (blur, sharpen, grayscale, sepia, invert, edge_detection, emboss, vintage, cartoon, sketch)
- `intensity` (number, optional): Filter intensity 0.1-5.0 (default: 1.0)

#### `list_available_filters`
List all available image filters and effects.

**Parameters:** None

### Adjustments

#### `adjust_brightness_contrast`
Adjust brightness and contrast of an image.

**Parameters:**
- `inputPath` (string): Path to the input image file
- `outputPath` (string, optional): Path for the output image
- `brightness` (number, optional): Brightness adjustment -100 to 100 (default: 0)
- `contrast` (number, optional): Contrast multiplier 0.1 to 3.0 (default: 1.0)

### Text & Overlays

#### `add_text_to_image`
Add text overlay to an image.

**Parameters:**
- `inputPath` (string): Path to the input image file
- `outputPath` (string, optional): Path for the output image
- `text` (string): Text to add to the image
- `x` (integer): X coordinate for text placement
- `y` (integer): Y coordinate for text placement
- `fontSize` (integer, optional): Font size in pixels (default: 30)
- `color` (string, optional): Text color in hex format (default: "#FFFFFF")

### Computer Vision

#### `detect_objects`
Detect objects in an image using OpenCV.

**Parameters:**
- `inputPath` (string): Path to the input image file
- `detectionType` (string): Type of detection (faces, edges, contours, circles, lines)

#### `analyze_image`
Analyze image statistics and properties.

**Parameters:**
- `inputPath` (string): Path to the input image file

### Advanced Features

#### `create_collage`
Create a collage from multiple images.

**Parameters:**
- `imagePaths` (array): List of image file paths
- `layout` (string, optional): Layout type (grid, horizontal, vertical) (default: grid)
- `outputPath` (string, optional): Path for the output collage
- `maxWidth` (integer, optional): Maximum width for individual images (default: 1200)
- `spacing` (integer, optional): Spacing between images (default: 10)

#### `batch_process`
Process multiple images with the same operation.

**Parameters:**
- `inputPaths` (array): List of input image paths
- `operation` (string): Operation type (resize, filter, brightness_contrast, convert)
- `outputDirectory` (string, optional): Output directory for processed images
- Additional parameters depend on the operation type

## Supported Image Formats

- **JPEG/JPG**: Lossy compression, good for photos
- **PNG**: Lossless compression, good for graphics with transparency
- **WebP**: Modern format with good compression
- **BMP**: Uncompressed bitmap format
- **TIFF**: High-quality format for professional use

## Dependencies

- **OpenCV**: Computer vision operations and image processing
- **Pillow**: Image manipulation and text rendering
- **NumPy**: Numerical operations
- **MCP**: Model Context Protocol server implementation

## Troubleshooting

### Common Issues

1. **OpenCV Installation**: If you encounter issues with OpenCV, ensure you have the required system dependencies:
   ```bash
   # macOS
   brew install opencv
   
   # Ubuntu/Debian
   sudo apt-get install libopencv-dev
   ```

2. **Font Issues**: If text rendering fails, the server will fall back to the default font.

3. **Memory Issues**: For large images, consider resizing before processing to avoid memory constraints.

4. **Path Issues**: Ensure all file paths are absolute or correctly relative to the working directory.

## Development

### Running Tests
```bash
uv run python main.py
```

### Code Formatting
```bash
uv run black main.py
uv run ruff check main.py
```

## License

This project is part of the Saiki AI agent framework. 