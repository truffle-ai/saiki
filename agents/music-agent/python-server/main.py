#!/usr/bin/env python3

"""
Music Creator MCP Server
A comprehensive music creation and audio processing server using librosa, pydub, and music21
"""

import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Tuple
import numpy as np

import librosa
import librosa.display
import pydub
from pydub import AudioSegment
from pydub.effects import normalize
import music21
import pretty_midi
import soundfile as sf
from mcp.server.fastmcp import FastMCP
import matplotlib.pyplot as plt
from scipy import signal
from sklearn.cluster import KMeans

# Create an MCP server
mcp = FastMCP("music-creator")

# Create temp directory
temp_dir = Path("temp_audio")
temp_dir.mkdir(exist_ok=True)

# Supported audio formats
SUPPORTED_AUDIO_FORMATS = {'.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aiff', '.wma'}
SUPPORTED_MIDI_FORMATS = {'.mid', '.midi'}

def _validate_audio_file(file_path: str) -> None:
    """Validate that the audio file exists and is supported."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    file_ext = Path(file_path).suffix.lower()
    
    if file_ext not in SUPPORTED_AUDIO_FORMATS:
        raise ValueError(f"Unsupported audio format: {file_ext}. Supported formats: {', '.join(SUPPORTED_AUDIO_FORMATS)}")

def _validate_midi_file(file_path: str) -> None:
    """Validate that the MIDI file exists and is supported."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    file_ext = Path(file_path).suffix.lower()
    
    if file_ext not in SUPPORTED_MIDI_FORMATS:
        raise ValueError(f"Unsupported MIDI format: {file_ext}. Supported formats: {', '.join(SUPPORTED_MIDI_FORMATS)}")

def _get_audio_info(file_path: str) -> Dict[str, Any]:
    """Get detailed information about an audio file."""
    _validate_audio_file(file_path)
    
    # Load audio with librosa for analysis
    y, sr = librosa.load(file_path, sr=None)
    
    # Get duration
    duration = librosa.get_duration(y=y, sr=sr)
    
    # Get file size
    file_size = os.path.getsize(file_path)
    
    # Try to get audio segment info, with fallback if ffmpeg is not available
    try:
        audio_segment = AudioSegment.from_file(file_path)
        channels = audio_segment.channels
        frame_rate = audio_segment.frame_rate
        sample_width = audio_segment.sample_width
        bit_depth = audio_segment.sample_width * 8
    except Exception as e:
        # Fallback when ffmpeg is not available
        if "ffprobe" in str(e) or "ffmpeg" in str(e):
            # Use librosa info as fallback
            channels = 1 if len(y.shape) == 1 else 2
            frame_rate = sr
            sample_width = 2  # Assume 16-bit
            bit_depth = 16
        else:
            raise e
    
    return {
        "duration": round(duration, 2),
        "sampleRate": sr,
        "channels": channels,
        "frameRate": frame_rate,
        "sampleWidth": sample_width,
        "fileSize": file_size,
        "fileName": Path(file_path).name,
        "format": Path(file_path).suffix.lower()[1:],
        "bitDepth": bit_depth,
        "frameCount": len(y)
    }

def _mix_audio_with_librosa(audio_paths: List[str], volumes: List[float], output_path: str, original_paths: List[str]) -> str:
    """Fallback mixing function using librosa when pydub/ffmpeg is not available."""
    import soundfile as sf
    
    # Load all audio files with librosa
    mixed_audio = None
    max_length = 0
    
    for path, volume in zip(audio_paths, volumes):
        # Load audio
        y, sr = librosa.load(path, sr=None)
        
        # Apply volume (convert dB to linear scale)
        if volume != 0:
            y = y * (10 ** (volume / 20))
        
        # Track max length
        max_length = max(max_length, len(y))
        
        if mixed_audio is None:
            mixed_audio = y
        else:
            # Pad shorter audio to match length
            if len(y) < max_length:
                y = np.pad(y, (0, max_length - len(y)), mode='constant')
            elif len(mixed_audio) < max_length:
                mixed_audio = np.pad(mixed_audio, (0, max_length - len(mixed_audio)), mode='constant')
            
            # Mix (simple addition)
            mixed_audio = mixed_audio + y
    
    # Normalize to prevent clipping
    if np.max(np.abs(mixed_audio)) > 1.0:
        mixed_audio = mixed_audio / np.max(np.abs(mixed_audio)) * 0.95
    
    # Export using soundfile
    sf.write(output_path, mixed_audio, sr)
    
    # Clean up temporary converted files
    for path in audio_paths:
        if path != original_paths[audio_paths.index(path)]:  # Only delete if it was converted
            try:
                os.remove(path)
            except:
                pass  # Ignore cleanup errors
    
    # Get info using librosa
    duration = librosa.get_duration(y=mixed_audio, sr=sr)
    file_size = os.path.getsize(output_path)
    
    info = {
        "duration": round(duration, 2),
        "sampleRate": sr,
        "channels": 1 if len(mixed_audio.shape) == 1 else 2,
        "frameRate": sr,
        "sampleWidth": 2,  # Assume 16-bit
        "fileSize": file_size,
        "fileName": Path(output_path).name,
        "format": "wav",
        "bitDepth": 16,
        "frameCount": len(mixed_audio)
    }
    
    result = {
        "success": True,
        "inputPaths": original_paths,
        "volumes": volumes,
        "outputPath": output_path,
        "audioInfo": info,
        "convertedFiles": [p != o for p, o in zip(audio_paths, original_paths)],
        "method": "librosa_fallback"
    }
    
    return json.dumps(result, indent=2)

