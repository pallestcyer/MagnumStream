#!/usr/bin/env python3
"""Test DaVinci Resolve Render API"""

import DaVinciResolveScript as dvr
import os

def test_render_api():
    # Connect to Resolve
    resolve = dvr.scriptapp("Resolve")
    if not resolve:
        print("❌ DaVinci Resolve is not running")
        return
    
    print("✅ Connected to DaVinci Resolve")
    
    # Get Project Manager
    pm = resolve.GetProjectManager()
    project = pm.GetCurrentProject()
    
    if not project:
        print("❌ No project open")
        return
    
    print(f"✅ Project: {project.GetName()}")
    
    # Get current timeline
    timeline = project.GetCurrentTimeline()
    if not timeline:
        print("❌ No timeline selected")
        return
    
    print(f"✅ Timeline: {timeline.GetName()}")
    
    # Check available project methods
    print("\n📋 Checking Project Methods:")
    project_methods = dir(project)
    render_methods = [m for m in project_methods if 'render' in m.lower() or 'export' in m.lower()]
    
    print("Available render-related methods:")
    for method in render_methods:
        print(f"  - {method}")
    
    # Test render settings
    print("\n🔧 Testing Render Settings:")
    
    # Try different render setting methods
    try:
        # Method 1: LoadRenderPreset
        presets = project.GetRenderPresets()
        print(f"✅ Available render presets: {len(presets) if presets else 0}")
        if presets:
            print(f"   First preset: {presets[0] if presets else 'None'}")
    except Exception as e:
        print(f"❌ GetRenderPresets failed: {e}")
    
    # Try to set render settings
    try:
        output_path = os.path.expanduser("~/Desktop/DaVinci_Test_Render.mov")
        
        # Common render settings
        render_settings = {
            "SelectAllFrames": True,
            "TargetDir": os.path.dirname(output_path),
            "CustomName": "Test_Render",
            "FormatWidth": 1920,
            "FormatHeight": 1080,
            "FrameRate": "30",  # Try as string
        }
        
        print(f"\n🎯 Attempting to set render settings:")
        success = project.SetRenderSettings(render_settings)
        print(f"   SetRenderSettings: {'✅ Success' if success else '❌ Failed'}")
        
        # Get current render settings to verify
        current_settings = project.GetRenderSettings()
        if current_settings:
            print(f"✅ Current render settings retrieved")
            print(f"   Output Dir: {current_settings.get('TargetDir', 'Not set')}")
        else:
            print("❌ Could not get render settings")
            
    except Exception as e:
        print(f"❌ SetRenderSettings failed: {e}")
    
    # Test adding render job
    print("\n📦 Testing Render Job:")
    try:
        # Try to add render job
        job_id = project.AddRenderJob()
        if job_id:
            print(f"✅ Render job added: {job_id}")
            
            # Get render jobs
            jobs = project.GetRenderJobList()
            print(f"   Total jobs in queue: {len(jobs) if jobs else 0}")
            
            # Try to delete the test job
            if jobs:
                project.DeleteRenderJob(job_id)
                print(f"   Test job deleted")
        else:
            print("❌ Failed to add render job")
            print("   This might mean:")
            print("   - No timeline selected")
            print("   - Invalid render settings")
            print("   - Need to set render preset first")
            
    except Exception as e:
        print(f"❌ AddRenderJob failed: {e}")
    
    # Check if render queue exists
    try:
        jobs = project.GetRenderJobList()
        print(f"\n📊 Render Queue Status:")
        print(f"   Jobs in queue: {len(jobs) if jobs else 0}")
        if jobs:
            for idx, job in enumerate(jobs):
                print(f"   Job {idx}: {job}")
    except Exception as e:
        print(f"❌ GetRenderJobList failed: {e}")

if __name__ == "__main__":
    test_render_api()