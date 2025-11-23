#!/usr/bin/env python3
"""Simple diagnostic script to check DaVinci template state"""

import sys

# Try to load DaVinci API
try:
    import DaVinciResolveScript as dvr
except ImportError:
    # Try standard paths
    fusion_paths = [
        "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/",
        "/Applications/DaVinci Resolve Studio/DaVinci Resolve.app/Contents/Libraries/Fusion/",
    ]
    for path in fusion_paths:
        if path not in sys.path:
            sys.path.insert(0, path)
    try:
        import DaVinciResolveScript as dvr
    except:
        print("ERROR: Cannot load DaVinci Resolve API")
        sys.exit(1)

# Connect to Resolve
resolve = dvr.scriptapp("Resolve")
if not resolve:
    print("ERROR: Cannot connect to DaVinci Resolve - is it running?")
    sys.exit(1)

pm = resolve.GetProjectManager()
project = pm.GetCurrentProject()

if not project:
    print("ERROR: No project open")
    sys.exit(1)

print(f"Project: {project.GetName()}")

# Get timeline
timeline_count = project.GetTimelineCount()
print(f"Timeline count: {timeline_count}")

for i in range(1, timeline_count + 1):
    timeline = project.GetTimelineByIndex(i)
    name = timeline.GetName()
    print(f"  Timeline {i}: '{name}'")

# Set current timeline
timeline = project.GetCurrentTimeline()
if not timeline:
    print("ERROR: No current timeline")
    sys.exit(1)

print(f"\nCurrent timeline: {timeline.GetName()}")

# Get video tracks
video_track_count = timeline.GetTrackCount("video")
print(f"Video tracks: {video_track_count}")

# Check each track
for track_idx in range(1, video_track_count + 1):
    items = timeline.GetItemListInTrack("video", track_idx)
    print(f"\nTrack V{track_idx}: {len(items)} clips")

    if items and track_idx == 3:  # V3 is where our clips should be
        print("  Clips on V3:")
        for item in items:
            start = item.GetStart()
            media = item.GetMediaPoolItem()
            name = media.GetName() if media else "NO MEDIA"
            print(f"    Frame {start}: '{name}'")
