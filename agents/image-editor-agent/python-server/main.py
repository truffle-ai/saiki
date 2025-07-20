#!/usr/bin/env python3

"""
Image Editor MCP Server
A comprehensive image processing server using OpenCV and Pillow
"""

import base64
import json
import os
import io
import tempfile
import atexit
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from mcp.server.fastmcp import FastMCP
from PIL import Image, ImageDraw, ImageFont

# Create an MCP server
mcp = FastMCP("image-editor")

# Create temp directory using tempfile
_temp_dir = tempfile.mkdtemp(prefix="image_editor_")
temp_dir = Path(_temp_dir)

def _cleanup_temp_dir():
    import shutil
    shutil.rmtree(_temp_dir, ignore_errors=True)

atexit.register(_cleanup_temp_dir)

def _validate_image_file(file_path: str) -> None:
    """Validate that the image file exists and is supported."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    supported_formats = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
    file_ext = Path(file_path).suffix.lower()
    
    if file_ext not in supported_formats:
        raise ValueError(f"Unsupported image format: {file_ext}. Supported formats: {', '.join(supported_formats)}")

def _get_image_info(file_path: str) -> Dict[str, Any]:
    """Get detailed information about an image."""
    _validate_image_file(file_path)
    
    # Use OpenCV to get image info
    img = cv2.imread(file_path)
    if img is None:
        raise ValueError(f"Could not read image: {file_path}")
    
    file_size = os.path.getsize(file_path)
    
    return {
        "width": img.shape[1],
        "height": img.shape[0],
        "channels": img.shape[2] if len(img.shape) > 2 else 1,
        "fileSize": file_size,
        "fileName": Path(file_path).name,
        "format": Path(file_path).suffix.lower()[1:]
    }

def _image_to_base64(file_path: str, max_size: Optional[int] = None) -> str:
    """Convert image to base64 string for preview."""
    with Image.open(file_path) as img:
        # Resize if max_size is specified
        if max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Save to bytes
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85)
        buffer.seek(0)
        
        # Convert to base64
        return base64.b64encode(buffer.getvalue()).decode('utf-8')

@mcp.tool()
def get_image_info(filePath: str) -> str:
    """Get detailed information about an image file including dimensions, format, and file size"""
    info = _get_image_info(filePath)
    return json.dumps(info, indent=2)

@mcp.tool()
def preview_image(filePath: str, maxSize: Optional[int] = 800) -> str:
    """Get a base64 preview of an image for display in the UI"""
    _validate_image_file(filePath)
    
    try:
        base64_data = _image_to_base64(filePath, maxSize)
        info = _get_image_info(filePath)
        
        result = {
            "success": True,
            "preview": f"data:image/jpeg;base64,{base64_data}",
            "imageInfo": info,
            "previewSize": maxSize if maxSize else "original"
        }
        
        return json.dumps(result, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def create_thumbnail(filePath: str, size: int = 150, outputPath: Optional[str] = None) -> str:
    """Create a thumbnail version of an image for quick preview"""
    _validate_image_file(filePath)
    
    if not outputPath:
        input_ext = Path(filePath).suffix
        base_name = Path(filePath).stem
        outputPath = str(temp_dir / f"{base_name}_thumb{input_ext}")
    
    with Image.open(filePath) as img:
        # Create thumbnail
        img.thumbnail((size, size), Image.Resampling.LANCZOS)
        img.save(outputPath, quality=90)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info,
        "thumbnailSize": size
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def compare_images(image1Path: str, image2Path: str) -> str:
    """Compare two images and show differences"""
    _validate_image_file(image1Path)
    _validate_image_file(image2Path)
    
    # Load images
    img1 = cv2.imread(image1Path)
    img2 = cv2.imread(image2Path)
    
    # Resize to same size if different
    if img1.shape != img2.shape:
        img2 = cv2.resize(img2, (img1.shape[1], img1.shape[0]))
    
    # Calculate differences
    diff = cv2.absdiff(img1, img2)
    gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    
    # Calculate similarity percentage
    total_pixels = gray_diff.shape[0] * gray_diff.shape[1]
    different_pixels = cv2.countNonZero(gray_diff)
    similarity = ((total_pixels - different_pixels) / total_pixels) * 100
    
    # Save difference image
    diff_path = str(temp_dir / f"comparison_diff_{Path(image1Path).stem}_{Path(image2Path).stem}.jpg")
    cv2.imwrite(diff_path, diff)
    
    result = {
        "similarity": round(similarity, 2),
        "differentPixels": int(different_pixels),
        "totalPixels": int(total_pixels),
        "differenceImage": diff_path,
        "image1Info": _get_image_info(image1Path),
        "image2Info": _get_image_info(image2Path)
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def open_image_viewer(filePath: str) -> str:
    """Open an image in the system's default image viewer"""
    _validate_image_file(filePath)
    
    try:
        import subprocess
        import platform
        
        system = platform.system()
        
        if system == "Darwin":  # macOS
            subprocess.run(["open", filePath], check=True)
        elif system == "Windows":
            subprocess.run(["start", filePath], shell=True, check=True)
        elif system == "Linux":
            subprocess.run(["xdg-open", filePath], check=True)
        else:
            raise Exception(f"Unsupported operating system: {system}")
        
        info = _get_image_info(filePath)
        result = {
            "success": True,
            "message": f"Image opened in system viewer: {info['fileName']}",
            "imagePath": filePath,
            "imageInfo": info
        }
        
        return json.dumps(result, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Failed to open image viewer: {str(e)}"}, indent=2)

@mcp.tool()
def show_image_details(filePath: str) -> str:
    """Display detailed information about an image in a user-friendly format"""
    _validate_image_file(filePath)
    
    info = _get_image_info(filePath)
    
    # Calculate file size in human-readable format
    size_bytes = info["fileSize"]
    if size_bytes < 1024:
        size_str = f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        size_str = f"{size_bytes / 1024:.1f} KB"
    else:
        size_str = f"{size_bytes / (1024 * 1024):.1f} MB"
    
    result = {
        "success": True,
        "message": f"Image details for: {info['fileName']}",
        "details": {
            "filename": info["fileName"],
            "dimensions": f"{info['width']} × {info['height']} pixels",
            "fileSize": size_str,
            "format": info["format"].upper(),
            "channels": f"{info['channels']} {'channel' if info['channels'] == 1 else 'channels'}",
            "aspectRatio": f"{info['width'] / info['height']:.2f}:1"
        },
        "imagePath": filePath
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def resize_image(
    inputPath: str,
    outputPath: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    maintainAspectRatio: bool = True,
    quality: int = 90
) -> str:
    """Resize an image to specified dimensions while maintaining aspect ratio"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        input_ext = Path(inputPath).suffix
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}_resized{input_ext}")
    
    # Use PIL for resizing
    with Image.open(inputPath) as img:
        if width and height:
            if maintainAspectRatio:
                img.thumbnail((width, height), Image.Resampling.LANCZOS)
            else:
                img = img.resize((width, height), Image.Resampling.LANCZOS)
        elif width:
            ratio = width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((width, new_height), Image.Resampling.LANCZOS)
        elif height:
            ratio = height / img.height
            new_width = int(img.width * ratio)
            img = img.resize((new_width, height), Image.Resampling.LANCZOS)
        
        # Save with quality setting
        img.save(outputPath, quality=quality)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def apply_filter(
    inputPath: str,
    filter: str,
    outputPath: Optional[str] = None,
    intensity: float = 1.0
) -> str:
    """Apply various filters and effects to an image"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        input_ext = Path(inputPath).suffix
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}_{filter}{input_ext}")
    
    # Use OpenCV for most filters
    img = cv2.imread(inputPath)
    
    if filter == "blur":
        kernel_size = int(5 + intensity * 10)
        if kernel_size % 2 == 0:
            kernel_size += 1
        processed = cv2.GaussianBlur(img, (kernel_size, kernel_size), 0)
    elif filter == "sharpen":
        kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]]) * intensity
        processed = cv2.filter2D(img, -1, kernel)
    elif filter == "grayscale":
        processed = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        processed = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
    elif filter == "sepia":
        # Sepia filter using color matrix
        kernel = np.array([
            [0.393, 0.769, 0.189],
            [0.349, 0.686, 0.168],
            [0.272, 0.534, 0.131]
        ])
        processed = cv2.transform(img, kernel)
    elif filter == "invert":
        processed = cv2.bitwise_not(img)
    elif filter == "edge_detection":
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        processed = cv2.Canny(gray, 50, 150)
        processed = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
    elif filter == "emboss":
        kernel = np.array([[-2, -1, 0], [-1, 1, 1], [0, 1, 2]]) * intensity
        processed = cv2.filter2D(img, -1, kernel)
    elif filter == "vintage":
        # Vintage effect: desaturate and add warm tones
        processed = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        processed[:, :, 1] = processed[:, :, 1] * 0.7  # Reduce saturation
        processed = cv2.cvtColor(processed, cv2.COLOR_HSV2BGR)
        # Add warm tone
        processed = processed * [1.1, 0.9, 0.8]  # Increase red, decrease green and blue
        processed = np.clip(processed, 0, 255).astype(np.uint8)  # Clamp to [0, 255]
    elif filter == "cartoon":
        # Cartoon effect
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.medianBlur(gray, 5)
        edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 9)
        color = cv2.bilateralFilter(img, 9, 300, 300)
        processed = cv2.bitwise_and(color, color, mask=edges)
    elif filter == "sketch":
        # Pencil sketch effect
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        inv = 255 - gray
        blur = cv2.GaussianBlur(inv, (21, 21), 0)
        processed = cv2.divide(gray, 255 - blur, scale=256)
        processed = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
    else:
        raise ValueError(f"Unknown filter: {filter}")
    
    cv2.imwrite(outputPath, processed)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def crop_image(
    inputPath: str,
    x: int,
    y: int,
    width: int,
    height: int,
    outputPath: Optional[str] = None
) -> str:
    """Crop an image to specified dimensions"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        input_ext = Path(inputPath).suffix
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}_cropped{input_ext}")
    
    # Use OpenCV for cropping
    img = cv2.imread(inputPath)
    cropped = img[y:y+height, x:x+width]
    cv2.imwrite(outputPath, cropped)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def adjust_brightness_contrast(
    inputPath: str,
    outputPath: Optional[str] = None,
    brightness: float = 0,
    contrast: float = 1.0
) -> str:
    """Adjust brightness and contrast of an image"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        input_ext = Path(inputPath).suffix
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}_adjusted{input_ext}")
    
    # Use OpenCV for brightness/contrast adjustment
    img = cv2.imread(inputPath)
    adjusted = cv2.convertScaleAbs(img, alpha=contrast, beta=brightness)
    cv2.imwrite(outputPath, adjusted)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def add_text_to_image(
    inputPath: str,
    text: str,
    x: int,
    y: int,
    outputPath: Optional[str] = None,
    fontSize: int = 30,
    color: str = "#FFFFFF"
) -> str:
    """Add text overlay to an image"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        input_ext = Path(inputPath).suffix
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}_with_text{input_ext}")
    
    # Use PIL for text rendering
    with Image.open(inputPath) as img:
        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        draw = ImageDraw.Draw(img)
        
        # Try to use a default font, fallback to default if not available
        try:
            import sys
            if sys.platform == "win32":
                font_path = "C:/Windows/Fonts/arial.ttf"
            elif sys.platform == "darwin":
                font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
            else:
                font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
            font = ImageFont.truetype(font_path, fontSize)
        except IOError:
            font = ImageFont.load_default()
        
        # Convert hex color to RGB
        color_rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
        
        draw.text((x, y), text, fill=color_rgb, font=font)
        img.save(outputPath)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def draw_rectangle(
    inputPath: str,
    x: int,
    y: int,
    width: int,
    height: int,
    outputPath: Optional[str] = None,
    color: str = "#FF0000",
    thickness: int = 3,
    filled: bool = False
) -> str:
    """Draw a rectangle on an image"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        input_ext = Path(inputPath).suffix
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}_with_rectangle{input_ext}")
    
    # Use OpenCV for drawing
    img = cv2.imread(inputPath)
    
    # Convert hex color to BGR (OpenCV format)
    color_rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
    color_bgr = (color_rgb[2], color_rgb[1], color_rgb[0])  # RGB to BGR
    
    if filled:
        cv2.rectangle(img, (x, y), (x + width, y + height), color_bgr, -1)
    else:
        cv2.rectangle(img, (x, y), (x + width, y + height), color_bgr, thickness)
    
    cv2.imwrite(outputPath, img)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info,
        "shape": {
            "type": "rectangle",
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "color": color,
            "thickness": thickness,
            "filled": filled
        }
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def draw_circle(
    inputPath: str,
    centerX: int,
    centerY: int,
    radius: int,
    outputPath: Optional[str] = None,
    color: str = "#00FF00",
    thickness: int = 3,
    filled: bool = False
) -> str:
    """Draw a circle on an image"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        input_ext = Path(inputPath).suffix
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}_with_circle{input_ext}")
    
    # Use OpenCV for drawing
    img = cv2.imread(inputPath)
    
    # Convert hex color to BGR (OpenCV format)
    color_rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
    color_bgr = (color_rgb[2], color_rgb[1], color_rgb[0])  # RGB to BGR
    
    if filled:
        cv2.circle(img, (centerX, centerY), radius, color_bgr, -1)
    else:
        cv2.circle(img, (centerX, centerY), radius, color_bgr, thickness)
    
    cv2.imwrite(outputPath, img)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info,
        "shape": {
            "type": "circle",
            "centerX": centerX,
            "centerY": centerY,
            "radius": radius,
            "color": color,
            "thickness": thickness,
            "filled": filled
        }
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def draw_line(
    inputPath: str,
    startX: int,
    startY: int,
    endX: int,
    endY: int,
    outputPath: Optional[str] = None,
    color: str = "#0000FF",
    thickness: int = 2
) -> str:
    """Draw a line on an image"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        input_ext = Path(inputPath).suffix
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}_with_line{input_ext}")
    
    # Use OpenCV for drawing
    img = cv2.imread(inputPath)
    
    # Convert hex color to BGR (OpenCV format)
    color_rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
    color_bgr = (color_rgb[2], color_rgb[1], color_rgb[0])  # RGB to BGR
    
    cv2.line(img, (startX, startY), (endX, endY), color_bgr, thickness)
    
    cv2.imwrite(outputPath, img)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info,
        "shape": {
            "type": "line",
            "startX": startX,
            "startY": startY,
            "endX": endX,
            "endY": endY,
            "color": color,
            "thickness": thickness
        }
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def draw_arrow(
    inputPath: str,
    startX: int,
    startY: int,
    endX: int,
    endY: int,
    outputPath: Optional[str] = None,
    color: str = "#FF00FF",
    thickness: int = 2,
    tipLength: float = 0.3
) -> str:
    """Draw an arrow on an image"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        input_ext = Path(inputPath).suffix
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}_with_arrow{input_ext}")
    
    # Use OpenCV for drawing
    img = cv2.imread(inputPath)
    
    # Convert hex color to BGR (OpenCV format)
    color_rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
    color_bgr = (color_rgb[2], color_rgb[1], color_rgb[0])  # RGB to BGR
    
    cv2.arrowedLine(img, (startX, startY), (endX, endY), color_bgr, thickness, tipLength=tipLength)
    
    cv2.imwrite(outputPath, img)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info,
        "shape": {
            "type": "arrow",
            "startX": startX,
            "startY": startY,
            "endX": endX,
            "endY": endY,
            "color": color,
            "thickness": thickness,
            "tipLength": tipLength
        }
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def add_annotation(
    inputPath: str,
    text: str,
    x: int,
    y: int,
    outputPath: Optional[str] = None,
    fontSize: int = 20,
    textColor: str = "#FFFFFF",
    backgroundColor: str = "#000000",
    padding: int = 5
) -> str:
    """Add an annotation with background to an image"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        input_ext = Path(inputPath).suffix
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}_with_annotation{input_ext}")
    
    # Use PIL for text rendering with background
    with Image.open(inputPath) as img:
        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        draw = ImageDraw.Draw(img)
        
        # Try to use a default font, fallback to default if not available
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", fontSize)
        except:
            font = ImageFont.load_default()
        
        # Get text size
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Convert colors to RGB
        text_color_rgb = tuple(int(textColor[i:i+2], 16) for i in (1, 3, 5))
        bg_color_rgb = tuple(int(backgroundColor[i:i+2], 16) for i in (1, 3, 5))
        
        # Draw background rectangle
        bg_rect = [
            x - padding,
            y - padding,
            x + text_width + padding,
            y + text_height + padding
        ]
        draw.rectangle(bg_rect, fill=bg_color_rgb)
        
        # Draw text
        draw.text((x, y), text, fill=text_color_rgb, font=font)
        
        img.save(outputPath)
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info,
        "annotation": {
            "text": text,
            "x": x,
            "y": y,
            "fontSize": fontSize,
            "textColor": textColor,
            "backgroundColor": backgroundColor,
            "padding": padding
        }
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def convert_format(
    inputPath: str,
    format: str,
    outputPath: Optional[str] = None,
    quality: int = 90
) -> str:
    """Convert an image to a different format"""
    _validate_image_file(inputPath)
    
    if not outputPath:
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}.{format}")
    
    # Use PIL for format conversion
    with Image.open(inputPath) as img:
        if format in ['jpg', 'jpeg']:
            img.save(outputPath, 'JPEG', quality=quality)
        elif format == 'png':
            img.save(outputPath, 'PNG')
        elif format == 'webp':
            img.save(outputPath, 'WEBP', quality=quality)
        elif format == 'bmp':
            img.save(outputPath, 'BMP')
        elif format == 'tiff':
            img.save(outputPath, 'TIFF')
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    info = _get_image_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "imageInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def detect_objects(inputPath: str, detectionType: str) -> str:
    """Detect objects in an image using OpenCV"""
    _validate_image_file(inputPath)
    
    img = cv2.imread(inputPath)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Normalize detection type to handle both singular and plural forms
    detectionType = detectionType.lower().strip()
    if detectionType in ["face", "faces", "face/faces"]:
        detectionType = "faces"
    elif detectionType in ["edge", "edges", "edge/edges"]:
        detectionType = "edges"
    elif detectionType in ["contour", "contours", "contour/contours"]:
        detectionType = "contours"
    elif detectionType in ["circle", "circles", "circle/circles"]:
        detectionType = "circles"
    elif detectionType in ["line", "lines", "line/lines"]:
        detectionType = "lines"
    
    results = {}
    
    if detectionType == "faces":
        # Load face cascade
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # More sensitive parameters for better detection
        faces = face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.05,  # Smaller scale factor for more sensitive detection
            minNeighbors=3,    # Fewer neighbors for more sensitive detection
            minSize=(20, 20),  # Minimum face size
            maxSize=(0, 0)     # No maximum size limit
        )
        
        results = {
            "type": "faces",
            "count": len(faces),
            "locations": [{"x": int(x), "y": int(y), "width": int(w), "height": int(h)} 
                        for (x, y, w, h) in faces],
            "imageInfo": {
                "width": img.shape[1],
                "height": img.shape[0],
                "channels": img.shape[2]
            }
        }
    
    elif detectionType == "edges":
        edges = cv2.Canny(gray, 50, 150)
        edge_count = cv2.countNonZero(edges)
        
        results = {
            "type": "edges",
            "edgeCount": int(edge_count),
            "edgeDensity": float(edge_count) / (img.shape[0] * img.shape[1])
        }
    
    elif detectionType == "contours":
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        areas = [cv2.contourArea(contour) for contour in contours]
        
        results = {
            "type": "contours",
            "count": len(contours),
            "areas": areas,
            "largestArea": max(areas) if areas else 0
        }
    
    elif detectionType == "circles":
        circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, 1, 20, 
                                 param1=50, param2=30, minRadius=0, maxRadius=0)
        
        if circles is not None:
            circles = np.uint16(np.around(circles))
            results = {
                "type": "circles",
                "count": len(circles[0]),
                "circles": [{"x": int(circle[0]), "y": int(circle[1]), "radius": int(circle[2])} 
                           for circle in circles[0]]
            }
        else:
            results = {
                "type": "circles",
                "count": 0,
                "circles": []
            }
    
    elif detectionType == "lines":
        edges = cv2.Canny(gray, 50, 150)
        lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)
        
        if lines is not None:
            results = {
                "type": "lines",
                "count": len(lines),
                "lines": [{"rho": float(line[0][0]), "theta": float(line[0][1])} 
                         for line in lines]
            }
        else:
            results = {
                "type": "lines",
                "count": 0,
                "lines": []
            }
    
    else:
        # Return error for unsupported detection types
        results = {
            "error": f"Unsupported detection type: '{detectionType}'",
            "supportedTypes": ["face/faces", "edge/edges", "contour/contours", "circle/circles", "line/lines"]
        }
    
    return json.dumps(results, indent=2)

