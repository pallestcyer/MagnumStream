#!/usr/bin/env python3
"""
DaVinci Resolve Python Script to cut V1 based on V3 clip positions
Run this in DaVinci Resolve Console (Py3 mode)
"""

# Get Resolve instance
try:
    resolve = bmd.scriptapp("Resolve")
except:
    # Alternative method if running from Resolve's console
    resolve = GetResolve()

if not resolve:
    print("Error: Could not connect to DaVinci Resolve")
    exit()

project_manager = resolve.GetProjectManager()
project = project_manager.GetCurrentProject()

if not project:
    print("Error: No project loaded")
    exit()

timeline = project.GetCurrentTimeline()
if not timeline:
    print("Error: No timeline active")
    exit()

# Get timeline properties
frame_rate = float(timeline.GetSetting("timelineFrameRate"))
print(f"Frame Rate: {frame_rate}")
print(f"Project: {project.GetName()}")
print(f"Timeline: {timeline.GetName()}")

# Get video track count
video_track_count = int(timeline.GetTrackCount("video"))
print(f"Video tracks: {video_track_count}")

# Verify we have both V1 and V3
if video_track_count < 3:
    print("Error: Need at least 3 video tracks (V1 and V3)")
    exit()

# Get V3 clips to determine cut points
v3_track_items = timeline.GetItemListInTrack("video", 3)
if not v3_track_items or len(v3_track_items) == 0:
    print("Error: No clips found in V3")
    exit()

print(f"\nFound {len(v3_track_items)} clips in V3")

# Collect all cut positions (start and end of each V3 clip)
cut_positions = []
for i, item in enumerate(v3_track_items, 1):
    start_frame = item.GetStart()
    duration_frames = item.GetDuration()
    end_frame = start_frame + duration_frames

    cut_positions.append(start_frame)
    cut_positions.append(end_frame)

    print(f"V3 Clip {i}: {start_frame} to {end_frame} (duration: {duration_frames})")

# Remove duplicates and sort
cut_positions = sorted(set(cut_positions))

print(f"\nCut positions needed: {len(cut_positions)}")
for i, pos in enumerate(cut_positions, 1):
    print(f"  Cut {i}: Frame {pos} ({pos/frame_rate:.3f}s)")

# Get V1 clips
v1_track_items = timeline.GetItemListInTrack("video", 1)
if not v1_track_items or len(v1_track_items) == 0:
    print("\nError: No clips found in V1")
    exit()

print(f"\nFound {len(v1_track_items)} clip(s) in V1")

# Attempt to perform cuts
print("\n" + "="*50)
print("ATTEMPTING TO CUT V1 CLIPS...")
print("="*50)

# Method 1: Try using timeline razor/blade operations
# Position playhead and attempt programmatic blade
cuts_made = 0
failed_cuts = []

for i, cut_frame in enumerate(cut_positions, 1):
    print(f"\nAttempting cut {i}/{len(cut_positions)} at frame {cut_frame}...")

    # Set playhead position
    timeline.SetCurrentTimecode(timeline.GetStartTimecode())  # Reset first

    # Calculate timecode for cut position
    # Convert frame to timecode
    total_seconds = cut_frame / frame_rate
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)
    frames = int((total_seconds - int(total_seconds)) * frame_rate)

    timecode = f"{hours:02d}:{minutes:02d}:{seconds:02d}:{frames:02d}"

    # Try to set current timecode
    try:
        success = timeline.SetCurrentTimecode(timecode)
        if success:
            print(f"  Playhead positioned at {timecode}")

            # Unfortunately, Python API doesn't expose blade/razor operations directly
            # We need to create markers as reference points
            marker_added = timeline.AddMarker(
                cut_frame,
                "Blue",
                f"CUT_{i}",
                f"Auto-cut from V3 (frame {cut_frame})",
                1,
                ""
            )

            if marker_added:
                print(f"  ✓ Marker created at frame {cut_frame}")
                cuts_made += 1
            else:
                print(f"  ✗ Failed to create marker")
                failed_cuts.append(cut_frame)
        else:
            print(f"  ✗ Failed to position playhead")
            failed_cuts.append(cut_frame)
    except Exception as e:
        print(f"  ✗ Error: {e}")
        failed_cuts.append(cut_frame)

# Summary
print("\n" + "="*50)
print("SUMMARY")
print("="*50)
print(f"Total cuts needed: {len(cut_positions)}")
print(f"Markers created: {cuts_made}")
print(f"Failed: {len(failed_cuts)}")

if failed_cuts:
    print(f"\nFailed at frames: {failed_cuts}")

print("\n" + "="*50)
print("IMPORTANT NOTES:")
print("="*50)
print("The DaVinci Resolve Python API does not expose direct blade/razor operations.")
print("This script has created BLUE MARKERS at each cut position.")
print("\nTo complete the cuts:")
print("1. Navigate to each blue marker on the timeline")
print("2. Press Cmd+B (Mac) or Ctrl+B (Windows) to blade at that position")
print("3. Or use the Blade tool (B) and click at marker positions")
print("\nAlternative automated approach:")
print("- Use DaVinci Resolve's scripting with external automation tools")
print("- Or use keyboard automation (PyAutoGUI/AppleScript) to send blade commands")
print("="*50)