def _convert_midi_to_audio(midi_path: str, output_path: Optional[str] = None) -> str:
    """Convert a MIDI file to audio format (WAV) for mixing."""
    _validate_midi_file(midi_path)
    
    if not output_path:
        output_path = str(temp_dir / f"{Path(midi_path).stem}_converted.wav")
    
    try:
        # Load MIDI file
        midi_data = pretty_midi.PrettyMIDI(midi_path)
        
        # Get the actual end time of the MIDI file
        midi_duration = midi_data.get_end_time()
        
        # Synthesize audio with proper sample rate and duration
        audio_data = midi_data.synthesize(fs=44100)
        
        # Trim audio to match MIDI duration exactly
        expected_samples = int(midi_duration * 44100)
        if len(audio_data) > expected_samples:
            audio_data = audio_data[:expected_samples]
        elif len(audio_data) < expected_samples:
            # Pad with silence if too short
            padding = np.zeros(expected_samples - len(audio_data))
            audio_data = np.concatenate([audio_data, padding])
        
        # Normalize audio to prevent clipping and improve quality
        if np.max(np.abs(audio_data)) > 0:
            audio_data = audio_data / np.max(np.abs(audio_data)) * 0.8
        
        # Ensure audio data is in the correct format (float32)
        audio_data = audio_data.astype(np.float32)
        
        # Use soundfile for reliable WAV export (better than pydub for this use case)
        import soundfile as sf
        sf.write(output_path, audio_data, 44100, subtype='PCM_16')
        
        return output_path
        
    except Exception as e:
        raise RuntimeError(f"Failed to convert MIDI to audio: {str(e)}")

def _get_midi_info(file_path: str) -> Dict[str, Any]:
    """Get detailed information about a MIDI file."""
    _validate_midi_file(file_path)
    
    midi_data = pretty_midi.PrettyMIDI(file_path)
    
    file_size = os.path.getsize(file_path)
    
    # Convert key signature changes to serializable format
    key_signatures = []
    for ks in midi_data.key_signature_changes:
        key_signatures.append({
            "time": round(ks.time, 3),
            "key": ks.key_number
        })
    
    # Convert time signature changes to serializable format
    time_signatures = []
    for ts in midi_data.time_signature_changes:
        time_signatures.append({
            "time": round(ts.time, 3),
            "numerator": ts.numerator,
            "denominator": ts.denominator
        })
    
    # Safely estimate tempo
    try:
        estimated_tempo = midi_data.estimate_tempo()
        tempo = round(estimated_tempo, 2) if estimated_tempo else 120.0
    except Exception:
        # If tempo estimation fails, use default
        tempo = 120.0
    
    return {
        "duration": round(midi_data.get_end_time(), 2),
        "tempo": tempo,
        "keySignature": key_signatures,
        "timeSignature": time_signatures,
        "instruments": [inst.name for inst in midi_data.instruments],
        "noteCount": sum(len(inst.notes) for inst in midi_data.instruments),
        "fileSize": file_size,
        "fileName": Path(file_path).name,
        "format": Path(file_path).suffix.lower()[1:]
    }

