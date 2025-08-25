import asyncio, json, cv2, websockets, base64, time
from ultralytics import YOLO
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from typing import List
from contextlib import asynccontextmanager
from pydantic import BaseModel
from config import VIDEO_CONFIG, AI_CONFIG, ENCODING_CONFIG, NETWORK_CONFIG, apply_preset, get_config_summary
import supervision as sv
import numpy as np

# Pydantic models for API requests
class TrackingRequest(BaseModel):
    enable: bool

class ZoneDisplayRequest(BaseModel):
    show: bool

MODEL_PATH = AI_CONFIG["model_path"]
CAMERA_URL = "rtsp://viewer:1234567890.@14.0.203.211:557/streaming/channels/101/"
VIDEO_URL = "./sample_videos/dsd-site-0825_h264.mp4"

# Zone Configuration (adjust these coordinates based on your video)
# ENTRY_LINE: (x1, y1) to (x2, y2) - people crossing this line will be counted
ENTRY_LINE_START = (200, 250)  # Left point of entry line
ENTRY_LINE_END = (800, 250)    # Right point of entry line

# WORK_ZONE: polygon points defining the work area
WORK_ZONE_POINTS = [
    [450, 150],   # Top-left
    [600, 150],   # Top-right  
    [800, 500],   # Bottom-right
    [25, 500]    # Bottom-left
]

# Zone visualization settings
SHOW_ZONES = True  # Set to False to hide zones after confirmation
ENABLE_TRACKING = False  # Set to True after zones are positioned correctly

# Global task variable for cleanup
video_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global video_task
    # Startup
    print("Starting video streaming...")
    video_task = asyncio.create_task(stream_video())
    yield
    # Shutdown
    print("Shutting down video streaming...")
    if video_task:
        video_task.cancel()
        try:
            await video_task
        except asyncio.CancelledError:
            pass

app = FastAPI(lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO(MODEL_PATH)

# Initialize supervision zones and tracker
entry_line = sv.LineZone(start=sv.Point(*ENTRY_LINE_START), end=sv.Point(*ENTRY_LINE_END))
work_zone = sv.PolygonZone(polygon=np.array(WORK_ZONE_POINTS))

# Initialize ByteTrack tracker (from supervision)
tracker = sv.ByteTrack()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Failed to send message to client: {e}")
                disconnected.append(connection)
        
        # Remove disconnected clients
        for connection in disconnected:
            try:
                self.active_connections.remove(connection)
            except ValueError:
                pass  # Already removed

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle ping/pong
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                try:
                    await websocket.send_text('{"type": "ping"}')
                except:
                    break
            except:
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)