@mcp.tool()
def analyze_image(inputPath: str) -> str:
    """Analyze image statistics and properties"""
    _validate_image_file(inputPath)
    
    img = cv2.imread(inputPath)
    
    # Basic statistics
    mean_color = cv2.mean(img)
    std_color = cv2.meanStdDev(img)[1]
    
    # Histogram analysis
    hist_b = cv2.calcHist([img], [0], None, [256], [0, 256])
    hist_g = cv2.calcHist([img], [1], None, [256], [0, 256])
    hist_r = cv2.calcHist([img], [2], None, [256], [0, 256])
    
    analysis = {
        "basic": {
            "width": img.shape[1],
            "height": img.shape[0],
            "channels": img.shape[2],
            "totalPixels": img.shape[0] * img.shape[1]
        },
        "color": {
            "mean": {
                "blue": float(mean_color[0]),
                "green": float(mean_color[1]),
                "red": float(mean_color[2])
            },
            "std": {
                "blue": float(std_color[0][0]),
                "green": float(std_color[1][0]),
                "red": float(std_color[2][0])
            }
        },
        "histogram": {
            "blue": hist_b.flatten().tolist(),
            "green": hist_g.flatten().tolist(),
            "red": hist_r.flatten().tolist()
        }
    }
    
    return json.dumps(analysis, indent=2)

