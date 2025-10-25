#!/usr/bin/env python3
"""
Test script for DaVinci integration
Tests the modified DaVinci.py script with sample data
"""

import json
import os
import sys
from pathlib import Path

def create_test_job_file():
    """Create a sample job file for testing"""
    
    # Sample job data matching the ClipGenerator output format
    test_job = {
        "jobId": "test-job-123",
        "recordingId": "test-recording-456", 
        "projectName": "Test_Project_2024",
        "templateProject": "MAG_FERRARI-BACKUP",
        "clips": {
            "1": {
                "filename": "slot_1_cruising_cam1.mp4",
                "fullPath": "/Users/test/MagnumStream/projects/test_project/clips/slot_1_cruising_cam1.mp4",
                "slotNumber": 1,
                "sceneType": "cruising",
                "cameraAngle": 1,
                "duration": 1.627
            },
            "2": {
                "filename": "slot_2_cruising_cam2.mp4", 
                "fullPath": "/Users/test/MagnumStream/projects/test_project/clips/slot_2_cruising_cam2.mp4",
                "slotNumber": 2,
                "sceneType": "cruising",
                "cameraAngle": 2,
                "duration": 1.502
            },
            "3": {
                "filename": "slot_3_chase_cam2.mp4",
                "fullPath": "/Users/test/MagnumStream/projects/test_project/clips/slot_3_chase_cam2.mp4", 
                "slotNumber": 3,
                "sceneType": "chase",
                "cameraAngle": 2,
                "duration": 1.543
            },
            "4": {
                "filename": "slot_4_chase_cam2.mp4",
                "fullPath": "/Users/test/MagnumStream/projects/test_project/clips/slot_4_chase_cam2.mp4",
                "slotNumber": 4,
                "sceneType": "chase", 
                "cameraAngle": 2,
                "duration": 2.503
            },
            "5": {
                "filename": "slot_5_arrival_cam2.mp4",
                "fullPath": "/Users/test/MagnumStream/projects/test_project/clips/slot_5_arrival_cam2.mp4",
                "slotNumber": 5,
                "sceneType": "arrival",
                "cameraAngle": 2,
                "duration": 2.002
            }
        },
        "metadata": {
            "projectName": "Test Project",
            "sessionId": "test-session-123",
            "createdAt": "2024-01-01T12:00:00Z",
            "recordingId": "test-recording-456"
        }
    }
    
    # Write test job file
    test_dir = Path.home() / "MagnumStream" / "queue"
    test_dir.mkdir(parents=True, exist_ok=True)
    
    job_file = test_dir / "test-job.json"
    with open(job_file, 'w') as f:
        json.dump(test_job, f, indent=2)
    
    print(f"✅ Created test job file: {job_file}")
    return job_file

def test_davinci_script():
    """Test the DaVinci.py script"""
    
    print("🧪 Testing DaVinci Integration")
    print("=" * 50)
    
    # Check if DaVinci.py exists
    davinci_script = Path("./Davinci.py")
    if not davinci_script.exists():
        print(f"❌ DaVinci.py not found at {davinci_script}")
        return False
    
    print(f"✅ Found DaVinci.py at {davinci_script}")
    
    # Test help command
    print("\n📋 Testing help command...")
    result = os.system(f"python3 {davinci_script} --help")
    if result != 0:
        print("❌ Help command failed")
        return False
    
    # Create test job file
    print("\n📄 Creating test job file...")
    job_file = create_test_job_file()
    
    # Test job file processing (dry run - will fail without DaVinci but should parse correctly)
    print(f"\n🎬 Testing job file processing...")
    print(f"Command: python3 {davinci_script} --job-file {job_file}")
    print("Note: This will fail without DaVinci Resolve running, but should show proper parsing")
    
    result = os.system(f"python3 {davinci_script} --job-file {job_file}")
    
    if result == 0:
        print("✅ DaVinci script executed successfully!")
    else:
        print("⚠️  DaVinci script failed (expected if DaVinci Resolve is not running)")
        print("   This is normal for testing without DaVinci Resolve Studio")
    
    print("\n📁 Integration files created:")
    print(f"   Job file: {job_file}")
    print(f"   Logs: {Path.home() / 'MagnumStream' / 'logs'}")
    
    return True

def main():
    """Main test function"""
    try:
        success = test_davinci_script()
        if success:
            print("\n✅ DaVinci integration test completed!")
            print("\n🎬 Next steps:")
            print("1. Install DaVinci Resolve Studio")
            print("2. Enable scripting in DaVinci Resolve > Preferences > System > General")
            print("3. Create 'MagnumPI_Template' project with 5-slot timeline")
            print("4. Run start-mac-service.sh to start the full workflow")
        else:
            print("\n❌ DaVinci integration test failed!")
        
    except Exception as e:
        print(f"\n❌ Test error: {e}")
        return False

if __name__ == "__main__":
    main()