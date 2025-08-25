"""
Performance Configuration for VAS Video Analytics System
Adjust these settings based on your hardware and requirements
"""

# Video Processing Settings
VIDEO_CONFIG = {
    # Frame processing - lower = better performance, higher = smoother detection
    "process_every_nth_frame": 3,  # Process every 3rd frame (1=all frames, 2=every 2nd, etc.)
    
    # Video resolution - lower = better performance
    "max_width": 960,  # Maximum video width (original: 1280)
    
    # Frame rate control
    "target_fps": 20,  # Target FPS for streaming (lower = better performance)
    "frame_delay": 0.050,  # Delay between frames in seconds
}

# AI Model Settings
AI_CONFIG = {
    # Model size - affects accuracy vs speed
    "model_path": "./pts/vas-dsd-v7-yolov11m.pt",  # Back to fastest model for stability
    
    # Detection confidence - higher = fewer false positives, lower = more detections
    "confidence_threshold": 0.25,  # Back to stable threshold
    
    # Maximum detections to display
    "max_detections": 10,  # Limit detections to reduce WebSocket message size
}

# Video Encoding Settings
ENCODING_CONFIG = {
    # JPEG quality - lower = smaller files, faster encoding
    "jpeg_quality": 75,  # Range: 50 (fast) to 95 (high quality)
    
    # Enable JPEG optimization
    "jpeg_optimize": True,
}

# Network Settings
NETWORK_CONFIG = {
    # WebSocket settings
    "ping_interval": 10.0,  # Seconds between ping messages
    
    # Reconnection settings
    "reconnect_delay": 5,  # Seconds to wait before reconnecting
    "max_reconnect_attempts": 10,
}

# Performance Presets
PRESETS = {
    "high_performance": {
        "process_every_nth_frame": 3,
        "max_width": 960,
        "confidence_threshold": 0.25,
        "jpeg_quality": 75,
        "target_fps": 20,
    },
    
    "balanced": {
        "process_every_nth_frame": 3,
        "max_width": 960,
        "confidence_threshold": 0.25,
        "jpeg_quality": 75,
        "target_fps": 20,
    },
    
    "high_quality": {
        "process_every_nth_frame": 2,
        "max_width": 1280,
        "confidence_threshold": 0.20,
        "jpeg_quality": 85,
        "target_fps": 25,
    }
}

def apply_preset(preset_name):
    """Apply a performance preset"""
    if preset_name not in PRESETS:
        print(f"Unknown preset: {preset_name}")
        print(f"Available presets: {list(PRESETS.keys())}")
        return False
    
    preset = PRESETS[preset_name]
    
    # Update configs
    VIDEO_CONFIG["process_every_nth_frame"] = preset["process_every_nth_frame"]
    VIDEO_CONFIG["max_width"] = preset["max_width"]
    VIDEO_CONFIG["target_fps"] = preset["target_fps"]
    VIDEO_CONFIG["frame_delay"] = 1.0 / preset["target_fps"]
    
    AI_CONFIG["confidence_threshold"] = preset["confidence_threshold"]
    ENCODING_CONFIG["jpeg_quality"] = preset["jpeg_quality"]
    
    print(f"Applied preset: {preset_name}")
    return True

def get_config_summary():
    """Get a summary of current configuration"""
    return {
        "video": VIDEO_CONFIG,
        "ai": AI_CONFIG,
        "encoding": ENCODING_CONFIG,
        "network": NETWORK_CONFIG
    }

# Default preset (change this to adjust default performance)
DEFAULT_PRESET = "high_performance"

# Apply default preset
apply_preset(DEFAULT_PRESET)