@mcp.tool()
def create_collage(
    image_paths: List[str],
    layout: str = "grid",
    output_path: Optional[str] = None,
    max_width: int = 1200,
    spacing: int = 10,
    canvas_width: Optional[int] = None,
    canvas_height: Optional[int] = None,
    background_color: str = "#FFFFFF",
    custom_positions: Optional[List[Dict[str, int]]] = None,
    random_seed: Optional[int] = None
) -> str:
    """Create a collage from multiple images with various layout options.
    
    Layout options:
        - "grid": Uniform grid layout (default)
        - "horizontal": Single row of images
        - "vertical": Single column of images
        - "mosaic": Random placement with overlap avoidance
        - "random": Completely random placement
        - "custom": Custom positioning with coordinates
    
    For mosaic, random, and custom layouts, you can specify canvasWidth and canvasHeight.
    For custom layout, you must provide customPositions list with {x, y} coordinates for each image.
    """
    if len(image_paths) < 2:
        raise ValueError("At least 2 images are required for a collage")
    
    # Validate all images
    for path in image_paths:
        _validate_image_file(path)
    
    if not output_path:
        output_path = str(temp_dir / f"collage_{len(image_paths)}_images.jpg")
    
    # Load and resize images
    images = []
    for path in image_paths:
        with Image.open(path) as img:
            # Resize to fit within max_width
            img.thumbnail((max_width // 2, max_width // 2), Image.Resampling.LANCZOS)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            images.append(img)
    
    # Convert background color
    bg_color = tuple(int(background_color[i:i+2], 16) for i in (1, 3, 5))
    
    # Calculate layout and canvas size
    if layout == "grid":
        cols = int(np.ceil(np.sqrt(len(images))))
        rows = int(np.ceil(len(images) / cols))
        max_img_width = max(img.width for img in images)
        max_img_height = max(img.height for img in images)
        canvas_width = cols * max_img_width + (cols - 1) * spacing
        canvas_height = rows * max_img_height + (rows - 1) * spacing
        
    elif layout == "horizontal":
        cols = len(images)
        rows = 1
        max_img_width = max(img.width for img in images)
        max_img_height = max(img.height for img in images)
        canvas_width = cols * max_img_width + (cols - 1) * spacing
        canvas_height = max_img_height
        
    elif layout == "vertical":
        cols = 1
        rows = len(images)
        max_img_width = max(img.width for img in images)
        max_img_height = max(img.height for img in images)
        canvas_width = max_img_width
        canvas_height = rows * max_img_height + (rows - 1) * spacing
        
    elif layout == "mosaic":
        # Mosaic layout with overlapping and varied sizes
        if not canvas_width or not canvas_height:
            canvas_width = max_width
            canvas_height = max_width
        else:
            canvas_width = canvas_width
            canvas_height = canvas_height
            
    elif layout == "random":
        # Random placement layout
        if not canvas_width or not canvas_height:
            canvas_width = max_width
            canvas_height = max_width
        else:
            canvas_width = canvas_width
            canvas_height = canvas_height
            
    elif layout == "custom":
        # Custom positioning layout
        if not custom_positions or len(custom_positions) != len(images):
            raise ValueError("Custom layout requires custom_positions for each image")
        if not canvas_width or not canvas_height:
            raise ValueError("Custom layout requires canvas_width and canvas_height")
        canvas_width = canvas_width
        canvas_height = canvas_height
        
    else:
        raise ValueError("Layout must be 'grid', 'horizontal', 'vertical', 'mosaic', 'random', or 'custom'")
    
    # Create canvas
    canvas = Image.new('RGB', (canvas_width, canvas_height), bg_color)
    
    # Place images based on layout
    if layout in ["grid", "horizontal", "vertical"]:
        # Standard grid layouts
        for i, img in enumerate(images):
            row = i // cols
            col = i % cols
            
            x = col * (max_img_width + spacing)
            y = row * (max_img_height + spacing)
            
            # Center the image in its cell
            x_offset = (max_img_width - img.width) // 2
            y_offset = (max_img_height - img.height) // 2
            
            canvas.paste(img, (x + x_offset, y + y_offset))
            
    elif layout == "mosaic":
        # Mosaic layout with overlapping and varied sizes
        import random
        if random_seed:
            random.seed(random_seed)
            
        positions = []
        for i, img in enumerate(images):
            # Try to find a position that doesn't overlap too much
            attempts = 0
            while attempts < 50:
                x = random.randint(0, canvas_width - img.width)
                y = random.randint(0, canvas_height - img.height)
                
                # Check overlap with existing images
                overlap = False
                for pos in positions:
                    if (x < pos['x'] + pos['width'] + spacing and 
                        x + img.width + spacing > pos['x'] and
                        y < pos['y'] + pos['height'] + spacing and
                        y + img.height + spacing > pos['y']):
                        overlap = True
                        break
                
                if not overlap:
                    break
                attempts += 1
            
            positions.append({'x': x, 'y': y, 'width': img.width, 'height': img.height})
            canvas.paste(img, (x, y))
            
    elif layout == "random":
        # Random placement without overlap checking
        import random
        if random_seed:
            random.seed(random_seed)
            
        for img in images:
            x = random.randint(0, canvas_width - img.width)
            y = random.randint(0, canvas_height - img.height)
            canvas.paste(img, (x, y))
            
    elif layout == "custom":
        # Custom positioning
        for i, (img, position) in enumerate(zip(images, custom_positions)):
            x = position.get('x', 0)
            y = position.get('y', 0)
            canvas.paste(img, (x, y))
    
    canvas.save(output_path, quality=95)
    
    info = _get_image_info(output_path)
    result = {
        "success": True,
        "outputPath": output_path,
        "imageInfo": info,
        "layout": layout,
        "imageCount": len(images),
        "canvasSize": {
            "width": canvas_width,
            "height": canvas_height
        }
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def create_collage_template(
    image_paths: List[str],
    template: str = "photo_wall",
    output_path: Optional[str] = None,
    max_width: int = 1200,
    background_color: str = "#FFFFFF"
) -> str:
    """Create a collage using predefined templates.
    
    Available templates:
        - "photo_wall": Classic photo wall with 6 images in 2x3 grid
        - "storyboard": Horizontal storyboard layout for 6 images
        - "featured": Featured layout with one large image and 4 smaller ones
        - "instagram_grid": Perfect 3x3 grid for Instagram
        - "polaroid": Scattered polaroid-style layout
    """
    if len(image_paths) < 2:
        raise ValueError("At least 2 images are required for a collage")
    
    # Validate all images
    for path in image_paths:
        _validate_image_file(path)
    
    if not output_path:
        output_path = str(temp_dir / f"collage_template_{template}_{len(image_paths)}_images.jpg")
    
    # Load and resize images
    images = []
    for path in image_paths:
        with Image.open(path) as img:
            if img.mode != 'RGB':
                img = img.convert('RGB')
            images.append(img)
    
    # Convert background color
    bg_color = tuple(int(background_color[i:i+2], 16) for i in (1, 3, 5))
    
    # Define templates
    templates = {
        "photo_wall": {
            "canvas_width": max_width,
            "canvas_height": max_width,
            "positions": [
                {"x": 50, "y": 50, "width": 300, "height": 300},
                {"x": 400, "y": 50, "width": 300, "height": 300},
                {"x": 750, "y": 50, "width": 300, "height": 300},
                {"x": 50, "y": 400, "width": 300, "height": 300},
                {"x": 400, "y": 400, "width": 300, "height": 300},
                {"x": 750, "y": 400, "width": 300, "height": 300}
            ]
        },
        "storyboard": {
            "canvas_width": max_width,
            "canvas_height": 400,
            "positions": [
                {"x": 20, "y": 20, "width": 180, "height": 180},
                {"x": 220, "y": 20, "width": 180, "height": 180},
                {"x": 420, "y": 20, "width": 180, "height": 180},
                {"x": 620, "y": 20, "width": 180, "height": 180},
                {"x": 820, "y": 20, "width": 180, "height": 180},
                {"x": 1020, "y": 20, "width": 180, "height": 180}
            ]
        },
        "featured": {
            "canvas_width": max_width,
            "canvas_height": 600,
            "positions": [
                {"x": 50, "y": 50, "width": 500, "height": 500},  # Large featured image
                {"x": 600, "y": 50, "width": 250, "height": 240},  # Top right
                {"x": 600, "y": 310, "width": 250, "height": 240},  # Bottom right
                {"x": 50, "y": 580, "width": 250, "height": 240},   # Bottom left
                {"x": 330, "y": 580, "width": 250, "height": 240}   # Bottom center
            ]
        },
        "instagram_grid": {
            "canvas_width": 900,
            "canvas_height": 900,
            "positions": [
                {"x": 0, "y": 0, "width": 300, "height": 300},
                {"x": 300, "y": 0, "width": 300, "height": 300},
                {"x": 600, "y": 0, "width": 300, "height": 300},
                {"x": 0, "y": 300, "width": 300, "height": 300},
                {"x": 300, "y": 300, "width": 300, "height": 300},
                {"x": 600, "y": 300, "width": 300, "height": 300},
                {"x": 0, "y": 600, "width": 300, "height": 300},
                {"x": 300, "y": 600, "width": 300, "height": 300},
                {"x": 600, "y": 600, "width": 300, "height": 300}
            ]
        },
        "polaroid": {
            "canvas_width": max_width,
            "canvas_height": max_width,
            "positions": [
                {"x": 100, "y": 100, "width": 200, "height": 200},
                {"x": 350, "y": 150, "width": 200, "height": 200},
                {"x": 600, "y": 100, "width": 200, "height": 200},
                {"x": 200, "y": 350, "width": 200, "height": 200},
                {"x": 450, "y": 400, "width": 200, "height": 200}
            ]
        }
    }
    
    if template not in templates:
        raise ValueError(f"Template '{template}' not found. Available templates: {list(templates.keys())}")
    
    template_config = templates[template]
    canvas_width = template_config["canvas_width"]
    canvas_height = template_config["canvas_height"]
    positions = template_config["positions"]
    
    # Create canvas
    canvas = Image.new('RGB', (canvas_width, canvas_height), bg_color)
    
    # Place images according to template
    for i, (img, position) in enumerate(zip(images, positions)):
        if i >= len(positions):
            break  # Stop if we run out of positions
            
        # Resize image to fit position
        resized_img = img.copy()
        resized_img.thumbnail((position["width"], position["height"]), Image.Resampling.LANCZOS)
        
        # Center the image in its position
        x_offset = (position["width"] - resized_img.width) // 2
        y_offset = (position["height"] - resized_img.height) // 2
        
        x = position["x"] + x_offset
        y = position["y"] + y_offset
        
        canvas.paste(resized_img, (x, y))
    
    canvas.save(output_path, quality=95)
    
    info = _get_image_info(output_path)
    result = {
        "success": True,
        "outputPath": output_path,
        "imageInfo": info,
        "template": template,
        "imageCount": min(len(images), len(positions)),
        "canvasSize": {
            "width": canvas_width,
            "height": canvas_height
        }
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def batch_process(
    inputPaths: List[str],
    operation: str,
    outputDirectory: Optional[str] = None,
    **kwargs
) -> str:
    """Process multiple images with the same operation"""
    if not inputPaths:
        raise ValueError("At least one image path is required")
    
    if not outputDirectory:
        outputDirectory = str(temp_dir / "batch_output")
    
    os.makedirs(outputDirectory, exist_ok=True)
    
    results = []
    
    for i, input_path in enumerate(inputPaths):
        try:
            _validate_image_file(input_path)
            
            # Generate output path
            base_name = Path(input_path).stem
            ext = Path(input_path).suffix
            output_path = os.path.join(outputDirectory, f"{base_name}_processed_{i}{ext}")
            
            # Apply operation based on type
            if operation == "resize":
                resize_image(inputPath=input_path, outputPath=output_path, **kwargs)
            elif operation == "filter":
                apply_filter(inputPath=input_path, outputPath=output_path, **kwargs)
            elif operation == "brightness_contrast":
                adjust_brightness_contrast(inputPath=input_path, outputPath=output_path, **kwargs)
            elif operation == "convert":
                convert_format(inputPath=input_path, outputPath=output_path, **kwargs)
            else:
                raise ValueError(f"Unsupported operation: {operation}")
            
            results.append({
                "inputPath": input_path,
                "outputPath": output_path,
                "success": True
            })
            
        except Exception as e:
            results.append({
                "inputPath": input_path,
                "success": False,
                "error": str(e)
            })
    
    summary = {
        "totalImages": len(inputPaths),
        "successful": len([r for r in results if r["success"]]),
        "failed": len([r for r in results if not r["success"]]),
        "outputDirectory": outputDirectory,
        "results": results
    }
    
    return json.dumps(summary, indent=2)

@mcp.tool()
def list_available_filters() -> str:
    """List all available image filters and effects"""
    filters = {
        "basic": ["blur", "sharpen", "grayscale", "invert"],
        "artistic": ["sepia", "vintage", "cartoon", "sketch"],
        "detection": ["edge_detection", "emboss"],
        "description": {
            "blur": "Apply Gaussian blur with adjustable intensity",
            "sharpen": "Enhance image sharpness",
            "grayscale": "Convert to black and white",
            "invert": "Invert image colors",
            "sepia": "Apply vintage sepia tone",
            "vintage": "Apply warm vintage effect",
            "cartoon": "Convert to cartoon-like appearance",
            "sketch": "Convert to pencil sketch effect",
            "edge_detection": "Detect and highlight edges",
            "emboss": "Apply 3D emboss effect"
        }
    }
    
    return json.dumps(filters, indent=2)

@mcp.tool()
def list_collage_templates() -> str:
    """List all available collage templates and layouts.
    
    Returns information about:
        - Layout types (grid, horizontal, vertical, mosaic, random, custom)
        - Predefined templates (photo_wall, storyboard, featured, instagram_grid, polaroid)
        - Custom options and parameters
    """
    templates = {
        "layouts": {
            "grid": "Uniform grid layout (default)",
            "horizontal": "Single row of images",
            "vertical": "Single column of images",
            "mosaic": "Random placement with overlap avoidance",
            "random": "Completely random placement",
            "custom": "Custom positioning with coordinates"
        },
        "templates": {
            "photo_wall": "Classic photo wall with 6 images in 2x3 grid",
            "storyboard": "Horizontal storyboard layout for 6 images",
            "featured": "Featured layout with one large image and 4 smaller ones",
            "instagram_grid": "Perfect 3x3 grid for Instagram",
            "polaroid": "Scattered polaroid-style layout"
        },
        "custom_options": {
            "canvasWidth": "Custom canvas width for mosaic/random/custom layouts",
            "canvasHeight": "Custom canvas height for mosaic/random/custom layouts",
            "backgroundColor": "Background color in hex format (e.g., '#FFFFFF')",
            "customPositions": "List of {x, y} coordinates for custom layout",
            "randomSeed": "Seed for reproducible random layouts",
            "spacing": "Spacing between images in grid layouts"
        }
    }
    
    return json.dumps(templates, indent=2)

if __name__ == "__main__":
    # Run the server
    mcp.run() 