# Music Creator Agent (Experimental)

A comprehensive AI agent for music creation, editing, and audio processing using advanced music libraries and AI-powered analysis.

## 🎥 Demo Video

Watch the Music Creator Agent in action:

<iframe
  width="100%"
  height="400"
  src="https://www.youtube.com/embed/FGg0nIOZUig"
  title="Music Creator Agent Demo"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
  allowfullscreen="true"
></iframe>

> **⚠️ Experimental Status**: This agent is currently in experimental development. The tools have not been extensively tested in production environments and may have limitations or bugs. We're actively seeking feedback and improvements from users.

## 🧪 Experimental Features

- **Limited Testing**: Tools have been tested in controlled environments but may behave differently with various audio formats, file sizes, or system configurations
- **Active Development**: Features are being refined based on user feedback and real-world usage
- **Feedback Welcome**: We encourage users to report issues, suggest improvements, and share use cases
- **Breaking Changes**: API and tool behavior may change as we improve the implementation

## Overview

The Music Creator Agent provides a complete suite of tools for music production, from basic audio editing to advanced music generation and analysis. Built with industry-standard libraries like librosa, pydub, and music21, it offers professional-grade audio processing capabilities.

## Features

### 🎵 Audio Analysis
- **Tempo Detection**: Automatically detect BPM and beat positions
- **Key Detection**: Identify musical key and mode
- **Spectral Analysis**: Analyze frequency spectrum, MFCC features, and audio characteristics
- **Comprehensive Analysis**: Get detailed audio information including duration, sample rate, and format

### 🎼 Music Generation
- **Melody Creation**: Generate melodies in any key and scale
- **Chord Progressions**: Create chord progressions using Roman numeral notation
- **Drum Patterns**: Generate drum patterns for rock, jazz, and funk styles
- **MIDI Export**: All generated music exports to MIDI format for further editing

### 🔊 Audio Processing
- **Format Conversion**: Convert between MP3, WAV, FLAC, OGG, M4A, AIFF, WMA
- **Volume Control**: Adjust audio levels with precise dB control
- **Audio Normalization**: Normalize audio to target levels
- **Audio Trimming**: Cut audio to specific time ranges
- **Audio Effects**: Apply reverb, echo, distortion, and filters

### 🎚️ Mixing & Arrangement
- **Audio Merging**: Combine multiple audio files with crossfade support
- **Multi-track Mixing**: Mix multiple audio tracks with individual volume control
- **Batch Processing**: Process multiple files with the same operation

## Quick Start

### Prerequisites
- **Python 3.10+**: For the MCP server
- **uv**: Python package manager (recommended) or pip
- **Node.js 18+**: For the Saiki framework
- **FFmpeg**: For audio processing (optional, but recommended)

### Installation

1. **Install uv** (if not already installed):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Install FFmpeg** (recommended):
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt update && sudo apt install ffmpeg
   ```

3. **Setup the Python Server**:
   ```bash
   cd agents/music-agent/python-server
   ./setup-python-server.sh
   ```

4. **Test the Installation**:
   ```bash
   uv run python test-setup.py
   ```

5. **Run the Agent**:
   ```bash
   # From the project root
   saiki run agents/music-agent/music-agent.yml
   ```

## Usage Examples

### Audio Analysis
```
"Analyze the tempo and key of my song.mp3"
"What's the BPM of this track?"
"What key is this song in?"
```

### Music Generation
```
"Create a melody in G major at 140 BPM for 15 seconds"
"Create a I-IV-V-I chord progression in D major"
"Create a basic rock drum pattern"
```

### Audio Processing
```
"Convert my song.wav to MP3 format"
"Convert my MIDI melody to WAV format"
"Increase the volume of my vocals by 3dB"
"Normalize my guitar track to -18dB"
"Trim my song from 30 seconds to 2 minutes"
```

### Audio Effects
```
"Add reverb to my guitar with 200ms reverb time"
"Add echo to my vocals with 500ms delay and 0.7 decay"
"Add some distortion to my bass track"
```

### Mixing & Playback
```
"Mix my vocals, guitar, and drums together with the vocals at +3dB"
"Mix a MIDI melody with an MP3 drum loop"
"Create a melody in G major and play it for 5 seconds"
"Play my song.mp3 starting from 30 seconds for 10 seconds"
```

## Available Tools

### Music Generation
- `create_melody` - Generate melodies in any key and scale
- `create_chord_progression` - Create chord progressions using Roman numerals
- `create_drum_pattern` - Generate drum patterns for different styles

### Audio Analysis
- `analyze_audio` - Comprehensive audio analysis
- `detect_tempo` - Detect BPM and beat positions
- `detect_key` - Identify musical key and mode
- `get_audio_info` - Get detailed audio file information
- `get_midi_info` - Get detailed MIDI file information

### Audio Processing
- `convert_audio_format` - Convert between audio formats
- `convert_midi_to_audio` - Convert MIDI files to high-quality audio format (WAV, 44.1kHz, 16-bit)
- `adjust_volume` - Adjust audio levels in dB
- `normalize_audio` - Normalize audio to target levels
- `trim_audio` - Cut audio to specific time ranges
- `apply_audio_effect` - Apply reverb, echo, distortion, filters

### Mixing & Arrangement
- `merge_audio_files` - Combine multiple audio files
- `mix_audio_files` - Mix tracks with individual volume control (supports both audio and MIDI files)

### Playback
- `play_audio` - Play audio files with optional start time and duration
- `play_midi` - Play MIDI files with optional start time and duration

### Utility
- `list_available_effects` - List all audio effects
- `list_drum_patterns` - List available drum patterns

## Supported Formats

### Audio Formats
- **MP3**: Most common compressed format
- **WAV**: Uncompressed high-quality audio
- **FLAC**: Lossless compressed audio
- **OGG**: Open-source compressed format
- **M4A**: Apple's compressed format
- **AIFF**: Apple's uncompressed format
- **WMA**: Windows Media Audio

### MIDI Formats
- **MID**: Standard MIDI files
- **MIDI**: Alternative MIDI extension

## Configuration

### Agent Configuration
The agent is configured in `music-agent.yml`:

```yaml
systemPrompt: |
  You are an AI assistant specialized in music creation, editing, and production...

