import asyncio, json, cv2, websockets, base64, time
from ultralytics import YOLO
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from typing import List
from contextlib import asynccontextmanager
from config import VIDEO_CONFIG, AI_CONFIG, ENCODING_CONFIG, NETWORK_CONFIG, apply_preset, get_config_summary

MODEL_PATH = AI_CONFIG["model_path"]  # Configurable model path
CAMERA_URL = "rtsp://viewer:1234567890.@14.0.203.211:557/streaming/channels/101/"
VIDEO_URL = "./sample_videos/dsd-site-0809.mp4"

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
            if frame_count % VIDEO_CONFIG["process_every_nth_frame"] == 0:  # Configurable frame processing
                try:
                    results = model(frame, verbose=False)[0]
                    
                    # Draw detection boxes on frame
                    if results.boxes is not None:
                        for box in results.boxes:
                            if box is not None:
                                cls = model.names[int(box.cls)]
                                conf = float(box.conf)
                                
                                if conf > AI_CONFIG["confidence_threshold"]:
                                    x1, y1, x2, y2 = map(int, box.xyxy.tolist()[0])
                                    
                                    # Use different colors for different object categories
                                    if cls == "person":
                                        color = (255, 0, 0)  # Blue for people
                                    elif cls in ["car", "bus", "truck", "bicycle", "motorcycle", "airplane", "boat", "train"]:
                                        color = (0, 165, 255)  # Orange for vehicles
                                    elif cls in ["cat", "dog", "bird", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"]:
                                        color = (0, 255, 255)  # Yellow for animals
                                    elif cls in ["chair", "couch", "dining table", "bed", "toilet", "tv", "laptop", "keyboard", "cell phone", "microwave", "oven", "toaster", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"]:
                                        color = (255, 0, 255)  # Purple/Magenta for household items
                                    elif cls in ["sports ball", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket"]:
                                        color = (0, 0, 255)  # Red for sports equipment
                                    elif cls in ["apple", "orange", "banana", "hot dog", "pizza", "donut", "cake"]:
                                        color = (255, 192, 203)  # Pink for food
                                    else:
                                        color = (0, 255, 0)  # Green for other objects
                                    
                                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                                    cv2.putText(frame, f"{cls}: {conf:.2f}", (x1, y1-10), 
                                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                                    
                                    detections.append({
                                        "class": cls,
                                        "confidence": conf,
                                        "bbox": [x1, y1, x2, y2],
                                        "alert": False  # No specific alerts for general detection
                                    })
                except Exception as e:
                    print(f"Error in YOLO detection: {e}")

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
                        "detections": limited_detections
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

# Startup is now handled by lifespan context manager

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)