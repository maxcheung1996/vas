'use client';

import { useState } from 'react';
import { 
  AppShell, 
  Container, 
  Grid, 
  Paper, 
  Title, 
  Text, 
  Badge, 
  Group, 
  Stack, 
  Button, 
  Card,
  ThemeIcon,
  Center
} from '@mantine/core';
import { 
  Video, 
  Activity, 
  Shield, 
  Users, 
  AlertTriangle, 
  Settings, 
  RotateCcw,
  Zap,
  Target,
  TrendingUp,
  Server,
  Cpu
} from 'lucide-react';
import { notifications } from '@mantine/notifications';
import VideoStream from '../components/VideoStream';

export default function Home() {
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);

  const handlePerformancePreset = async (preset: string) => {
    try {
      const response = await fetch(`http://localhost:8000/performance/${preset}`);
      const result = await response.json();
      notifications.show({
        title: 'Performance Updated',
        message: `Switched to ${result.preset} mode`,
        color: 'blue',
        icon: <Zap size={16} />
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update performance settings',
        color: 'red',
        icon: <AlertTriangle size={16} />
      });
    }
  };

  const restartStream = async () => {
    try {
      const response = await fetch('http://localhost:8000/restart_stream');
      const result = await response.json();
      notifications.show({
        title: 'Stream Restarted',
        message: result.message || 'Success',
        color: 'green',
        icon: <RotateCcw size={16} />
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to restart stream',
        color: 'red',
        icon: <AlertTriangle size={16} />
      });
    }
  };

  const checkHealth = async () => {
    try {
      const response = await fetch('http://localhost:8000/health');
      const result = await response.json();
      setIsBackendHealthy(true);
      notifications.show({
        title: 'Backend Health',
        message: `Status: ${result.status}`,
        color: 'green',
        icon: <Server size={16} />
      });
    } catch (error) {
      setIsBackendHealthy(false);
      notifications.show({
        title: 'Backend Offline',
        message: 'Cannot connect to server',
        color: 'red',
        icon: <Server size={16} />
      });
    }
  };

  return (
    <AppShell
      padding="md"
      style={{
        background: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%)',
        minHeight: '100vh'
      }}
    >
      <Container size="xl" px="md">
        {/* Header */}
        <Paper
          radius="xl"
          p="xl"
          mb="xl"
          style={{
            background: 'rgba(26, 27, 30, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Center>
            <Stack align="center" gap="sm">
              <Group>
                <ThemeIcon size={48} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                  <Video size={24} />
                </ThemeIcon>
                <div>
                  <Title order={1} size="h1" c="white" fw={700}>
                    VAS Analytics
                  </Title>
                  <Text c="dimmed" size="lg">
                    AI-Powered Video Security & Safety Monitoring
                  </Text>
                </div>
              </Group>
              
              <Group mt="sm">
                <Badge variant="light" color="blue" leftSection={<Activity size={14} />}>
                  Real-time Processing
                </Badge>
                <Badge variant="light" color="green" leftSection={<Shield size={14} />}>
                  Safety Detection
                </Badge>
                <Badge variant="light" color="orange" leftSection={<Users size={14} />}>
                  People Tracking
                </Badge>
              </Group>
            </Stack>
          </Center>
        </Paper>

        <Grid>
          {/* Zone Configuration Panel */}
          <Grid.Col span={{ base: 12, lg: 3 }}>
            <Stack gap="md">
              {/* Zone Configuration */}
              <Card
                radius="xl"
                p="lg"
                style={{
                  background: 'rgba(26, 27, 30, 0.9)',
                  backdropFilter: 'blur(15px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Group justify="space-between" mb="md">
                  <Text fw={600} c="white">Zone Configuration</Text>
                  <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                    <Target size={14} />
                  </ThemeIcon>
                </Group>
                
                <Stack gap="sm">
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={500} c="white">Entry Line</Text>
                      <Badge variant="light" color="red" size="xs">Detection Zone</Badge>
                    </Group>
                    <Paper p="sm" style={{ background: 'rgba(255, 0, 0, 0.1)', border: '1px solid rgba(255, 0, 0, 0.3)' }}>
                      <Text size="xs" c="dimmed">
                        Red line for people counting
                      </Text>
                      <Group gap="xs" mt="xs">
                        <Text size="xs" c="dimmed">Start: (200, 250)</Text>
                        <Text size="xs" c="dimmed">End: (800, 250)</Text>
                      </Group>
                    </Paper>
                  </div>
                  
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={500} c="white">Work Zone</Text>
                      <Badge variant="light" color="green" size="xs">Safety Area</Badge>
                    </Group>
                    <Paper p="sm" style={{ background: 'rgba(0, 255, 0, 0.1)', border: '1px solid rgba(0, 255, 0, 0.3)' }}>
                      <Text size="xs" c="dimmed">
                        Green polygon for safety monitoring
                      </Text>
                      <Text size="xs" c="dimmed" mt="xs">
                        4 corner points defined
                      </Text>
                    </Paper>
                  </div>
                  
                  <Group mt="md">
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      onClick={() => {
                        fetch('http://localhost:8000/zones/toggle_display', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ show: true })
                        });
                        notifications.show({
                          title: 'Zones Visible',
                          message: 'Detection zones are now displayed',
                          color: 'blue'
                        });
                      }}
                    >
                      Show Zones
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="gray"
                      onClick={() => {
                        fetch('http://localhost:8000/zones/toggle_display', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ show: false })
                        });
                        notifications.show({
                          title: 'Zones Hidden',
                          message: 'Detection zones are now hidden',
                          color: 'gray'
                        });
                      }}
                    >
                      Hide Zones
                    </Button>
                  </Group>
                  
                  <Group mt="sm">
                    <Button
                      size="sm"
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'cyan' }}
                      fullWidth
                      onClick={() => {
                        fetch('http://localhost:8000/tracking/enable', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enable: true })
                        });
                        notifications.show({
                          title: 'Tracking Enabled',
                          message: 'DeepSORT tracking is now active',
                          color: 'green',
                          icon: <Activity size={16} />
                        });
                      }}
                    >
                      Enable Tracking
                    </Button>
                  </Group>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
          
          {/* Main Video Stream */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Paper
              radius="lg"
              p="lg"
              style={{
                background: 'rgba(26, 27, 30, 0.9)',
                backdropFilter: 'blur(15px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <Group justify="space-between" mb="md">
                <Text fw={600} c="white">Live Camera Feed</Text>
                <Badge variant="dot" color={isBackendHealthy ? 'green' : 'red'}>
                  {isBackendHealthy ? 'Online' : 'Offline'}
                </Badge>
              </Group>
              
              <VideoStream wsUrl="ws://localhost:8000/ws" />
            </Paper>
          </Grid.Col>

          {/* Control Panels */}
          <Grid.Col span={{ base: 12, lg: 3 }}>
            <Stack gap="md">
              
              {/* System Performance */}
              <Card
                radius="xl"
                p="lg"
                style={{
                  background: 'rgba(26, 27, 30, 0.9)',
                  backdropFilter: 'blur(15px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Group justify="space-between" mb="md">
                  <Text fw={600} c="white">Performance Presets</Text>
                  <ThemeIcon size="sm" radius="md" variant="light" color="yellow">
                    <Zap size={14} />
                  </ThemeIcon>
                </Group>
                
                <Grid>
                  <Grid.Col span={4}>
                    <Button
                      fullWidth
                      variant="light"
                      color="green"
                      size="xs"
                      onClick={() => handlePerformancePreset('high_performance')}
                    >
                      Fast
                    </Button>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Button
                      fullWidth
                      variant="light"
                      color="blue"
                      size="xs"
                      onClick={() => handlePerformancePreset('balanced')}
                    >
                      Balanced
                    </Button>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Button
                      fullWidth
                      variant="light"
                      color="violet"
                      size="xs"
                      onClick={() => handlePerformancePreset('high_quality')}
                    >
                      Quality
                    </Button>
                  </Grid.Col>
                </Grid>
              </Card>

              {/* System Controls */}
              <Card
                radius="xl"
                p="lg"
                style={{
                  background: 'rgba(26, 27, 30, 0.9)',
                  backdropFilter: 'blur(15px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Group justify="space-between" mb="md">
                  <Text fw={600} c="white">System Controls</Text>
                  <ThemeIcon size="sm" radius="md" variant="light" color="red">
                    <Settings size={14} />
                  </ThemeIcon>
                </Group>
                
                <Stack gap="xs">
                  <Button
                    fullWidth
                    leftSection={<RotateCcw size={16} />}
                    variant="light"
                    color="orange"
                    onClick={restartStream}
                  >
                    Restart Stream
                  </Button>
                  
                  <Button
                    fullWidth
                    leftSection={<Server size={16} />}
                    variant="light"
                    color="gray"
                    onClick={checkHealth}
                  >
                    Backend Health
                  </Button>
                </Stack>
              </Card>

              {/* AI Detection Status */}
              <Card
                radius="xl"
                p="lg"
                style={{
                  background: 'rgba(26, 27, 30, 0.9)',
                  backdropFilter: 'blur(15px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Group justify="space-between" mb="md">
                  <Text fw={600} c="white">AI Detection</Text>
                  <ThemeIcon size="sm" radius="md" variant="light" color="purple">
                    <Target size={14} />
                  </ThemeIcon>
                </Group>
                
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Group gap="xs">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                      <Text size="sm" c="dimmed">Person</Text>
                    </Group>
                    <Badge variant="light" color="blue" size="sm">Primary</Badge>
                  </Group>
                  
                  <Group justify="space-between">
                    <Group gap="xs">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} />
                      <Text size="sm" c="dimmed">Helmet</Text>
                    </Group>
                    <Badge variant="light" color="yellow" size="sm">Safety</Badge>
                  </Group>
                  
                  <Group justify="space-between">
                    <Group gap="xs">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                      <Text size="sm" c="dimmed">Safety Vest</Text>
                    </Group>
                    <Badge variant="light" color="green" size="sm">Safety</Badge>
                  </Group>
                </Stack>
              </Card>

            </Stack>
          </Grid.Col>
        </Grid>

        {/* Footer */}
        <Paper
          radius="xl"
          p="md"
          mt="xl"
          style={{
            background: 'rgba(26, 27, 30, 0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <Center>
            <Group>
              <ThemeIcon size="sm" radius="md" variant="light" color="gray">
                <Cpu size={14} />
              </ThemeIcon>
              <Text c="dimmed" size="sm">
                Powered by YOLOv11n • Real-time Safety Monitoring • Industrial AI Solution
              </Text>
            </Group>
          </Center>
        </Paper>
      </Container>
    </AppShell>
  );
}