async def stream_video():
    cap = None
    frame_count = 0
    last_reconnect = 0
    
    def create_capture():
        try:
            # Create capture with better codec options
            capture = cv2.VideoCapture(VIDEO_URL, cv2.CAP_FFMPEG)
            
            # Set optimal buffer and codec settings
            capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce buffer to minimize latency
            capture.set(cv2.CAP_PROP_FPS, 30)  # Set target FPS
            capture.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('H', '2', '6', '4'))  # Prefer H.264
            
            # Test if capture is working
            if capture.isOpened():
                ret, test_frame = capture.read()
                if ret and test_frame is not None:
                    print(f"Successfully connected to camera: {CAMERA_URL}")
                    return capture
                else:
                    print("Camera opened but couldn't read frame")
                    capture.release()
                    return None
            else:
                print("Failed to open camera")
                capture.release()
                return None
        except Exception as e:
            print(f"Error creating capture: {e}")
            return None
    
    while True:
        try:
            # Initialize or reconnect camera if needed
            if cap is None or not cap.isOpened():
                if cap is not None:
                    cap.release()
                
                # Prevent too frequent reconnection attempts
                current_time = time.time()
                if current_time - last_reconnect < 5:  # Wait 5 seconds between reconnects
                    await asyncio.sleep(1)
                    continue
                
                print("Attempting to connect to camera...")
                cap = create_capture()
                last_reconnect = current_time
                
                if cap is None:
                    print("Failed to connect to camera, retrying in 5 seconds...")
                    await asyncio.sleep(5)
                    continue
            
            # Read frame
            ok, frame = cap.read()
            if not ok or frame is None:
                print("Failed to read frame, attempting reconnection...")
                if cap is not None:
                    cap.release()
                cap = None
                await asyncio.sleep(1)
                continue

            frame_count += 1
            
            # Skip frames if no clients connected (save resources)
            if not manager.active_connections:
                await asyncio.sleep(0.1)
                continue
            
            # Optimize frame size for better performance
            height, width = frame.shape[:2]
            if width > VIDEO_CONFIG["max_width"]:
                scale = VIDEO_CONFIG["max_width"] / width
                new_width = int(width * scale)
                new_height = int(height * scale)
                frame = cv2.resize(frame, (new_width, new_height))

            # Run YOLO detection (skip some frames for performance)
            detections = []
            tracking_events = []
            
            if frame_count % VIDEO_CONFIG["process_every_nth_frame"] == 0:  # Configurable frame processing
                try:
                    results = model(frame, device='mps', verbose=False)[0]
                    
                    # Process detections
                    if results.boxes is not None:
                        # Collect valid detections
                        persons_for_tracking = []
                        all_detections = []
                        
                        for box in results.boxes:
                            if box is not None:
                                cls = model.names[int(box.cls)]
                                conf = float(box.conf)
                                
                                if conf > AI_CONFIG["confidence_threshold"] and cls in {"person", "helmet", "safety_vest"}:
                                    x1, y1, x2, y2 = map(int, box.xyxy.tolist()[0])
                                    
                                    detection_data = {
                                        "class": cls,
                                        "confidence": conf,
                                        "bbox": [x1, y1, x2, y2],
                                        "alert": False
                                    }
                                    all_detections.append(detection_data)
                                    
                                    # Collect persons for tracking
                                    if cls == "person":
                                        persons_for_tracking.append({
                                            "bbox": [x1, y1, x2, y2],
                                            "confidence": conf
                                        })
                        
                        detections = all_detections
                        
                        # Tracking logic (if enabled) - using supervision's ByteTrack
                        if ENABLE_TRACKING and len(persons_for_tracking) > 0:
                            try:
                                # Convert person detections to supervision format
                                xyxy = []
                                confidences = []
                                class_ids = []
                                
                                for p in persons_for_tracking:
                                    bbox = p["bbox"]  # [x1, y1, x2, y2]
                                    conf = p["confidence"]
                                    xyxy.append(bbox)
                                    confidences.append(conf)
                                    class_ids.append(0)  # 0 for person class
                                
                                # Create supervision Detections object
                                detections_sv = sv.Detections(
                                    xyxy=np.array(xyxy),
                                    confidence=np.array(confidences),
                                    class_id=np.array(class_ids)
                                )
                                
                                # Update tracker with detections
                                detections_sv = tracker.update_with_detections(detections_sv)


                                
                                # Process tracking results with proper error handling
                                if hasattr(detections_sv, 'tracker_id') and detections_sv.tracker_id is not None and len(detections_sv.tracker_id) > 0:
                                    for i, tracker_id in enumerate(detections_sv.tracker_id):
                                        try:
                                            if tracker_id is None:
                                                continue
                                            
                                            # Get bounding box coordinates
                                            x1, y1, x2, y2 = map(int, detections_sv.xyxy[i])
                                            center_x = (x1 + x2) // 2
                                            center_y = (y1 + y2) // 2
                                            
                                            # Draw person with track ID
                                            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 3)
                                            cv2.putText(frame, f"ID:{tracker_id}", (x1, y1-30), 
                                                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)
                                            
                                            # Line crossing detection using supervision LineZone
                                            # Create detection for this single tracked person
                                            single_detection = sv.Detections(
                                                xyxy=np.array([[x1, y1, x2, y2]]),
                                                confidence=np.array([1.0]),
                                                tracker_id=np.array([tracker_id])
                                            )
                                            
                                            # Trigger line zone with the detection
                                            crossed_in, crossed_out = entry_line.trigger(single_detection)
                                            
                                            if crossed_in or crossed_out:
                                                tracking_events.append({
                                                    "type": "line_crossing",
                                                    "track_id": int(tracker_id),
                                                    "in_count": entry_line.in_count,
                                                    "out_count": entry_line.out_count,
                                                    "center": [center_x, center_y],
                                                    "timestamp": time.time()
                                                })
                                                direction = "in" if crossed_in else "out"
                                                print(f"🚶 Person ID:{tracker_id} crossed line {direction}. In:{entry_line.in_count}, Out:{entry_line.out_count}")
                                            
                                            # Check if person is in work zone using supervision PolygonZone
                                            in_work_zone = work_zone.trigger(single_detection)
                                            
                                            print(f"Work zone check completed for track {tracker_id}")
                                            
                                            if in_work_zone:
                                                # Check for safety violations
                                                has_helmet = False
                                                has_vest = False
                                                
                                                # Check if helmet/vest detected near this person
                                                for det in all_detections:
                                                    if det["class"] in ["helmet", "safety_vest"]:
                                                        det_bbox = det["bbox"]
                                                        if boxes_overlap([x1, y1, x2, y2], det_bbox):
                                                            if det["class"] == "helmet":
                                                                has_helmet = True
                                                            elif det["class"] == "safety_vest":
                                                                has_vest = True
                                                
                                                # Generate safety alerts
                                                violations = []
                                                if not has_helmet:
                                                    violations.append("no_helmet")
                                                if not has_vest:
                                                    violations.append("no_vest")
                                                
                                                if violations:
                                                    tracking_events.append({
                                                        "type": "safety_violation",
                                                        "track_id": int(tracker_id),
                                                        "violations": violations,
                                                        "position": [center_x, center_y],
                                                        "timestamp": time.time()
                                                    })
                                                    print(f"⚠️ Safety violation by ID:{tracker_id}: {violations}")
                                                    
                                                    # Update detection alert status
                                                    for det in detections:
                                                        if det["class"] == "person" and det["bbox"] == [x1, y1, x2, y2]:
                                                            det["alert"] = True
                                                            break
                                        except Exception as track_error:
                                            print(f"Error processing individual track {i}: {track_error}")
                                            import traceback
                                            traceback.print_exc()
                                            continue
                            
                            except Exception as e:
                                print(f"Error in tracking: {e}")
                                import traceback
                                traceback.print_exc()
                        
                        # Non-tracking mode: simple detection display
                        if not ENABLE_TRACKING:
                            for det in all_detections:
                                x1, y1, x2, y2 = det["bbox"]
                                cls = det["class"]
                                conf = det["confidence"]
                                
                                # Simple color scheme
                                if cls == "person":
                                    color = (255, 0, 0)   # Blue for persons
                                elif cls == "helmet":
                                    color = (0, 255, 255) # Yellow/Cyan for helmets
                                else:  # safety_vest
                                    color = (0, 255, 0)   # Green for safety vests
                                
                                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                                cv2.putText(frame, f"{cls}: {conf:.2f}", (x1, y1-10), 
                                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                        else:
                            # In tracking mode, also draw helmet and vest detections
                            for det in all_detections:
                                if det["class"] in ["helmet", "safety_vest"]:
                                    x1, y1, x2, y2 = det["bbox"]
                                    cls = det["class"]
                                    conf = det["confidence"]
                                    
                                    color = (0, 255, 255) if cls == "helmet" else (0, 255, 0)
                                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                                    cv2.putText(frame, f"{cls}: {conf:.2f}", (x1, y1-10), 
                                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
                except Exception as e:
                    print(f"Error in YOLO detection: {e}")

            # Draw zones for visualization (if enabled)
            if SHOW_ZONES:
                # Draw entry line (red line)
                cv2.line(frame, ENTRY_LINE_START, ENTRY_LINE_END, (0, 0, 255), 3)
                cv2.putText(frame, "ENTRY LINE", 
                           (ENTRY_LINE_START[0], ENTRY_LINE_START[1] - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                
                # Draw work zone polygon (green outline)
                pts = np.array(WORK_ZONE_POINTS, np.int32)
                pts = pts.reshape((-1, 1, 2))
                cv2.polylines(frame, [pts], True, (0, 255, 0), 3)
                cv2.putText(frame, "WORK ZONE", 
                           (WORK_ZONE_POINTS[0][0], WORK_ZONE_POINTS[0][1] - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

            # Encode frame as JPEG with error handling
            try:
                # Use configurable JPEG encoding
                encoding_params = [cv2.IMWRITE_JPEG_QUALITY, ENCODING_CONFIG["jpeg_quality"]]
                if ENCODING_CONFIG["jpeg_optimize"]:
                    encoding_params.extend([cv2.IMWRITE_JPEG_OPTIMIZE, 1])
                
                _, buffer = cv2.imencode('.jpg', frame, encoding_params)
                
                if buffer is not None:
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    
                    # Limit detections to reduce message size
                    limited_detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)[:AI_CONFIG["max_detections"]]
                    
                    # Send frame and detection data to connected clients
                    message = {
                        "type": "video_frame",
                        "timestamp": time.time(),
                        "frame": frame_base64,
                        "detections": limited_detections,
                        "zones": {
                            "entry_line": {"start": ENTRY_LINE_START, "end": ENTRY_LINE_END},
                            "work_zone": {"points": WORK_ZONE_POINTS},
                            "show_zones": SHOW_ZONES,
                            "tracking_enabled": ENABLE_TRACKING
                        },
                        "tracking_events": tracking_events if ENABLE_TRACKING else []
                    }
                    
                    await manager.broadcast(json.dumps(message))
                else:
                    print("Failed to encode frame")
            except Exception as e:
                print(f"Error encoding frame: {e}")
            
            # Control frame rate for optimal performance
            await asyncio.sleep(VIDEO_CONFIG["frame_delay"])
            
        except Exception as e:
            print(f"Error in video streaming: {e}")
            if cap is not None:
                cap.release()
            cap = None
            await asyncio.sleep(2)  # Wait before retry

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "connected_clients": len(manager.active_connections),
        "camera_url": CAMERA_URL,
        "config": get_config_summary()
    }

@app.get("/restart_stream")
async def restart_stream():
    """Endpoint to restart video stream if it gets stuck"""
    global video_task
    try:
        if video_task:
            video_task.cancel()
            try:
                await video_task
            except asyncio.CancelledError:
                pass
        
        # Restart the task
        video_task = asyncio.create_task(stream_video())
        return {"status": "stream restarted"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/performance/{preset}")
async def set_performance_preset(preset: str):
    """Set performance preset: high_performance, balanced, or high_quality"""
    success = apply_preset(preset)
    if success:
        return {"status": "success", "preset": preset, "config": get_config_summary()}
    else:
        return {"status": "error", "message": f"Invalid preset: {preset}"}

@app.get("/config")
async def get_config():
    """Get current configuration"""
    return get_config_summary()

@app.post("/zones/entry_line")
async def update_entry_line(start_x: int, start_y: int, end_x: int, end_y: int):
    """Update entry line coordinates"""
    global ENTRY_LINE_START, ENTRY_LINE_END, entry_line
    ENTRY_LINE_START = (start_x, start_y)
    ENTRY_LINE_END = (end_x, end_y)
    entry_line = sv.LineZone(start=sv.Point(*ENTRY_LINE_START), end=sv.Point(*ENTRY_LINE_END))
    return {"status": "success", "entry_line": {"start": ENTRY_LINE_START, "end": ENTRY_LINE_END}}

@app.post("/zones/work_zone")
async def update_work_zone(points: List[List[int]]):
    """Update work zone polygon points"""
    global WORK_ZONE_POINTS, work_zone
    WORK_ZONE_POINTS = points
    work_zone = sv.PolygonZone(polygon=np.array(WORK_ZONE_POINTS))
    return {"status": "success", "work_zone": {"points": WORK_ZONE_POINTS}}

@app.post("/zones/toggle_display")
async def toggle_zone_display(request: ZoneDisplayRequest):
    """Toggle zone visualization on/off"""
    global SHOW_ZONES
    SHOW_ZONES = request.show
    return {"status": "success", "show_zones": SHOW_ZONES}

@app.post("/tracking/enable")
async def enable_tracking(request: TrackingRequest):
    """Enable/disable tracking functionality"""
    global ENABLE_TRACKING, tracker, entry_line
    ENABLE_TRACKING = request.enable
    
    if request.enable:
        # Reset tracker and counters when enabling
        tracker = sv.ByteTrack()
        entry_line = sv.LineZone(start=sv.Point(*ENTRY_LINE_START), end=sv.Point(*ENTRY_LINE_END))
        print("✅ Tracking enabled - ByteTrack initialized")
    else:
        print("⏸️ Tracking disabled")
    
    return {"status": "success", "tracking_enabled": ENABLE_TRACKING}

def boxes_overlap(box1, box2, threshold=0.3):
    """Check if two bounding boxes overlap significantly"""
    x1_min, y1_min, x1_max, y1_max = box1
    x2_min, y2_min, x2_max, y2_max = box2
    
    # Calculate intersection
    x_min = max(x1_min, x2_min)
    y_min = max(y1_min, y2_min)
    x_max = min(x1_max, x2_max)
    y_max = min(y1_max, y2_max)
    
    if x_min >= x_max or y_min >= y_max:
        return False
    
    intersection = (x_max - x_min) * (y_max - y_min)
    box2_area = (x2_max - x2_min) * (y2_max - y2_min)
    
    # Check if helmet/vest overlaps significantly with person
    overlap_ratio = intersection / box2_area if box2_area > 0 else 0
    return overlap_ratio > threshold

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)