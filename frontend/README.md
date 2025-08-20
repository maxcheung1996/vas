# VAS Frontend - Video Analytics System

A Next.js frontend for displaying real-time RTSP video streams with AI-powered safety detection.

## Features

- 🎥 Real-time RTSP video streaming via WebSocket
- 🤖 AI-powered safety equipment detection (helmets, vests)
- 📊 Live detection alerts and status monitoring
- 📱 Responsive design for desktop and mobile
- ⚡ Real-time frame rate monitoring

## Prerequisites

- Node.js 18+ 
- Running VAS backend server (Python FastAPI)

## Installation

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Configuration

The frontend connects to the backend WebSocket at `ws://localhost:8000/ws` by default. 

To change the backend URL, modify the `wsUrl` prop in `app/page.tsx`:

```tsx
<VideoStream wsUrl="ws://your-backend-url:8000/ws" />
```

## Backend Requirements

Make sure your Python backend is running with:

```bash
cd ../backend
python main.py
```

The backend should be accessible at `http://localhost:8000`

## Features Overview

### Video Stream Component
- Displays real-time video from RTSP cameras
- Shows detection bounding boxes and labels
- Automatic reconnection on connection loss

### Detection Alerts
- Real-time safety violation alerts
- Confidence scores for each detection
- Color-coded alerts (red for violations, green for compliance)

### System Monitoring
- Connection status indicator
- Frame rate monitoring
- Last update timestamp

## Troubleshooting

### Connection Issues
- Ensure backend is running on port 8000
- Check CORS settings in backend allow frontend origin
- Verify WebSocket endpoint is accessible

### Video Not Displaying
- Check RTSP camera URL in backend configuration
- Ensure camera is accessible from backend server
- Verify camera supports the configured format

### Performance Issues
- Reduce video resolution in backend
- Adjust frame rate in backend (currently ~30 FPS)
- Consider using HLS instead of WebSocket for high-traffic scenarios

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

WebSocket and modern JavaScript features are required.
