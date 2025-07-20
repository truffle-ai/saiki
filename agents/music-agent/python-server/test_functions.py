#!/usr/bin/env python3

"""
Test script to verify individual functions work correctly
"""

import json
import os

# Import the functions we want to test
from main import (
    create_melody,
    create_chord_progression,
    create_drum_pattern,
    list_available_effects,
    list_drum_patterns,
    _get_midi_info,
    play_midi
)

def test_create_melody():
    """Test melody creation"""
    print("🎵 Testing create_melody...")
    
    try:
        result = create_melody(key="G", scale="major", duration=5.0, tempo=140)
        data = json.loads(result)
        
        print(f"✅ Melody created successfully!")
        print(f"   Output: {data['outputPath']}")
        print(f"   Key: {data['key']}")
        print(f"   Duration: {data['duration']}")
        print(f"   Tempo: {data['tempo']}")
        
        # Verify file exists
        if os.path.exists(data['outputPath']):
            print(f"   ✅ File exists: {os.path.getsize(data['outputPath'])} bytes")
        else:
            print(f"   ❌ File not found: {data['outputPath']}")
            
        return True
    except Exception as e:
        print(f"❌ Error creating melody: {e}")
        return False

def test_create_chord_progression():
    """Test chord progression creation"""
    print("\n🎼 Testing create_chord_progression...")
    
    try:
        result = create_chord_progression(key="C", progression="I-IV-V-I", duration=8.0, tempo=120)
        data = json.loads(result)
        
        print(f"✅ Chord progression created successfully!")
        print(f"   Output: {data['outputPath']}")
        print(f"   Key: {data['key']}")
        print(f"   Progression: {data['progression']}")
        print(f"   Duration: {data['duration']}")
        
        # Verify file exists
        if os.path.exists(data['outputPath']):
            print(f"   ✅ File exists: {os.path.getsize(data['outputPath'])} bytes")
        else:
            print(f"   ❌ File not found: {data['outputPath']}")
            
        return True
    except Exception as e:
        print(f"❌ Error creating chord progression: {e}")
        return False

def test_create_drum_pattern():
    """Test drum pattern creation"""
    print("\n🥁 Testing create_drum_pattern...")
    
    try:
        result = create_drum_pattern(pattern="basic_rock", duration=8.0, tempo=120)
        data = json.loads(result)
        
        print(f"✅ Drum pattern created successfully!")
        print(f"   Output: {data['outputPath']}")
        print(f"   Pattern: {data['pattern']}")
        print(f"   Duration: {data['duration']}")
        
        # Verify file exists
        if os.path.exists(data['outputPath']):
            print(f"   ✅ File exists: {os.path.getsize(data['outputPath'])} bytes")
        else:
            print(f"   ❌ File not found: {data['outputPath']}")
            
        return True
    except Exception as e:
        print(f"❌ Error creating drum pattern: {e}")
        return False

def test_list_available_effects():
    """Test listing available effects"""
    print("\n🎚️ Testing list_available_effects...")
    
    try:
        result = list_available_effects()
        data = json.loads(result)
        
        print(f"✅ Effects listed successfully!")
        print(f"   Available effects: {list(data.keys())}")
        
        # Check if we have the expected effects
        expected_effects = ["reverb", "echo", "distortion", "lowpass", "highpass", "reverse"]
        for effect in expected_effects:
            if effect in data:
                print(f"   ✅ {effect}: {data[effect]['description']}")
            else:
                print(f"   ❌ Missing effect: {effect}")
                
        return True
    except Exception as e:
        print(f"❌ Error listing effects: {e}")
        return False

def test_list_drum_patterns():
    """Test listing drum patterns"""
    print("\n🥁 Testing list_drum_patterns...")
    
    try:
        result = list_drum_patterns()
        data = json.loads(result)
        
        print(f"✅ Drum patterns listed successfully!")
        print(f"   Available patterns: {list(data.keys())}")
        
        # Check if we have the expected patterns
        expected_patterns = ["basic_rock", "basic_jazz", "basic_funk"]
        for pattern in expected_patterns:
            if pattern in data:
                print(f"   ✅ {pattern}: {data[pattern]}")
            else:
                print(f"   ❌ Missing pattern: {pattern}")
                
        return True
    except Exception as e:
        print(f"❌ Error listing drum patterns: {e}")
        return False

def test_midi_info():
    """Test MIDI info extraction"""
    print("\n📊 Testing MIDI info extraction...")
    
    try:
        # First create a melody to test with
        melody_result = create_melody(key="A", scale="minor", duration=3.0, tempo=100)
        melody_data = json.loads(melody_result)
        
        # Now test getting info from that file
        info = _get_midi_info(melody_data['outputPath'])
        
        print(f"✅ MIDI info extracted successfully!")
        print(f"   Duration: {info['duration']} seconds")
        print(f"   Tempo: {info['tempo']} BPM")
        print(f"   Instruments: {info['instruments']}")
        print(f"   Note count: {info['noteCount']}")
        print(f"   File size: {info['fileSize']} bytes")
        
        return True
    except Exception as e:
        print(f"❌ Error extracting MIDI info: {e}")
        return False

def test_play_midi():
    """Test MIDI playback"""
    print("\n🎵 Testing MIDI playback...")
    
    try:
        # First create a melody to test with
        melody_result = create_melody(key="C", scale="major", duration=2.0, tempo=120)
        melody_data = json.loads(melody_result)
        
        # Test playing the MIDI file for a short duration
        result = play_midi(melody_data['outputPath'], duration=1.0)
        data = json.loads(result)
        
        print(f"✅ MIDI playback successful!")
        print(f"   File: {data['filePath']}")
        print(f"   Requested duration: {data['requestedDuration']} seconds")
        print(f"   Actual duration: {data['actualDuration']} seconds")
        print(f"   Message: {data['message']}")
        
        return True
    except Exception as e:
        print(f"❌ Error playing MIDI: {e}")
        return False

def main():
    """Run all tests"""
    print("🎵 Music Creator Agent - Function Tests")
    print("=" * 50)
    
    tests = [
        test_create_melody,
        test_create_chord_progression,
        test_create_drum_pattern,
        test_list_available_effects,
        test_list_drum_patterns,
        test_midi_info,
        test_play_midi
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"🎉 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All tests passed! The Music Creator Agent is working correctly.")
    else:
        print("❌ Some tests failed. Please check the errors above.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1) 