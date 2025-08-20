# VAS Performance Optimization Guide

## 🚀 Performance Improvements Applied

Your video streaming lag has been fixed with these optimizations:

### **Backend Optimizations**

1. **Switched back to YOLOv11n** - Much faster than YOLOv11x
2. **Process every 3rd frame** - Reduces AI processing load by 66%
3. **Optimized confidence threshold** - 0.25 for balanced accuracy/performance
4. **Reduced video resolution** - Max 960px width (was 1280px)
5. **Faster JPEG encoding** - Quality 75 with optimization enabled
6. **Limited detections** - Top 10 highest confidence per frame
7. **Configurable frame rate** - 20 FPS for smooth performance

### **Frontend Optimizations**

1. **Hardware acceleration** - CSS transforms for GPU rendering
2. **Throttled UI updates** - UI updates max every 100ms
3. **Optimized image rendering** - Better browser performance
4. **Reduced DOM updates** - Less frequent re-renders

## 📊 Performance Presets

You can now switch between performance levels:

### **🟢 Fast (High Performance)**
- Process every 4th frame
- 720p max resolution
- Confidence: 0.35 (fewer detections)
- JPEG quality: 65
- 15 FPS
- **Best for**: Low-end hardware, battery savings

### **🔵 Balanced (Default)**
- Process every 3rd frame  
- 960p max resolution
- Confidence: 0.25
- JPEG quality: 75
- 20 FPS
- **Best for**: Most situations

### **🟣 Quality (High Quality)**
- Process every 2nd frame
- 1280p max resolution
- Confidence: 0.20 (more detections)
- JPEG quality: 85
- 25 FPS
- **Best for**: High-end hardware, detailed analysis

## 🎛️ How to Change Performance

### **Via Web UI:**
1. Go to the "Quick Actions" panel
2. Click **Fast**, **Balanced**, or **Quality** buttons
3. Changes apply immediately

### **Via API:**
```bash
# Set to high performance
curl http://localhost:8000/performance/high_performance

# Set to balanced
curl http://localhost:8000/performance/balanced

# Set to high quality  
curl http://localhost:8000/performance/high_quality
```

### **Via Configuration File:**
Edit `backend/config.py` and restart the server:

```python
# For maximum performance
VIDEO_CONFIG["process_every_nth_frame"] = 5  # Process every 5th frame
VIDEO_CONFIG["max_width"] = 640              # Lower resolution
AI_CONFIG["confidence_threshold"] = 0.4      # Fewer detections
ENCODING_CONFIG["jpeg_quality"] = 60         # Lower quality
```

## 🔧 Manual Tuning

### **Reduce Lag Further:**
```python
# In config.py
VIDEO_CONFIG["process_every_nth_frame"] = 5  # Process fewer frames
VIDEO_CONFIG["max_width"] = 640              # Lower resolution
VIDEO_CONFIG["frame_delay"] = 0.080          # 12.5 FPS
```

### **Improve Quality:**
```python
# In config.py  
VIDEO_CONFIG["process_every_nth_frame"] = 1  # Process all frames
VIDEO_CONFIG["max_width"] = 1920             # Higher resolution
AI_CONFIG["confidence_threshold"] = 0.15     # More detections
ENCODING_CONFIG["jpeg_quality"] = 90         # Higher quality
```

## 📈 Performance Monitoring

### **Check Current Settings:**
```bash
curl http://localhost:8000/config
```

### **Monitor Health:**
```bash
curl http://localhost:8000/health
```

### **Watch FPS in UI:**
The status bar shows real-time FPS and object count.

## 🛠️ Hardware Recommendations

### **For Low Lag:**
- **CPU**: 4+ cores recommended
- **RAM**: 8GB+ 
- **GPU**: Not required (CPU-only)
- **Network**: Wired connection preferred

### **Model Comparison:**
- **YOLOv11n**: Fastest, good accuracy
- **YOLOv11s**: 2x slower than n, better accuracy
- **YOLOv11m**: 4x slower than n, much better accuracy
- **YOLOv11x**: 10x slower than n, best accuracy

## 🚨 If Still Laggy

1. **Try "Fast" preset** - Click the green "Fast" button
2. **Lower video resolution** - Edit max_width in config.py
3. **Process fewer frames** - Increase process_every_nth_frame
4. **Use wired connection** - WiFi can add latency
5. **Close other apps** - Free up CPU/memory
6. **Check camera settings** - Use main stream, not sub-stream

## 💡 Pro Tips

- **Start with "Fast" preset** then gradually increase quality
- **Monitor FPS counter** - Should stay above 15 FPS
- **Use Chrome/Edge** - Better WebSocket performance than Firefox
- **Enable hardware acceleration** in browser settings
- **Test different confidence thresholds** - Higher = fewer false positives

Your system should now run **much smoother** with these optimizations! 🎉
