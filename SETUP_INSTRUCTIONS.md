# VAS - Video Analytics System Setup

Complete setup instructions for running RTSP video streaming with AI safety detection on Next.js.

## Overview

This system consists of:
- **Backend**: Python FastAPI server that processes RTSP streams with YOLO object detection
- **Frontend**: Next.js web application that displays the video stream with real-time detection alerts

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Update camera settings in main.py
# Change CAMERA_URL = "rtsp://user:pass@ip/stream" to your camera URL

# Run the backend server
python main.py
```

The backend will start on `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend

# Install Node.js dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Configuration

### Camera Setup

Edit `backend/main.py` and update the `CAMERA_URL`:

```python
CAMERA_URL = "rtsp://username:password@camera_ip:port/stream_path"
```

Common RTSP URL formats:
- Generic: `rtsp://user:pass@192.168.1.100:554/stream1`
- Hikvision: `rtsp://user:pass@192.168.1.100:554/Streaming/Channels/101`
- Dahua: `rtsp://user:pass@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0`

### Performance Tuning

In `backend/main.py`, you can adjust:

```python
# Frame rate (lower = less CPU usage)
await asyncio.sleep(0.033)  # ~30 FPS, change to 0.066 for ~15 FPS

# Detection confidence threshold
if conf > 0.50:  # Increase for fewer false positives

# Video resolution (in stream_video function)
if width > 1280:  # Reduce for better performance
```

## System Architecture

```
RTSP Camera → Python Backend (FastAPI + YOLO) → WebSocket → Next.js Frontend
```

1. **RTSP Camera** streams video to backend
2. **Python Backend** processes frames with YOLO object detection
3. **WebSocket** sends processed frames and detection data to frontend
4. **Next.js Frontend** displays video with overlay alerts

## Detection Classes

The system detects:
- ✅ **Safe**: People wearing helmets and safety vests
- ⚠️ **Unsafe**: `no_helmet`, `no_vest` (triggers alerts)

## Troubleshooting

### Video Stream Getting Stuck

If your video stream gets stuck after a few minutes (common with HEVC/H.265 cameras):

**Quick Fix:**
1. Use the "Restart Video Stream" button in the UI
2. Or visit: `http://localhost:8000/restart_stream`
3. Or restart the backend server

**Test Your Camera:**
```bash
cd backend
python test_camera.py "rtsp://your_camera_url"
```

### Backend Issues

**Camera connection fails:**
- Verify RTSP URL is correct
- Test camera URL with VLC media player first
- Check network connectivity to camera
- Ensure camera supports RTSP
- Run the camera test script: `python test_camera.py <rtsp_url>`

**HEVC/H.265 codec errors:**
- These are common and handled automatically now
- The system will reconnect automatically
- Consider switching camera to H.264 if possible

**High CPU usage:**
- System now processes every 2nd frame for better performance
- Reduce frame rate in `main.py` (change `await asyncio.sleep(0.040)`)
- Lower video resolution
- Adjust detection confidence threshold

### Frontend Issues

**Video not displaying:**
- Check backend is running on port 8000
- Verify WebSocket connection in browser console
- Ensure CORS is configured correctly

**Connection keeps dropping:**
- Check network stability
- Verify firewall settings
- Consider using wired connection

### General Issues

**Installation problems:**
- Python 3.8+ required for backend
- Node.js 18+ required for frontend
- Install FFmpeg for better video handling

## Alternative Streaming Methods

### Option 1: HLS Streaming (Better Performance)

For higher performance, consider using HLS instead of WebSocket:

```python
# Add to backend
import subprocess

def start_hls_stream():
    subprocess.run([
        'ffmpeg', '-i', CAMERA_URL,
        '-c:v', 'libx264', '-hls_time', '2',
        '-hls_list_size', '3', '-f', 'hls',
        'static/stream.m3u8'
    ])
```

### Option 2: MJPEG Stream

For simpler setup:

```python
# Add route to backend
@app.get("/video_feed")
def video_feed():
    return StreamingResponse(
        generate_frames(), 
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
```

## Production Deployment

### Backend
- Use Gunicorn with uvicorn workers
- Configure reverse proxy (nginx)
- Set up SSL certificates
- Add environment variables for configuration

### Frontend
- Build for production: `npm run build`
- Deploy to Vercel, Netlify, or custom server
- Configure environment variables
- Set up CDN for better performance

## Development Tips

- Use browser dev tools to monitor WebSocket connection
- Check backend logs for detection accuracy
- Test with different camera angles and lighting
- Consider adding database logging for detections

## Support

For issues:
1. Check this documentation
2. Verify all dependencies are installed
3. Test components individually (camera → backend → frontend)
4. Check browser console and backend logs for errors
