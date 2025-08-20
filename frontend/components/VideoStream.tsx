'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
  alert: boolean;
}

interface VideoMessage {
  type: string;
  timestamp: number;
  frame: string;
  detections: Detection[];
}

interface VideoStreamProps {
  wsUrl?: string;
}

const restartStream = async () => {
  try {
    const response = await fetch('http://localhost:8000/restart_stream');
    const result = await response.json();
    console.log('Stream restart result:', result);
  } catch (error) {
    console.error('Failed to restart stream:', error);
  }
};

const VideoStream: React.FC<VideoStreamProps> = ({ 
  wsUrl = 'ws://localhost:8000/ws' 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [frameRate, setFrameRate] = useState(0);
  const websocketRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());

  const connectWebSocket = useCallback(() => {
    try {
      websocketRef.current = new WebSocket(wsUrl);
      
      websocketRef.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected');
      };

      websocketRef.current.onmessage = (event) => {
        try {
          const message: VideoMessage = JSON.parse(event.data);
          
          if (message.type === 'video_frame') {
            // Update video frame with optimized loading
            if (imgRef.current) {
              // Create object URL for better performance
              const imageData = `data:image/jpeg;base64,${message.frame}`;
              imgRef.current.src = imageData;
            }
            
            // Update detections (throttle updates for better performance)
            const now = Date.now();
            if (now - lastFrameTimeRef.current >= 100) { // Update UI every 100ms max
              setDetections(message.detections);
              setLastUpdate(new Date(message.timestamp * 1000));
              lastFrameTimeRef.current = now;
            }
            
            // Calculate frame rate
            frameCountRef.current++;
            if (now - lastFrameTimeRef.current >= 1000) {
              setFrameRate(frameCountRef.current);
              frameCountRef.current = 0;
            }
          } else if (message.type === 'ping') {
            // Respond to ping to keep connection alive
            if (websocketRef.current?.readyState === WebSocket.OPEN) {
              websocketRef.current.send(JSON.stringify({ type: 'pong' }));
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocketRef.current.onclose = (event) => {
        setIsConnected(false);
        console.log('WebSocket disconnected', event.code, event.reason);
        // Clear detections on disconnect
        setDetections([]);
        setFrameRate(0);
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setTimeout(connectWebSocket, 3000);
    }
  }, [wsUrl]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Helper function to get color class for different object types
  const getColorClass = (className: string) => {
    // People
    if (className === "person") return "bg-blue-500";
    
    // Vehicles
    if (["car", "bus", "truck", "bicycle", "motorcycle", "airplane", "boat", "train"].includes(className)) 
      return "bg-orange-500";
    
    // Animals
    if (["cat", "dog", "bird", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"].includes(className)) 
      return "bg-yellow-500";
    
    // Household items
    if (["chair", "couch", "dining table", "bed", "toilet", "tv", "laptop", "keyboard", "cell phone", "microwave", "oven", "toaster", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"].includes(className)) 
      return "bg-purple-500";
    
    // Sports equipment
    if (["sports ball", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket"].includes(className)) 
      return "bg-red-500";
    
    // Food
    if (["apple", "orange", "banana", "hot dog", "pizza", "donut", "cake"].includes(className)) 
      return "bg-pink-500";
    
    // Default for other objects
    return "bg-green-500";
  };

  // Group detections by class for better display
  const detectionGroups = detections.reduce((groups, detection) => {
    const className = detection.class;
    if (!groups[className]) {
      groups[className] = [];
    }
    groups[className].push(detection);
    return groups;
  }, {} as Record<string, Detection[]>);

  return (
    <div className="video-stream-container">
      {/* Status Bar */}
      <div className="status-bar">
        <div className="connection-status">
          <div className={`status-dot ${isConnected ? 'connected' : ''}`}></div>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="stream-info">
          <span>FPS: {frameRate}</span>
          <span className="ml-4">Objects: {detections.length}</span>
          {lastUpdate && (
            <span className="ml-4">
              Last Update: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          {!isConnected && (
            <button 
              onClick={restartStream}
              className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Restart Stream
            </button>
          )}
        </div>
      </div>

      {/* Video Display */}
      <div className="video-container">
        <img
          ref={imgRef}
          className="video-stream"
          alt="RTSP Video Stream"
          style={{ 
            display: isConnected ? 'block' : 'none',
            imageRendering: 'auto',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)' // Enable hardware acceleration
          }}
        />
        {!isConnected && (
          <div className="flex items-center justify-center h-64 bg-gray-200 rounded-lg">
            <p className="text-gray-500">Connecting to video stream...</p>
          </div>
        )}
      </div>

      {/* Detection Results */}
      {detections.length > 0 && (
        <div className="alerts-panel">
          <h3 className="text-lg font-semibold mb-2">🎯 Live Detections</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(detectionGroups).map(([className, classDetections]) => (
              <div key={className} className="detection-group">
                <div className="flex items-center mb-2">
                  <div className={`w-3 h-3 rounded mr-2 ${getColorClass(className)}`}></div>
                  <h4 className="font-medium text-white capitalize">
                    {className} ({classDetections.length})
                  </h4>
                </div>
                
                {classDetections.slice(0, 3).map((detection, index) => (
                  <div key={index} className="text-sm text-gray-300 ml-5 mb-1">
                    Confidence: {(detection.confidence * 100).toFixed(1)}%
                  </div>
                ))}
                
                {classDetections.length > 3 && (
                  <div className="text-xs text-gray-400 ml-5">
                    +{classDetections.length - 3} more
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {detections.length === 0 && isConnected && (
        <div className="alerts-panel">
          <p className="text-gray-400 text-center">No objects detected</p>
        </div>
      )}
    </div>
  );
};

export default VideoStream;