@mcp.tool()
def get_audio_info(filePath: str) -> str:
    """Get detailed information about an audio file including duration, sample rate, and format"""
    info = _get_audio_info(filePath)
    return json.dumps(info, indent=2)

@mcp.tool()
def get_midi_info(filePath: str) -> str:
    """Get detailed information about a MIDI file including tempo, key, and instruments"""
    info = _get_midi_info(filePath)
    return json.dumps(info, indent=2)

@mcp.tool()
def analyze_audio(filePath: str) -> str:
    """Perform comprehensive audio analysis including tempo, key, BPM, and spectral features"""
    _validate_audio_file(filePath)
    
    # Load audio
    y, sr = librosa.load(filePath, sr=None)
    
    # Tempo and beat analysis
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    
    # Key detection
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_raw = np.argmax(np.mean(chroma, axis=1))
    key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    detected_key = key_names[key_raw]
    
    # Spectral features
    spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    
    # MFCC features
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    
    # Zero crossing rate
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    
    # RMS energy
    rms = librosa.feature.rms(y=y)[0]
    
    analysis = {
        "tempo": round(tempo, 2),
        "bpm": round(tempo, 0),
        "key": detected_key,
        "beatCount": len(beats),
        "duration": round(librosa.get_duration(y=y, sr=sr), 2),
        "sampleRate": sr,
        "spectralFeatures": {
            "centroidMean": round(float(np.mean(spectral_centroids)), 2),
            "rolloffMean": round(float(np.mean(spectral_rolloff)), 2),
            "bandwidthMean": round(float(np.mean(spectral_bandwidth)), 2)
        },
        "mfccFeatures": {
            "mean": [round(float(x), 3) for x in np.mean(mfccs, axis=1)],
            "std": [round(float(x), 3) for x in np.std(mfccs, axis=1)]
        },
        "zeroCrossingRate": round(float(np.mean(zcr)), 4),
        "rmsEnergy": round(float(np.mean(rms)), 4),
        "fileName": Path(filePath).name
    }
    
    return json.dumps(analysis, indent=2)

@mcp.tool()
def convert_midi_to_audio(
    inputPath: str,
    outputPath: Optional[str] = None,
    sampleRate: int = 44100
) -> str:
    """Convert a MIDI file to audio format (WAV)"""
    _validate_midi_file(inputPath)
    
    if not outputPath:
        outputPath = str(temp_dir / f"{Path(inputPath).stem}_converted.wav")
    
    try:
        converted_path = _convert_midi_to_audio(inputPath, outputPath)
        
        info = _get_audio_info(converted_path)
        result = {
            "success": True,
            "inputPath": inputPath,
            "outputPath": converted_path,
            "audioInfo": info
        }
        
        return json.dumps(result, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2)

