#!/usr/bin/env python3
"""
Batch HEVC to H.264 Video Converter
Converts all HEVC/H.265 encoded videos in a folder to H.264 for better compatibility
"""

import os
import sys
import subprocess
import glob
from pathlib import Path
import time

def get_video_codec(video_path, ffmpeg_cmd='ffprobe'):
    """Check if video is HEVC/H.265 encoded"""
    try:
        cmd = [
            ffmpeg_cmd.replace('ffmpeg', 'ffprobe'), '-v', 'quiet', '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name', '-of', 'csv=s=x:p=0',
            str(video_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        codec = result.stdout.strip().lower()
        return codec in ['hevc', 'h265']
    except Exception as e:
        print(f"Warning: Could not check codec for {video_path}: {e}")
        return True  # Assume it needs conversion if we can't check

def convert_video(input_path, output_path, quality='fast', ffmpeg_cmd='ffmpeg'):
    """Convert single video from HEVC to H.264"""
    
    # Quality presets
    presets = {
        'fast': {'preset': 'veryfast', 'crf': '28'},
        'balanced': {'preset': 'medium', 'crf': '23'},
        'quality': {'preset': 'slow', 'crf': '18'}
    }
    
    config = presets.get(quality, presets['balanced'])
    
    cmd = [
        ffmpeg_cmd, '-i', str(input_path),
        '-c:v', 'libx264',                    # Use H.264 encoder
        '-preset', config['preset'],          # Encoding speed preset
        '-crf', config['crf'],                # Quality level
        '-c:a', 'copy',                       # Copy audio without re-encoding
        '-movflags', '+faststart',            # Optimize for web streaming
        '-y',                                 # Overwrite output file
        str(output_path)
    ]
    
    print(f"Converting: {input_path.name}")
    print(f"Command: {' '.join(cmd)}")
    
    start_time = time.time()
    
    try:
        # Run conversion with progress output
        process = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True,
            timeout=3600  # 1 hour timeout
        )
        
        if process.returncode == 0:
            elapsed = time.time() - start_time
            size_before = input_path.stat().st_size / (1024*1024)  # MB
            size_after = output_path.stat().st_size / (1024*1024)  # MB
            
            print(f"✅ Success! ({elapsed:.1f}s)")
            print(f"   Size: {size_before:.1f}MB → {size_after:.1f}MB")
            return True
        else:
            print(f"❌ FFmpeg error:")
            print(process.stderr[-500:])  # Last 500 chars of error
            return False
            
    except subprocess.TimeoutExpired:
        print(f"❌ Timeout (>1 hour)")
        return False
    except Exception as e:
        print(f"❌ Conversion failed: {e}")
        return False

def main():
    """Main conversion function"""
    
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("Usage: python hevc_to_h264.py <input_folder> [output_folder] [quality]")
        print("\nArguments:")
        print("  input_folder   - Folder containing HEVC videos")
        print("  output_folder  - Output folder (default: input_folder/converted)")
        print("  quality        - fast/balanced/quality (default: fast)")
        print("\nExample:")
        print("  python hevc_to_h264.py ./videos")
        print("  python hevc_to_h264.py ./videos ./h264_videos balanced")
        sys.exit(1)
    
    input_folder = Path(sys.argv[1])
    output_folder = Path(sys.argv[2]) if len(sys.argv) > 2 else input_folder / "converted"
    quality = sys.argv[3] if len(sys.argv) > 3 else "fast"
    
    if not input_folder.exists():
        print(f"❌ Input folder does not exist: {input_folder}")
        sys.exit(1)
    
    # Create output folder
    output_folder.mkdir(parents=True, exist_ok=True)
    
    # Find all video files
    video_extensions = ['*.mp4', '*.mov', '*.mkv', '*.avi', '*.m4v']
    video_files = []
    
    for ext in video_extensions:
        video_files.extend(input_folder.glob(ext))
        video_files.extend(input_folder.glob(ext.upper()))  # Also check uppercase
    
    if not video_files:
        print(f"❌ No video files found in {input_folder}")
        print(f"   Looking for: {', '.join(video_extensions)}")
        sys.exit(1)
    
    print(f"🎬 Found {len(video_files)} video files")
    print(f"📁 Input:  {input_folder}")
    print(f"📁 Output: {output_folder}")
    print(f"⚙️  Quality: {quality}")
    print("=" * 50)
    
    # Check FFmpeg availability
    ffmpeg_paths = ['ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']
    ffmpeg_cmd = None
    
    for path in ffmpeg_paths:
        try:
            result = subprocess.run([path, '-version'], capture_output=True, timeout=5)
            if result.returncode == 0:
                ffmpeg_cmd = path
                print(f"✅ Found FFmpeg at: {path}")
                break
        except (subprocess.TimeoutExpired, FileNotFoundError):
            continue
    
    if not ffmpeg_cmd:
        print("❌ FFmpeg not found!")
        print("   Tried paths:", ffmpeg_paths)
        print("   Install: brew install ffmpeg (macOS)")
        print("   Then restart terminal or run: export PATH=/opt/homebrew/bin:$PATH")
        sys.exit(1)
    
    # Convert each video
    success_count = 0
    for i, video_path in enumerate(video_files, 1):
        print(f"\n[{i}/{len(video_files)}] Processing: {video_path.name}")
        
        # Skip if already H.264
        if not get_video_codec(video_path, ffmpeg_cmd):
            print("⏭️  Already H.264, skipping...")
            continue
        
        # Generate output filename
        output_name = video_path.stem + "_h264" + video_path.suffix
        output_path = output_folder / output_name
        
        # Skip if output already exists
        if output_path.exists():
            print("⏭️  Output already exists, skipping...")
            continue
        
        # Convert
        if convert_video(video_path, output_path, quality, ffmpeg_cmd):
            success_count += 1
        else:
            print(f"⚠️  Failed to convert {video_path.name}")
    
    print("\n" + "=" * 50)
    print(f"🎉 Conversion complete!")
    print(f"   Successful: {success_count}/{len(video_files)}")
    print(f"   Output folder: {output_folder}")
    
    # Show next steps
    if success_count > 0:
        print("\n📋 Next Steps:")
        print("1. Upload converted H.264 videos to Roboflow")
        print("2. Use annotation group: 'workers and safety equipment'")
        print("3. Label classes: person, helmet, safety_vest, blower, fall_down")
        print("4. Export as YOLOv8/Ultralytics format for training")

if __name__ == "__main__":
    main()
