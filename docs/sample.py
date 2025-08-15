# sample detection service
import asyncio, json, cv2, websockets
from ultralytics import YOLO               # loads GPU model by default

MODEL_PATH = "best.pt"                     # weights from Roboflow
CAMERA_URL = "rtsp://user:pass@ip/stream"  # demo camera
WS_SERVER  = "ws://localhost:8000/ws"      # FastAPI WebSocket

# 1️⃣ load model once (GPU warm-up)
model = YOLO(MODEL_PATH)

# 2️⃣ simple helper: send alert to back-end
async def push_alert(class_name, conf, bbox):
    payload = {"event": class_name, "conf": conf, "bbox": bbox}
    async with websockets.connect(WS_SERVER) as ws:
        await ws.send(json.dumps(payload))

# 3️⃣ read, infer, alert
async def main():
    cap = cv2.VideoCapture(CAMERA_URL, cv2.CAP_FFMPEG)
    while True:
        ok, frame = cap.read()
        if not ok:             # lost stream
            await asyncio.sleep(1); continue

        # run YOLO (returns numpy array of detections)
        results = model(frame, verbose=False)[0]
        for box in results.boxes:
            cls = model.names[int(box.cls)]
            if cls in {"no_helmet", "no_vest"} and box.conf > 0.50:
                await push_alert(cls, float(box.conf), box.xyxy.tolist()[0])
        await asyncio.sleep(0)  # let event loop breathe

asyncio.run(main())




# sample backend
from fastapi import FastAPI, WebSocket
import json, asyncio

app = FastAPI()
subscribers: set[WebSocket] = set()

@app.websocket("/ws")
async def alarms(ws: WebSocket):
    await ws.accept()
    subscribers.add(ws)
    try:
        while True:                       # wait for detector messages
            data = await ws.receive_text()
            # broadcast to dashboard clients:
            dead = []
            for client in subscribers:
                try:
                    await client.send_text(data)
                except Exception:
                    dead.append(client)
            for d in dead: subscribers.discard(d)
    finally:
        subscribers.discard(ws)

# run with: uvicorn backend:app --host 0.0.0.0 --port 8000