@mcp.tool()
def convert_audio_format(
    inputPath: str,
    outputFormat: str,
    outputPath: Optional[str] = None,
    quality: int = 90
) -> str:
    """Convert audio file to different format with quality control"""
    _validate_audio_file(inputPath)
    
    if not outputPath:
        base_name = Path(inputPath).stem
        outputPath = str(temp_dir / f"{base_name}.{outputFormat}")
    
    # Load audio
    audio = AudioSegment.from_file(inputPath)
    
    # Export with specified format and quality
    if outputFormat.lower() == 'mp3':
        audio.export(outputPath, format='mp3', bitrate=f"{quality}k")
    elif outputFormat.lower() == 'wav':
        audio.export(outputPath, format='wav')
    elif outputFormat.lower() == 'flac':
        audio.export(outputPath, format='flac')
    elif outputFormat.lower() == 'ogg':
        audio.export(outputPath, format='ogg', bitrate=f"{quality}k")
    else:
        audio.export(outputPath, format=outputFormat)
    
    info = _get_audio_info(outputPath)
    result = {
        "success": True,
        "inputPath": inputPath,
        "outputPath": outputPath,
        "outputFormat": outputFormat,
        "audioInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def adjust_volume(
    inputPath: str,
    volumeChange: float,
    outputPath: Optional[str] = None
) -> str:
    """Adjust audio volume by a specified amount in dB"""
    _validate_audio_file(inputPath)
    
    if not outputPath:
        base_name = Path(inputPath).stem
        ext = Path(inputPath).suffix
        outputPath = str(temp_dir / f"{base_name}_volume_{volumeChange}dB{ext}")
    
    # Load audio
    audio = AudioSegment.from_file(inputPath)
    
    # Adjust volume
    adjusted_audio = audio + volumeChange
    
    # Export
    adjusted_audio.export(outputPath, format=Path(outputPath).suffix[1:])
    
    info = _get_audio_info(outputPath)
    result = {
        "success": True,
        "inputPath": inputPath,
        "outputPath": outputPath,
        "volumeChange": volumeChange,
        "audioInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def normalize_audio(
    inputPath: str,
    outputPath: Optional[str] = None,
    targetLevel: float = -20.0
) -> str:
    """Normalize audio to a target level in dB"""
    _validate_audio_file(inputPath)
    
    if not outputPath:
        base_name = Path(inputPath).stem
        ext = Path(inputPath).suffix
        outputPath = str(temp_dir / f"{base_name}_normalized{ext}")
    
    # Load audio
    audio = AudioSegment.from_file(inputPath)
    
    # Normalize
    normalized_audio = normalize(audio, headroom=targetLevel)
    
    # Export
    normalized_audio.export(outputPath, format=Path(outputPath).suffix[1:])
    
    info = _get_audio_info(outputPath)
    result = {
        "success": True,
        "inputPath": inputPath,
        "outputPath": outputPath,
        "targetLevel": targetLevel,
        "audioInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def trim_audio(
    inputPath: str,
    startTime: float,
    endTime: float,
    outputPath: Optional[str] = None
) -> str:
    """Trim audio to a specific time range"""
    _validate_audio_file(inputPath)
    
    if not outputPath:
        base_name = Path(inputPath).stem
        ext = Path(inputPath).suffix
        outputPath = str(temp_dir / f"{base_name}_trimmed_{startTime}s_to_{endTime}s{ext}")
    
    # Load audio
    audio = AudioSegment.from_file(inputPath)
    
    # Convert to milliseconds
    start_ms = int(startTime * 1000)
    end_ms = int(endTime * 1000)
    
    # Trim
    trimmed_audio = audio[start_ms:end_ms]
    
    # Export
    trimmed_audio.export(outputPath, format=Path(outputPath).suffix[1:])
    
    info = _get_audio_info(outputPath)
    result = {
        "success": True,
        "inputPath": inputPath,
        "outputPath": outputPath,
        "startTime": startTime,
        "endTime": endTime,
        "duration": endTime - startTime,
        "audioInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def apply_audio_effect(
    inputPath: str,
    effect: str,
    outputPath: Optional[str] = None,
    **kwargs
) -> str:
    """Apply various audio effects to the input file"""
    _validate_audio_file(inputPath)
    
    if not outputPath:
        base_name = Path(inputPath).stem
        ext = Path(inputPath).suffix
        outputPath = str(temp_dir / f"{base_name}_{effect}{ext}")
    
    # Load audio
    audio = AudioSegment.from_file(inputPath)
    
    # Apply effects
    if effect.lower() == "reverb":
        # Simple reverb effect
        reverb_time = kwargs.get("reverbTime", 100)
        reverb_audio = audio + (audio - 10)  # Simple reverb simulation
        processed_audio = audio.overlay(reverb_audio, position=reverb_time)
    
    elif effect.lower() == "echo":
        # Echo effect
        delay = kwargs.get("delay", 500)  # milliseconds
        decay = kwargs.get("decay", 0.5)
        echo_audio = audio - (20 * (1 - decay))  # Reduce volume for echo
        processed_audio = audio.overlay(echo_audio, position=delay)
    
    elif effect.lower() == "distortion":
        # Distortion effect
        distortion_level = kwargs.get("level", 0.1)
        processed_audio = audio + (audio * distortion_level)
    
    elif effect.lower() == "lowpass":
        # Low-pass filter
        cutoff = kwargs.get("cutoff", 1000)  # Hz
        # This is a simplified low-pass filter
        processed_audio = audio.low_pass_filter(cutoff)
    
    elif effect.lower() == "highpass":
        # High-pass filter
        cutoff = kwargs.get("cutoff", 1000)  # Hz
        processed_audio = audio.high_pass_filter(cutoff)
    
    elif effect.lower() == "reverse":
        # Reverse audio
        processed_audio = audio.reverse()
    
    else:
        raise ValueError(f"Unsupported effect: {effect}")
    
    # Export
    processed_audio.export(outputPath, format=Path(outputPath).suffix[1:])
    
    info = _get_audio_info(outputPath)
    result = {
        "success": True,
        "inputPath": inputPath,
        "outputPath": outputPath,
        "effect": effect,
        "parameters": kwargs,
        "audioInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def create_melody(
    key: str = "C",
    scale: str = "major",
    duration: float = 10.0,
    tempo: int = 120,
    outputPath: Optional[str] = None
) -> str:
    """Create a simple melody using music21"""
    if not outputPath:
        outputPath = str(temp_dir / f"melody_{key}_{scale}_{tempo}bpm.mid")
    
    # Create a stream
    stream = music21.stream.Stream()
    
    # Set tempo
    tempo_mark = music21.tempo.MetronomeMark(number=tempo)
    stream.append(tempo_mark)
    
    # Create scale
    scale_obj = music21.scale.MajorScale(key) if scale.lower() == "major" else music21.scale.MinorScale(key)
    scale_notes = list(scale_obj.getPitches())
    
    # Create melody
    import random
    random.seed(42)  # For reproducible results
    
    current_time = 0.0
    while current_time < duration:
        # Random note from scale
        note = random.choice(scale_notes)
        
        # Random duration (quarter, half, or whole note)
        duration_choices = [1.0, 2.0, 4.0]
        note_duration = random.choice(duration_choices)
        
        # Create note
        n = music21.note.Note(note)
        n.duration = music21.duration.Duration(note_duration)
        
        stream.append(n)
        current_time += note_duration
    
    # Write to MIDI file
    stream.write('midi', fp=outputPath)
    
    info = _get_midi_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "key": key,
        "scale": scale,
        "duration": duration,
        "tempo": tempo,
        "midiInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def create_chord_progression(
    key: str = "C",
    progression: str = "I-IV-V-I",
    duration: float = 8.0,
    tempo: int = 120,
    outputPath: Optional[str] = None
) -> str:
    """Create a chord progression using music21"""
    if not outputPath:
        outputPath = str(temp_dir / f"chords_{key}_{progression.replace('-', '_')}_{tempo}bpm.mid")
    
    # Create a stream
    stream = music21.stream.Stream()
    
    # Set tempo
    tempo_mark = music21.tempo.MetronomeMark(number=tempo)
    stream.append(tempo_mark)
    
    # Parse progression
    chords = progression.split('-')
    
    # Create scale
    scale_obj = music21.scale.MajorScale(key)
    
    # Roman numeral to chord mapping
    roman_to_chord = {
        'I': [0, 2, 4],    # Root, third, fifth
        'ii': [1, 3, 5],   # Minor second
        'iii': [2, 4, 6],  # Minor third
        'IV': [3, 5, 7],   # Major fourth
        'V': [4, 6, 8],    # Major fifth
        'vi': [5, 7, 9],   # Minor sixth
        'vii': [6, 8, 10]  # Diminished seventh
    }
    
    # Calculate how many times to repeat the progression to fill the duration
    progression_duration = 4.0  # Assume each chord gets 1 second in a 4-chord progression
    repetitions = max(1, int(duration / progression_duration))
    
    for repeat in range(repetitions):
        for i, chord_symbol in enumerate(chords):
            if chord_symbol in roman_to_chord:
                # Get chord intervals
                intervals = roman_to_chord[chord_symbol]
                
                # Create chord notes
                chord_notes = []
                for interval in intervals:
                    note = scale_obj.pitches[interval % 7]
                    chord_notes.append(note)
                
                # Create chord with shorter duration for more rhythmic content
                chord = music21.chord.Chord(chord_notes)
                chord.duration = music21.duration.Duration(1.0)  # Each chord gets 1 second
                chord.offset = (repeat * len(chords) + i) * 1.0
                
                stream.append(chord)
    
    # Write to MIDI file
    stream.write('midi', fp=outputPath)
    
    info = _get_midi_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "key": key,
        "progression": progression,
        "duration": duration,
        "tempo": tempo,
        "midiInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def create_drum_pattern(
    pattern: str = "basic_rock",
    duration: float = 8.0,
    tempo: int = 120,
    outputPath: Optional[str] = None
) -> str:
    """Create a drum pattern using music21"""
    if not outputPath:
        outputPath = str(temp_dir / f"drums_{pattern}_{tempo}bpm.mid")
    
    # Create a stream
    stream = music21.stream.Stream()
    
    # Set tempo
    tempo_mark = music21.tempo.MetronomeMark(number=tempo)
    stream.append(tempo_mark)
    
    # Drum patterns
    patterns = {
        "basic_rock": {
            "kick": [0, 2, 4, 6],
            "snare": [2, 6],
            "hihat": [0, 1, 2, 3, 4, 5, 6, 7]
        },
        "basic_jazz": {
            "kick": [0, 4],
            "snare": [2, 6],
            "hihat": [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5]
        },
        "basic_funk": {
            "kick": [0, 1.5, 4, 5.5],
            "snare": [2, 6],
            "hihat": [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5]
        }
    }
    
    if pattern not in patterns:
        raise ValueError(f"Unsupported pattern: {pattern}. Available: {list(patterns.keys())}")
    
    drum_pattern = patterns[pattern]
    
    # Create drum track
    drum_track = music21.stream.Part()
    # Use a generic percussion instrument instead of DrumKit
    drum_track.append(music21.instrument.Percussion())
    
    # Add drum hits
    for drum_type, hits in drum_pattern.items():
        for hit_time in hits:
            if hit_time < duration:
                # Create drum note
                if drum_type == "kick":
                    drum_note = music21.note.Note('C2')  # Kick drum
                elif drum_type == "snare":
                    drum_note = music21.note.Note('D2')  # Snare drum
                elif drum_type == "hihat":
                    drum_note = music21.note.Note('F#2')  # Hi-hat
                else:
                    continue
                
                drum_note.duration = music21.duration.Duration(0.25)  # Quarter note
                drum_note.offset = hit_time
                drum_track.append(drum_note)
    
    stream.append(drum_track)
    
    # Write to MIDI file
    stream.write('midi', fp=outputPath)
    
    info = _get_midi_info(outputPath)
    result = {
        "success": True,
        "outputPath": outputPath,
        "pattern": pattern,
        "duration": duration,
        "tempo": tempo,
        "midiInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def merge_audio_files(
    audioPaths: List[str],
    outputPath: Optional[str] = None,
    crossfade: float = 0.0
) -> str:
    """Merge multiple audio files into one"""
    if not audioPaths:
        raise ValueError("At least one audio path is required")
    
    if not outputPath:
        outputPath = str(temp_dir / f"merged_{len(audioPaths)}_files{Path(audioPaths[0]).suffix}")
    
    # Validate all files
    for path in audioPaths:
        _validate_audio_file(path)
    
    # Load first audio
    combined = AudioSegment.from_file(audioPaths[0])
    
    # Add subsequent audio files
    for i, path in enumerate(audioPaths[1:], 1):
        audio = AudioSegment.from_file(path)
        
        if crossfade > 0:
            combined = combined.append(audio, crossfade=int(crossfade * 1000))
        else:
            combined = combined + audio
    
    # Export
    combined.export(outputPath, format=Path(outputPath).suffix[1:])
    
    info = _get_audio_info(outputPath)
    result = {
        "success": True,
        "inputPaths": audioPaths,
        "outputPath": outputPath,
        "crossfade": crossfade,
        "audioInfo": info
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def mix_audio_files(
    audioPaths: List[str],
    volumes: Optional[List[Optional[float]]] = None,
    outputPath: Optional[str] = None
) -> str:
    """Mix multiple audio files together with volume control. Supports both audio and MIDI files."""
    if not audioPaths:
        raise ValueError("At least one audio path is required")
    
    if not outputPath:
        outputPath = str(temp_dir / f"mixed_{len(audioPaths)}_tracks.wav")
    
    # Process volumes - handle None values
    if volumes is None:
        volumes = [0.0] * len(audioPaths)  # No volume change
    else:
        # Ensure volumes list matches audioPaths length
        if len(volumes) != len(audioPaths):
            raise ValueError(f"Number of volumes ({len(volumes)}) must match number of audio paths ({len(audioPaths)})")
        
        # Replace None values with 0.0 (no volume change)
        volumes = [0.0 if vol is None else vol for vol in volumes]
    
    # Convert MIDI files to audio and prepare for mixing
    converted_paths = []
    original_paths = []
    
    for path in audioPaths:
        file_ext = Path(path).suffix.lower()
        
        if file_ext in SUPPORTED_MIDI_FORMATS:
            # Convert MIDI to audio
            converted_path = _convert_midi_to_audio(path)
            converted_paths.append(converted_path)
            original_paths.append(path)
        elif file_ext in SUPPORTED_AUDIO_FORMATS:
            # Validate audio file
            _validate_audio_file(path)
            converted_paths.append(path)
            original_paths.append(path)
        else:
            raise ValueError(f"Unsupported file format: {file_ext}. Supported formats: {', '.join(SUPPORTED_AUDIO_FORMATS | SUPPORTED_MIDI_FORMATS)}")
    
    # Load and adjust volumes
    mixed_audio = None
    for i, (path, volume) in enumerate(zip(converted_paths, volumes)):
        try:
            audio = AudioSegment.from_file(path)
        except Exception as e:
            if "ffprobe" in str(e) or "ffmpeg" in str(e):
                # If ffmpeg is not available, try using librosa for mixing
                return _mix_audio_with_librosa(converted_paths, volumes, outputPath, original_paths)
            else:
                raise e
        
        adjusted_audio = audio + volume
        
        if mixed_audio is None:
            mixed_audio = adjusted_audio
        else:
            # Ensure same length
            max_length = max(len(mixed_audio), len(adjusted_audio))
            mixed_audio = mixed_audio + AudioSegment.silent(duration=max_length - len(mixed_audio))
            adjusted_audio = adjusted_audio + AudioSegment.silent(duration=max_length - len(adjusted_audio))
            
            # Mix
            mixed_audio = mixed_audio.overlay(adjusted_audio)
    
    # Export
    try:
        mixed_audio.export(outputPath, format=Path(outputPath).suffix[1:])
    except Exception as e:
        if "ffmpeg" in str(e):
            # If ffmpeg export fails, try using librosa
            return _mix_audio_with_librosa(converted_paths, volumes, outputPath, original_paths)
        else:
            raise e
    
    # Clean up temporary converted files
    for path in converted_paths:
        if path != original_paths[converted_paths.index(path)]:  # Only delete if it was converted
            try:
                os.remove(path)
            except:
                pass  # Ignore cleanup errors
    
    info = _get_audio_info(outputPath)
    result = {
        "success": True,
        "inputPaths": original_paths,
        "volumes": volumes,
        "outputPath": outputPath,
        "audioInfo": info,
        "convertedFiles": [p != o for p, o in zip(converted_paths, original_paths)]
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def detect_tempo(filePath: str) -> str:
    """Detect the tempo and beat positions in an audio file"""
    _validate_audio_file(filePath)
    
    # Load audio
    y, sr = librosa.load(filePath, sr=None)
    
    # Detect tempo and beats
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    
    # Get beat times
    beat_times = librosa.frames_to_time(beats, sr=sr)
    
    # Calculate beat intervals
    beat_intervals = np.diff(beat_times)
    
    result = {
        "tempo": round(tempo, 2),
        "bpm": round(tempo, 0),
        "beatCount": len(beats),
        "beatTimes": [round(t, 3) for t in beat_times.tolist()],
        "averageBeatInterval": round(float(np.mean(beat_intervals)), 3),
        "beatIntervalStd": round(float(np.std(beat_intervals)), 3),
        "fileName": Path(filePath).name
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def detect_key(filePath: str) -> str:
    """Detect the musical key of an audio file"""
    _validate_audio_file(filePath)
    
    # Load audio
    y, sr = librosa.load(filePath, sr=None)
    
    # Extract chromagram
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    
    # Get key
    key_raw = np.argmax(np.mean(chroma, axis=1))
    key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    detected_key = key_names[key_raw]
    
    # Get key strength
    key_strength = float(np.max(np.mean(chroma, axis=1)))
    
    # Determine major/minor
    # This is a simplified approach - in practice you'd use more sophisticated key detection
    is_major = key_strength > 0.5  # Simplified threshold
    
    result = {
        "key": detected_key,
        "mode": "major" if is_major else "minor",
        "confidence": round(key_strength, 3),
        "chromaProfile": [round(float(x), 3) for x in np.mean(chroma, axis=1)],
        "fileName": Path(filePath).name
    }
    
    return json.dumps(result, indent=2)

@mcp.tool()
def list_available_effects() -> str:
    """List all available audio effects and their parameters"""
    effects = {
        "reverb": {
            "description": "Add reverb effect to audio",
            "parameters": {
                "reverbTime": "Reverb time in milliseconds (default: 100)"
            }
        },
        "echo": {
            "description": "Add echo/delay effect to audio",
            "parameters": {
                "delay": "Delay time in milliseconds (default: 500)",
                "decay": "Echo decay factor 0-1 (default: 0.5)"
            }
        },
        "distortion": {
            "description": "Add distortion effect to audio",
            "parameters": {
                "level": "Distortion level 0-1 (default: 0.1)"
            }
        },
        "lowpass": {
            "description": "Apply low-pass filter",
            "parameters": {
                "cutoff": "Cutoff frequency in Hz (default: 1000)"
            }
        },
        "highpass": {
            "description": "Apply high-pass filter",
            "parameters": {
                "cutoff": "Cutoff frequency in Hz (default: 1000)"
            }
        },
        "reverse": {
            "description": "Reverse audio playback",
            "parameters": {}
        }
    }
    
    return json.dumps(effects, indent=2)

@mcp.tool()
def list_drum_patterns() -> str:
    """List all available drum patterns"""
    patterns = {
        "basic_rock": "Basic rock beat with kick, snare, and hi-hat",
        "basic_jazz": "Basic jazz beat with swing feel",
        "basic_funk": "Basic funk beat with syncopated rhythms"
    }
    
    return json.dumps(patterns, indent=2)

@mcp.tool()
def play_audio(
    filePath: str,
    duration: Optional[float] = None,
    startTime: float = 0.0
) -> str:
    """Play an audio file using pygame. Supports partial playback with start time and duration."""
    _validate_audio_file(filePath)
    
    try:
        import pygame
        
        # Initialize pygame mixer
        pygame.mixer.init()
        
        # Load the audio file
        pygame.mixer.music.load(filePath)
        
        # Set start position if specified
        if startTime > 0:
            pygame.mixer.music.play(start=startTime)
        else:
            pygame.mixer.music.play()
        
        # Get audio info for duration
        audio_info = _get_audio_info(filePath)
        total_duration = audio_info["duration"]
        
        # Calculate actual playback duration
        if duration is None:
            # Play the entire file
            actual_duration = total_duration - startTime
        else:
            # Play for specified duration
            actual_duration = min(duration, total_duration - startTime)
        
        # Wait for playback to complete
        import time
        time.sleep(actual_duration)
        
        # Stop playback
        pygame.mixer.music.stop()
        
        result = {
            "success": True,
            "filePath": filePath,
            "startTime": startTime,
            "requestedDuration": duration,
            "actualDuration": round(actual_duration, 2),
            "totalDuration": total_duration,
            "message": f"Played {Path(filePath).name} for {round(actual_duration, 2)} seconds"
        }
        
        return json.dumps(result, indent=2)
        
    except ImportError:
        raise RuntimeError("pygame is required for audio playback. Please install it with: pip install pygame")
    except Exception as e:
        raise RuntimeError(f"Failed to play audio: {str(e)}")

@mcp.tool()
def play_midi(
    filePath: str,
    duration: Optional[float] = None,
    startTime: float = 0.0
) -> str:
    """Play a MIDI file using pygame. Supports partial playback with start time and duration."""
    _validate_midi_file(filePath)
    
    try:
        import pygame
        
        # Initialize pygame mixer
        pygame.mixer.init()
        
        # Load the MIDI file
        pygame.mixer.music.load(filePath)
        
        # Set start position if specified
        if startTime > 0:
            pygame.mixer.music.play(start=startTime)
        else:
            pygame.mixer.music.play()
        
        # Get MIDI info for duration
        midi_info = _get_midi_info(filePath)
        total_duration = midi_info["duration"]
        
        # Calculate actual playback duration
        if duration is None:
            # Play the entire file
            actual_duration = total_duration - startTime
        else:
            # Play for specified duration
            actual_duration = min(duration, total_duration - startTime)
        
        # Wait for playback to complete
        import time
        time.sleep(actual_duration)
        
        # Stop playback
        pygame.mixer.music.stop()
        
        result = {
            "success": True,
            "filePath": filePath,
            "startTime": startTime,
            "requestedDuration": duration,
            "actualDuration": round(actual_duration, 2),
            "totalDuration": total_duration,
            "message": f"Played {Path(filePath).name} for {round(actual_duration, 2)} seconds"
        }
        
        return json.dumps(result, indent=2)
        
    except ImportError:
        raise RuntimeError("pygame is required for MIDI playback. Please install it with: pip install pygame")
    except Exception as e:
        raise RuntimeError(f"Failed to play MIDI: {str(e)}")

if __name__ == "__main__":
    # Run the server
    mcp.run() 