#!/usr/bin/env python3
"""
Simple camera connection tester for debugging RTSP issues
"""
import cv2
import sys
import time

def test_camera_connection(rtsp_url):
    """Test RTSP camera connection and display basic info"""
    print(f"Testing camera connection: {rtsp_url}")
    print("-" * 50)
    
    try:
        # Test with different backends
        backends = [
            (cv2.CAP_FFMPEG, "FFmpeg"),
            (cv2.CAP_GSTREAMER, "GStreamer"),
            (cv2.CAP_ANY, "Any")
        ]
        
        for backend, name in backends:
            print(f"\nTrying {name} backend...")
            cap = cv2.VideoCapture(rtsp_url, backend)
            
            if cap.isOpened():
                print(f"✅ {name} backend: Connection successful")
                
                # Get camera properties
                width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                fps = cap.get(cv2.CAP_PROP_FPS)
                fourcc = cap.get(cv2.CAP_PROP_FOURCC)
                
                print(f"   Resolution: {int(width)}x{int(height)}")
                print(f"   FPS: {fps}")
                print(f"   Codec: {int(fourcc)}")
                
                # Test frame reading
                print("   Testing frame capture...")
                start_time = time.time()
                frame_count = 0
                
                for i in range(10):  # Try to read 10 frames
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        frame_count += 1
                    else:
                        print(f"   ❌ Failed to read frame {i+1}")
                        break
                    
                    if i == 0:
                        print(f"   First frame shape: {frame.shape}")
                
                elapsed = time.time() - start_time
                if frame_count > 0:
                    actual_fps = frame_count / elapsed
                    print(f"   ✅ Successfully read {frame_count}/10 frames")
                    print(f"   Actual FPS: {actual_fps:.2f}")
                else:
                    print("   ❌ Failed to read any frames")
                
                cap.release()
                
                if frame_count >= 8:  # If we got most frames successfully
                    print(f"\n🎉 {name} backend works well for this camera!")
                    return True
                    
            else:
                print(f"❌ {name} backend: Failed to connect")
                cap.release()
    
    except Exception as e:
        print(f"❌ Error testing camera: {e}")
    
    return False

def main():
    if len(sys.argv) != 2:
        print("Usage: python test_camera.py <rtsp_url>")
        print("Example: python test_camera.py rtsp://user:pass@192.168.1.100:554/stream")
        sys.exit(1)
    
    rtsp_url = sys.argv[1]
    
    print("RTSP Camera Connection Tester")
    print("=" * 50)
    
    success = test_camera_connection(rtsp_url)
    
    if success:
        print("\n✅ Camera connection test PASSED")
        print("Your camera should work with the VAS system.")
    else:
        print("\n❌ Camera connection test FAILED")
        print("\nTroubleshooting tips:")
        print("1. Check if the RTSP URL is correct")
        print("2. Verify username and password")
        print("3. Ensure camera is accessible from this network")
        print("4. Try testing with VLC media player first")
        print("5. Check camera codec settings (H.264 recommended)")
        print("6. Consider using main stream instead of sub stream")

if __name__ == "__main__":
    main()
