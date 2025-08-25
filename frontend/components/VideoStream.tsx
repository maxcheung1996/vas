'use client';

import { Badge, Center, Group, Paper, ScrollArea, Stack, ThemeIcon, Text, Card, Box} from '@mantine/core';
import { Activity, AlertTriangle, BarChart2, Footprints } from 'lucide-react';
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
  alert: boolean;
}

interface TrackingEvent {
  type: string;
  track_id?: number;
  in_count?: number;
  out_count?: number;
  violations?: string[];
  position?: [number, number];
  timestamp: number;
}

interface VideoMessage {
  type: string;
  timestamp: number;
  frame: string;
  detections: Detection[];
  zones?: {
    entry_line: { start: [number, number]; end: [number, number] };
    work_zone: { points: number[][] };
    show_zones: boolean;
    tracking_enabled: boolean;
  };
  tracking_events?: TrackingEvent[];
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
  const [zones, setZones] = useState<VideoMessage['zones'] | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [peopleCount, setPeopleCount] = useState({ in: 0, out: 0 });
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
              if (message.zones) {
                setZones(message.zones);
              }
              if (message.tracking_events && message.tracking_events.length > 0) {
                setTrackingEvents(prev => [...message.tracking_events!, ...prev].slice(0, 10)); // Keep last 10 events
                
                // Update people count from line crossing events
                const crossingEvents = message.tracking_events.filter(e => e.type === 'line_crossing');
                if (crossingEvents.length > 0) {
                  const latest = crossingEvents[crossingEvents.length - 1];
                  setPeopleCount({ in: latest.in_count || 0, out: latest.out_count || 0 });
                }
              }
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
        // Clear all data on disconnect
        setDetections([]);
        setFrameRate(0);
        setTrackingEvents([]);
        setPeopleCount({ in: 0, out: 0 });
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
          <span style={{ color: isConnected ? '#10b981' : undefined }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
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

      {/* Detection Results - Fixed Height Panel */}
      {/* {isConnected && (
        <div className="alerts-panel detection-panel-container">
          <h3 className="text-lg font-semibold mb-2">🎯 Live Detections</h3>
          
          <div className="h-32 border border-gray-600 rounded bg-gray-800 overflow-hidden">
            {detections.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-center">No objects detected</p>
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-3">
                <div className="space-y-1">
                  {Object.entries(detectionGroups).map(([className, classDetections]) => (
                    <div key={className} className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm h-10 min-h-[2.5rem]">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className={`w-3 h-3 rounded mr-2 flex-shrink-0 ${getColorClass(className)}`}></div>
                        <span className="text-white capitalize font-medium truncate">
                          {className.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-gray-300 text-xs">
                          {(classDetections[0]?.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="bg-gray-600 text-gray-300 px-2 py-1 rounded text-xs min-w-[1.5rem] text-center">
                          {classDetections.length}
                        </span>
                        {classDetections.some(d => d.alert) && (
                          <span className="text-red-400 flex-shrink-0">⚠️</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )} */}

      {/* Zone Configuration Panel */}
      {zones && (
        <div className="alerts-panel zone-config-panel">
          {/* <h3 className="text-lg font-semibold mb-2">🎯 Zone Configuration</h3> */}
          
          <div className="space-y-4">
            {/* Zone Status */}
            {/* <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-red-400">🔴 Entry Line:</span>
                <div className="text-gray-300 ml-4">
                  ({zones.entry_line.start[0]}, {zones.entry_line.start[1]}) → 
                  ({zones.entry_line.end[0]}, {zones.entry_line.end[1]})
                </div>
              </div>
              <div>
                <span className="text-green-400">🟢 Work Zone:</span>
                <div className="text-gray-300 ml-4">
                  {zones.work_zone.points.length} points
                </div>
              </div>
            </div> */}

            {/* Control Buttons */}
            {/* <div className="grid grid-cols-2 gap-2">
              <button 
                className={`px-3 py-2 rounded text-sm ${zones.show_zones 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-600 hover:bg-gray-700'} text-white`}
                onClick={async () => {
                  try {
                    const response = await fetch('http://localhost:8000/zones/toggle_display', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ show: !zones.show_zones })
                    });
                    const result = await response.json();
                    console.log('Toggle zones:', result);
                  } catch (error) {
                    console.error('Failed to toggle zones:', error);
                  }
                }}
              >
                {zones.show_zones ? 'Hide Zones' : 'Show Zones'}
              </button>

              <button 
                className={`px-3 py-2 rounded text-sm ${zones.tracking_enabled 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-orange-600 hover:bg-orange-700'} text-white`}
                onClick={async () => {
                  try {
                    const response = await fetch('http://localhost:8000/tracking/enable', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ enable: !zones.tracking_enabled })
                    });
                    const result = await response.json();
                    console.log('Toggle tracking:', result);
                  } catch (error) {
                    console.error('Failed to toggle tracking:', error);
                  }
                }}
              >
                {zones.tracking_enabled ? 'Disable Tracking' : 'Enable Tracking'}
              </button>
            </div> */}

            {/* Zone Instructions */}
            {/* {zones.show_zones && !zones.tracking_enabled && (
              <div className="text-yellow-400 text-xs border-l-2 border-yellow-400 pl-2">
                <p><strong>Zone Setup:</strong></p>
                <p>• Red line = Entry counting line</p>
                <p>• Green area = Work zone boundary</p>
                <p>• Adjust coordinates in backend/main.py</p>
                <p>• Enable tracking when zones look correct</p>
              </div>
            )} */}

            {/* People Count Display */}
            {/* {zones.tracking_enabled && (
              <Group gap="md" mt="md">
                <Paper
                  radius="md"
                  p="md"
                  style={{
                    background: 'rgba(37, 99, 235, 0.15)',
                    minWidth: 120,
                    flex: 1,
                  }}
                  withBorder
                >
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'white',
                    fontWeight: 600,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    display: 'block'
                  }}>
                    IN
                  </span>
                  <span style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'white',
                    display: 'block'
                  }}>
                    {peopleCount.in}
                  </span>
                </Paper>
                <Paper
                  radius="md"
                  p="md"
                  style={{
                    background: 'rgba(251, 146, 60, 0.15)',
                    minWidth: 120,
                    flex: 1,
                  }}
                  withBorder
                >
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'orange',
                    fontWeight: 600,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    display: 'block'
                  }}>
                    OUT
                  </span>
                  <span style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'white',
                    display: 'block'
                  }}>
                    {peopleCount.out}
                  </span>
                </Paper>
              </Group>
            )} */}
          </div>
        </div>
      )}

      {/* Tracking Events - Fixed Height Panel */}
      {zones?.tracking_enabled && (
        <Card
          radius="lg"
          p="lg"
          style={{
            background: 'rgba(26, 27, 30, 0.9)',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            marginTop: 16,
          }}
        >
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon variant="light" color="green" size="sm">
                <BarChart2 size={16} />
              </ThemeIcon>
              <Text fw={600} c="white">Live Events</Text>
            </Group>
            <Badge variant="light" color="green" size="sm">
              {trackingEvents.length}
            </Badge>
          </Group>
          <ScrollArea h={160}>
            <Stack gap="xs">
              {trackingEvents.length === 0 ? (
                <Center h={120}>
                  <Stack align="center" gap="xs">
                    <ThemeIcon size="lg" radius="xl" variant="light" color="gray">
                      <Activity size={20} />
                    </ThemeIcon>
                    <Text c="dimmed" size="sm">No events yet</Text>
                  </Stack>
                </Center>
              ) : (
                trackingEvents.map((event, index) => (
                  <Paper
                    key={index}
                    p="sm"
                    radius="md"
                    style={{
                      background: event.type === 'safety_violation'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(59, 130, 246, 0.1)',
                      border: `1px solid ${event.type === 'safety_violation'
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'rgba(59, 130, 246, 0.3)'}`
                    }}
                  >
                    <Group align="flex-start" gap="xs">
                      <ThemeIcon
                        size="sm"
                        radius="md"
                        variant="light"
                        color={event.type === 'safety_violation' ? 'red' : 'blue'}
                      >
                        {event.type === 'safety_violation'
                          ? <AlertTriangle size={14} />
                          : <Footprints size={14} />}
                      </ThemeIcon>
                      <div>
                        {event.type === 'line_crossing' && (
                          <Text size="sm" c="blue.3">
                            Person ID:{event.track_id} crossed entry line
                          </Text>
                        )}
                        {event.type === 'safety_violation' && (
                          <Text size="sm" c="red.3">
                            ID:{event.track_id} - {event.violations?.join(', ')}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed" mt={2}>
                          {new Date(event.timestamp * 1000).toLocaleTimeString()}
                        </Text>
                      </div>
                    </Group>
                  </Paper>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
};

export default VideoStream;
