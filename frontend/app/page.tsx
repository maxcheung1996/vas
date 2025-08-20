'use client';

import VideoStream from '../components/VideoStream';

export default function Home() {
  return (
    <main className="min-h-screen p-4 bg-gray-50">
      <div className="container mx-auto max-w-6xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            VAS - Video Analytics System
          </h1>
          <p className="text-gray-600">
            Real-time RTSP video streaming with AI-powered object detection
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video Stream */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                Live Camera Feed
              </h2>
              <VideoStream wsUrl="ws://localhost:8000/ws" />
            </div>
          </div>

          {/* Sidebar with Information */}
          <div className="space-y-6">
            {/* System Status */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                System Status
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Backend:</span>
                  <span className="text-green-600 font-medium">Running</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">AI Model:</span>
                  <span className="text-green-600 font-medium">YOLOv11n</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Detection Types:</span>
                  <span className="text-blue-600 font-medium">General Objects</span>
                </div>
              </div>
            </div>

            {/* Detection Info */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Detection Categories
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                  <span className="text-gray-700">People (person)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
                  <span className="text-gray-700">Vehicles (car, bus, truck, etc.)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
                  <span className="text-gray-700">Animals (cat, dog, bird, etc.)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-500 rounded mr-2"></div>
                  <span className="text-gray-700">Household (chair, tv, laptop, etc.)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                  <span className="text-gray-700">Sports (ball, racket, etc.)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-pink-500 rounded mr-2"></div>
                  <span className="text-gray-700">Food (apple, pizza, etc.)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                  <span className="text-gray-700">Other Objects</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button 
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </button>
                <button 
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                  onClick={async () => {
                    try {
                      const response = await fetch('http://localhost:8000/restart_stream');
                      const result = await response.json();
                      alert(`Stream restart: ${result.status}`);
                    } catch (error) {
                      alert('Failed to restart stream');
                    }
                  }}
                >
                  Restart Video Stream
                </button>
                
                {/* Performance Presets */}
                <div className="border-t pt-2 mt-2">
                  <p className="text-sm text-gray-600 mb-2">Performance:</p>
                  <div className="grid grid-cols-3 gap-1">
                    <button 
                      className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      onClick={async () => {
                        try {
                          const response = await fetch('http://localhost:8000/performance/high_performance');
                          const result = await response.json();
                          alert(`Set to: ${result.preset}`);
                        } catch (error) {
                          alert('Failed to set preset');
                        }
                      }}
                    >
                      Fast
                    </button>
                    <button 
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      onClick={async () => {
                        try {
                          const response = await fetch('http://localhost:8000/performance/balanced');
                          const result = await response.json();
                          alert(`Set to: ${result.preset}`);
                        } catch (error) {
                          alert('Failed to set preset');
                        }
                      }}
                    >
                      Balanced
                    </button>
                    <button 
                      className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                      onClick={async () => {
                        try {
                          const response = await fetch('http://localhost:8000/performance/high_quality');
                          const result = await response.json();
                          alert(`Set to: ${result.preset}`);
                        } catch (error) {
                          alert('Failed to set preset');
                        }
                      }}
                    >
                      Quality
                    </button>
                  </div>
                </div>
                <button 
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = 'http://localhost:8000/health';
                    link.target = '_blank';
                    link.click();
                  }}
                >
                  Check Backend Health
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>
            VAS uses YOLOv11n for real-time object detection. 
            Detecting 80+ object classes including people, vehicles, animals, and everyday objects.
          </p>
        </footer>
      </div>
    </main>
  );
}
