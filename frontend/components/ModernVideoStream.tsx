'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Card, 
  Group, 
  Text, 
  Badge, 
  Stack, 
  Button, 
  Grid, 
  ThemeIcon, 
  Progress, 
  Paper,
  ActionIcon,
  Tooltip,
  Indicator,
  RingProgress,
  Center,
  Box,
  ScrollArea,
  Alert,
  Divider
} from '@mantine/core';
import { 
  Camera, 
  Users, 
  Shield, 
  AlertTriangle, 
  Activity, 
  Target, 
  Eye, 
  EyeOff, 
  Play, 
  Pause,
  CheckCircle,
  XCircle,
  TrendingUp,
  Zap,
  Settings
} from 'lucide-react';
import { notifications } from '@mantine/notifications';

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

interface ModernVideoStreamProps {
  wsUrl?: string;
  onStatsUpdate?: (stats: { connected: boolean; fps: number; detections: number; tracking: boolean }) => void;
}

const ModernVideoStream: React.FC<ModernVideoStreamProps> = ({ 
  wsUrl = "ws://localhost:8000/ws",
  onStatsUpdate
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
        console.log('✅ Video stream connected');
      };

      websocketRef.current.onmessage = (event) => {
        try {
          const message: VideoMessage = JSON.parse(event.data);
          
          if (message.type === 'video_frame' && imgRef.current) {
            imgRef.current.src = `data:image/jpeg;base64,${message.frame}`;
            
            // Calculate frame rate
            frameCountRef.current++;
            const now = Date.now();
            if (now - lastFrameTimeRef.current >= 1000) {
              const fps = Math.round(frameCountRef.current / ((now - lastFrameTimeRef.current) / 1000));
              setFrameRate(fps);
              frameCountRef.current = 0;
              lastFrameTimeRef.current = now;
            }

            // Update detections and zones (less frequent updates)
            if (now - lastFrameTimeRef.current >= 300) { // Reduced from 100ms to 300ms
              setDetections(message.detections);
              setLastUpdate(new Date(message.timestamp * 1000));
              
              if (message.zones) {
                setZones(message.zones);
              }
              
              if (message.tracking_events && message.tracking_events.length > 0) {
                setTrackingEvents(prev => [...message.tracking_events!, ...prev].slice(0, 5)); // Reduced from 10 to 5
                
                const crossingEvents = message.tracking_events.filter(e => e.type === 'line_crossing');
                if (crossingEvents.length > 0) {
                  const latest = crossingEvents[crossingEvents.length - 1];
                  setPeopleCount({ in: latest.in_count || 0, out: latest.out_count || 0 });
                }
              }
              
              lastFrameTimeRef.current = now;
            }
            
            // Update parent stats less frequently
            if (onStatsUpdate && now - lastFrameTimeRef.current >= 1000) { // Only once per second
              onStatsUpdate({
                connected: true,
                fps: frameRate,
                detections: message.detections.length,
                tracking: message.zones?.tracking_enabled || false
              });
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocketRef.current.onclose = (event) => {
        setIsConnected(false);
        setDetections([]);
        setFrameRate(0);
        setTrackingEvents([]);
        setPeopleCount({ in: 0, out: 0 });
        
        if (onStatsUpdate) {
          onStatsUpdate({ connected: false, fps: 0, detections: 0, tracking: false });
        }

        console.log('❌ Video stream disconnected, reconnecting...');
        
        setTimeout(connectWebSocket, 3000);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setTimeout(connectWebSocket, 3000);
    }
  }, [wsUrl, onStatsUpdate, frameRate]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const groupByClass = (detections: Detection[]): Record<string, Detection[]> => {
    return detections.reduce((groups, detection) => {
      const className = detection.class;
      if (!groups[className]) {
        groups[className] = [];
      }
      groups[className].push(detection);
      return groups;
    }, {} as Record<string, Detection[]>);
  };

  const getClassIcon = (className: string) => {
    switch (className) {
      case 'person': return <Users size={14} />;
      case 'helmet': return <Shield size={14} />;
      case 'safety_vest': return <Shield size={14} />;
      default: return <Target size={14} />;
    }
  };

  const getClassColor = (className: string) => {
    switch (className) {
      case 'person': return 'blue';
      case 'helmet': return 'yellow';
      case 'safety_vest': return 'green';
      default: return 'gray';
    }
  };

  const toggleZones = async (show: boolean) => {
    try {
      const response = await fetch('http://localhost:8000/zones/toggle_display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show })
      });
      
      if (response.ok) {
        notifications.show({
          title: 'Zones Updated',
          message: `Zones ${show ? 'shown' : 'hidden'}`,
          color: 'blue',
          icon: show ? <Eye size={16} /> : <EyeOff size={16} />
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to toggle zones',
        color: 'red',
        icon: <AlertTriangle size={16} />
      });
    }
  };

  const toggleTracking = async (enable: boolean) => {
    try {
      const response = await fetch('http://localhost:8000/tracking/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable })
      });
      
      if (response.ok) {
        notifications.show({
          title: 'Tracking Updated',
          message: `Tracking ${enable ? 'enabled' : 'disabled'}`,
          color: enable ? 'green' : 'orange',
          icon: enable ? <Play size={16} /> : <Pause size={16} />
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to toggle tracking',
        color: 'red',
        icon: <AlertTriangle size={16} />
      });
    }
  };

  const detectionGroups = groupByClass(detections);

  return (
    <Grid>
      {/* Video Display */}
      <Grid.Col span={12}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Paper 
            radius="lg"
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden'
            }}
          >
            <Group justify="space-between" p="md" style={{ background: 'rgba(0, 0, 0, 0.5)' }}>
              <Group>
                <Indicator processing={isConnected} color="green" size={8}>
                  <ThemeIcon variant="light" color="blue" size="sm">
                    <Camera size={16} />
                  </ThemeIcon>
                </Indicator>
                <div>
                  <Text size="sm" fw={500} c="white">Live Feed</Text>
                  <Text size="xs" c="dimmed">
                    {frameRate} FPS • {detections.length} detections
                  </Text>
                </div>
              </Group>
              
              <Group gap="xs">
                <Badge variant="dot" color={isConnected ? 'green' : 'red'} size="sm">
                  {isConnected ? 'Online' : 'Offline'}
                </Badge>
              </Group>
            </Group>
            
            <Box style={{ position: 'relative', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                ref={imgRef}
                style={{ 
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: '8px',
                  display: isConnected ? 'block' : 'none'
                }}
                alt="Video Stream"
              />
              
              {!isConnected && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Center style={{ height: '400px', flexDirection: 'column' }}>
                    <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                      <Camera size={30} />
                    </ThemeIcon>
                    <Text c="dimmed" mt="md">Connecting to video stream...</Text>
                    <Progress value={30} animated color="blue" size="sm" w="200px" mt="sm" />
                  </Center>
                </motion.div>
              )}
            </Box>
          </Paper>
        </motion.div>
      </Grid.Col>

      {/* Live Detections */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card 
            radius="lg"
            p="lg"
            style={{
              background: 'rgba(26, 27, 30, 0.9)',
              backdropFilter: 'blur(15px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              height: '300px'
            }}
          >
            <Group justify="space-between" mb="md">
              <Group>
                <ThemeIcon variant="light" color="orange" size="sm">
                  <Target size={16} />
                </ThemeIcon>
                <Text fw={600} c="white">Live Detections</Text>
              </Group>
              <Badge variant="light" color="blue" size="sm">
                {detections.length}
              </Badge>
            </Group>
            
            <ScrollArea h={200}>
              <Stack gap="xs">
                <AnimatePresence>
                  {Object.entries(detectionGroups).map(([className, classDetections]) => (
                                    <div key={className}>
                      <Paper p="xs" radius="md" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                        <Group justify="space-between">
                          <Group gap="xs">
                            <ThemeIcon 
                              size="sm" 
                              radius="md" 
                              variant="light" 
                              color={getClassColor(className)}
                            >
                              {getClassIcon(className)}
                            </ThemeIcon>
                            <Text size="sm" c="white" tt="capitalize">
                              {className.replace('_', ' ')}
                            </Text>
                          </Group>
                          
                          <Group gap="xs">
                            <Text size="xs" c="dimmed">
                              {(classDetections[0]?.confidence * 100).toFixed(0)}%
                            </Text>
                            <Badge variant="light" color={getClassColor(className)} size="xs">
                              {classDetections.length}
                            </Badge>
                            {classDetections.some(d => d.alert) && (
                              <ThemeIcon size="xs" color="red" variant="light">
                                <AlertTriangle size={10} />
                              </ThemeIcon>
                            )}
                          </Group>
                        </Group>
                      </Paper>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {detections.length === 0 && (
                  <Center h={150}>
                    <Stack align="center" gap="xs">
                      <ThemeIcon size="lg" radius="xl" variant="light" color="gray">
                        <Eye size={20} />
                      </ThemeIcon>
                      <Text c="dimmed" size="sm">No objects detected</Text>
                    </Stack>
                  </Center>
                )}
              </Stack>
            </ScrollArea>
          </Card>
        </motion.div>
      </Grid.Col>

      {/* Zone Configuration */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card 
            radius="lg"
            p="lg"
            style={{
              background: 'rgba(26, 27, 30, 0.9)',
              backdropFilter: 'blur(15px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              height: '300px'
            }}
          >
            <Group justify="space-between" mb="md">
              <Group>
                <ThemeIcon variant="light" color="purple" size="sm">
                  <Settings size={16} />
                </ThemeIcon>
                <Text fw={600} c="white">Zone Controls</Text>
              </Group>
              <Group gap="xs">
                {zones?.show_zones && (
                  <Badge variant="light" color="red" size="xs">Visible</Badge>
                )}
                {zones?.tracking_enabled && (
                  <Badge variant="light" color="green" size="xs">Tracking</Badge>
                )}
              </Group>
            </Group>
            
            {zones && (
              <Stack gap="md">
                {/* Zone Info */}
                <Grid>
                  <Grid.Col span={6}>
                    <Paper p="xs" radius="md" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                      <Text size="xs" c="red" fw={500}>Entry Line</Text>
                      <Text size="xs" c="dimmed">
                        ({zones.entry_line.start[0]}, {zones.entry_line.start[1]}) →
                        ({zones.entry_line.end[0]}, {zones.entry_line.end[1]})
                      </Text>
                    </Paper>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Paper p="xs" radius="md" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                      <Text size="xs" c="green" fw={500}>Work Zone</Text>
                      <Text size="xs" c="dimmed">
                        {zones.work_zone.points.length} points
                      </Text>
                    </Paper>
                  </Grid.Col>
                </Grid>

                {/* People Counter */}
                {zones.tracking_enabled && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Paper p="md" radius="md" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                      <Group justify="space-between" mb="sm">
                        <Text size="sm" fw={500} c="blue">People Count</Text>
                        <ThemeIcon variant="light" color="blue" size="xs">
                          <Users size={12} />
                        </ThemeIcon>
                      </Group>
                      <Grid>
                        <Grid.Col span={6}>
                          <Center>
                            <Stack align="center" gap={2}>
                              <Text size="xl" fw={700} c="blue">{peopleCount.in}</Text>
                              <Text size="xs" c="dimmed">IN</Text>
                            </Stack>
                          </Center>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Center>
                            <Stack align="center" gap={2}>
                              <Text size="xl" fw={700} c="orange">{peopleCount.out}</Text>
                              <Text size="xs" c="dimmed">OUT</Text>
                            </Stack>
                          </Center>
                        </Grid.Col>
                      </Grid>
                    </Paper>
                  </motion.div>
                )}

                {/* Control Buttons */}
                <Grid>
                  <Grid.Col span={6}>
                    <Button
                      fullWidth
                      variant="light"
                      color={zones.show_zones ? 'red' : 'blue'}
                      size="xs"
                      leftSection={zones.show_zones ? <EyeOff size={14} /> : <Eye size={14} />}
                      onClick={() => toggleZones(!zones.show_zones)}
                    >
                      {zones.show_zones ? 'Hide' : 'Show'} Zones
                    </Button>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Button
                      fullWidth
                      variant="light"
                      color={zones.tracking_enabled ? 'orange' : 'green'}
                      size="xs"
                      leftSection={zones.tracking_enabled ? <Pause size={14} /> : <Play size={14} />}
                      onClick={() => toggleTracking(!zones.tracking_enabled)}
                    >
                      {zones.tracking_enabled ? 'Disable' : 'Enable'} Tracking
                    </Button>
                  </Grid.Col>
                </Grid>

                {/* Zone Setup Instructions */}
                {zones.show_zones && !zones.tracking_enabled && (
                  <Alert variant="light" color="yellow" icon={<AlertTriangle size={16} />} radius="md">
                    <Text size="xs">
                      Adjust zone coordinates in backend/main.py, then enable tracking when ready.
                    </Text>
                  </Alert>
                )}
              </Stack>
            )}
          </Card>
        </motion.div>
      </Grid.Col>

      {/* Live Events */}
      {zones?.tracking_enabled && (
        <Grid.Col span={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card 
              radius="lg"
              p="lg"
              style={{
                background: 'rgba(26, 27, 30, 0.9)',
                backdropFilter: 'blur(15px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <Group justify="space-between" mb="md">
                <Group>
                  <ThemeIcon variant="light" color="green" size="sm">
                    <Activity size={16} />
                  </ThemeIcon>
                  <Text fw={600} c="white">Live Events</Text>
                </Group>
                <Badge variant="light" color="green" size="sm">
                  {trackingEvents.length}
                </Badge>
              </Group>
              
              <ScrollArea h={200}>
                <Stack gap="xs">
                  <AnimatePresence>
                    {trackingEvents.map((event, index) => (
                      <div key={index}>
                        <Paper 
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
                          <Group justify="space-between">
                            <Group gap="xs">
                              <ThemeIcon 
                                size="sm" 
                                radius="md" 
                                variant="light" 
                                color={event.type === 'safety_violation' ? 'red' : 'blue'}
                              >
                                {event.type === 'safety_violation' ? 
                                  <AlertTriangle size={12} /> : 
                                  <Users size={12} />
                                }
                              </ThemeIcon>
                              <div>
                                <Text size="sm" c="white">
                                  {event.type === 'line_crossing' && 
                                    `Person ID:${event.track_id} crossed entry`
                                  }
                                  {event.type === 'safety_violation' && 
                                    `Safety Alert - ID:${event.track_id}`
                                  }
                                </Text>
                                {event.type === 'safety_violation' && event.violations && (
                                  <Text size="xs" c="red">
                                    {event.violations.join(', ').replace('_', ' ')}
                                  </Text>
                                )}
                              </div>
                            </Group>
                            <Text size="xs" c="dimmed">
                              {new Date(event.timestamp * 1000).toLocaleTimeString()}
                            </Text>
                          </Group>
                        </Paper>
                      </div>
                    ))}
                  </AnimatePresence>
                  
                  {trackingEvents.length === 0 && (
                    <Center h={150}>
                      <Stack align="center" gap="xs">
                        <ThemeIcon size="lg" radius="xl" variant="light" color="gray">
                          <Activity size={20} />
                        </ThemeIcon>
                        <Text c="dimmed" size="sm">No events yet</Text>
                      </Stack>
                    </Center>
                  )}
                </Stack>
              </ScrollArea>
            </Card>
          </motion.div>
        </Grid.Col>
      )}
    </Grid>
  );
};

export default ModernVideoStream;