mcpServers:
  music_creator:
    type: stdio
    command: uv
    args:
      - run
      - --project
      - agents/music-agent/python-server
      - python
      - agents/music-agent/python-server/main.py
    connectionMode: strict

llm:
  provider: openai
  model: gpt-4o-mini
  apiKey: $OPENAI_API_KEY
```

### Environment Variables
Set your OpenAI API key:

```bash
export OPENAI_API_KEY="your-api-key-here"
```

Or create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your-api-key-here
```

## Troubleshooting

### Common Issues

#### 1. "uv command not found"
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Restart your terminal or reload shell
source ~/.bashrc  # or ~/.zshrc
```

#### 2. "FFmpeg not found" warnings
These warnings can be safely ignored. The agent includes fallback methods using librosa and soundfile for audio processing when FFmpeg is not available.

```bash
# Optional: Install FFmpeg for optimal performance
brew install ffmpeg  # macOS
sudo apt install ffmpeg  # Ubuntu/Debian
```

#### 3. "Permission denied" on setup script
```bash
chmod +x setup-python-server.sh
```

#### 4. Dependency Issues
If you encounter dependency problems:
```bash
cd agents/music-agent/python-server
rm -rf .venv
uv sync
uv run python test-setup.py
```

#### 5. JSON Serialization Errors
These have been fixed in the current version. If you encounter them, ensure you're using the latest code.

### Performance Tips

1. **Large Audio Files**: Consider trimming or converting to smaller formats for faster processing
2. **Memory Usage**: Monitor system memory during heavy audio operations
3. **Batch Processing**: Use batch operations for multiple files to improve efficiency
4. **FFmpeg**: Install FFmpeg for optimal audio processing performance (optional - fallback methods available)

## Technical Details

### Dependencies
- **librosa**: Audio analysis and music information retrieval
- **pydub**: Audio file manipulation and processing
- **music21**: Music notation and analysis
- **pretty_midi**: MIDI file handling
- **numpy**: Numerical computing
- **scipy**: Scientific computing
- **matplotlib**: Plotting and visualization

### Architecture
The agent uses a Python-based MCP server that provides:
- Fast audio processing with optimized libraries
- Memory-efficient handling of large audio files
- Thread-safe operations for concurrent processing
- Comprehensive error handling and validation

### Performance
- Supports audio files up to several hours in length
- Efficient processing of multiple file formats
- Optimized algorithms for real-time analysis
- Minimal memory footprint for batch operations

## Use Cases

### Music Production
- Create backing tracks and accompaniments
- Generate drum patterns for different genres
- Compose melodies and chord progressions
- Mix and master audio tracks

### Audio Editing
- Clean up audio recordings
- Normalize volume levels
- Apply professional effects
- Convert between formats

### Music Analysis
- Analyze existing music for tempo and key
- Extract musical features for machine learning
- Study musical patterns and structures
- Compare different audio files

### Educational
- Learn about musical theory through generation
- Study different musical styles and patterns
- Experiment with composition techniques
- Understand audio processing concepts

## Feedback and Testing

### 🧪 Experimental Status
This agent is in active development and we value your feedback! Here's how you can help:

#### Known Limitations
- **Audio Quality**: Some audio processing operations may produce artifacts with certain file formats
- **Performance**: Large files (>100MB) may take longer to process
- **Format Support**: Some exotic audio formats may not be fully supported
- **System Compatibility**: Performance may vary across different operating systems

#### Testing Scenarios
We're particularly interested in feedback on:
- **Real-world audio files**: How does it handle your actual music files?
- **Different genres**: Does it work well with various musical styles?
- **File sizes**: Performance with very small or very large files
- **System configurations**: Different OS, hardware, and dependency setups

#### Reporting Issues
When reporting issues, please include:
- **File format and size**: What type of audio file were you processing?
- **Error messages**: Full error output if available
- **System info**: OS, Python version, installed dependencies
- **Steps to reproduce**: Exact commands or operations that caused the issue

#### Feature Requests
We welcome suggestions for:
- **New audio effects**: What effects would be most useful?
- **Additional formats**: What audio formats do you need?
- **Performance improvements**: What operations are too slow?
- **User experience**: How can we make the tools easier to use?

### Contributing
See the [Development](#development) section below for technical contribution guidelines.

## Development
```bash
cd agents/music-agent/python-server
uv run python test-setup.py
uv run python test_functions.py
```

### Code Formatting
```bash
uv run black main.py
uv run ruff check main.py
```

### Adding New Tools
1. Add new tools to `main.py` using the `@mcp.tool()` decorator
2. Update the system prompt in `music-agent.yml` to describe new capabilities
3. Add appropriate error handling and validation
4. Include comprehensive documentation and examples

## License

This project is part of the Saiki AI Agent framework and follows the same licensing terms. 