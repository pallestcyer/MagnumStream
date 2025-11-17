#!/usr/bin/env python3
"""
DaVinci Resolve Automation Script for MagnumStream Helicopter Tour Video Production
Automatically replaces clips in template, saves project, and renders final video
Integrated with Mac local device service and existing FFMPEG clip generation workflow
"""

import sys
import os
import json
import time
import shutil
from datetime import datetime
from pathlib import Path
import logging
import argparse

# DaVinci Resolve Script API
def load_davinci_api():
    """Load DaVinci Resolve Python API with proper path detection"""
    try:
        import DaVinciResolveScript as dvr
        print("✅ DaVinci Resolve API loaded successfully")
        return dvr
    except ImportError:
        print("DaVinci Resolve Script API not found, checking environment...")
        
        # Check if environment variables are set (from Mac service)
        script_api_path = os.environ.get('RESOLVE_SCRIPT_API')
        if script_api_path:
            modules_path = os.path.join(script_api_path, 'Modules')
            if modules_path not in sys.path:
                sys.path.insert(0, modules_path)
                print(f"Added environment path: {modules_path}")
        
        # Try standard DaVinci paths
        fusion_paths = [
            "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/",
            "/Applications/DaVinci Resolve Studio/DaVinci Resolve.app/Contents/Libraries/Fusion/",
        ]
        
        for fusion_path in fusion_paths:
            fusionscript_path = os.path.join(fusion_path, "fusionscript.so")
            if os.path.exists(fusionscript_path):
                print(f"Found fusionscript.so at: {fusionscript_path}")
                
                # Add the Fusion path to Python path
                if fusion_path not in sys.path:
                    sys.path.insert(0, fusion_path)
                
                # Try to import the DaVinci API
                try:
                    import DaVinciResolveScript as dvr
                    print(f"✅ Successfully loaded DaVinci API from: {fusion_path}")
                    return dvr
                except ImportError as e:
                    print(f"Found fusionscript.so but import failed: {e}")
                    continue
        
        print("ERROR: DaVinci Resolve Script API not found.")
        print("Please ensure:")
        print("1. DaVinci Resolve Studio is installed (not the free version)")
        print("2. DaVinci Resolve is currently running")
        print("3. Scripting is enabled in DaVinci Resolve > Preferences > System > General")
        print("4. External scripting is set to 'Network' mode")
        print("5. Environment variables are set: RESOLVE_SCRIPT_API, PYTHONPATH")
        sys.exit(1)

# Load the DaVinci API
dvr = load_davinci_api()

# ============================================================================
# CONFIGURATION
# ============================================================================

# Template Configuration
TEMPLATE_PROJECT_NAME = "MAG_FERRARI-NEW"  # Your template project name in Resolve

# Mac-compatible paths (works with existing ClipGenerator structure)
BASE_DIR = Path.home() / "MagnumStream"  # User's home directory
PROJECTS_FOLDER = BASE_DIR / "projects"  # Root projects folder (matches ClipGenerator)
WATCH_FOLDER = BASE_DIR / "queue"  # Folder where jobs are dropped
OUTPUT_FOLDER = BASE_DIR / "rendered"  # Final rendered videos  
COMPLETED_FOLDER = BASE_DIR / "completed"  # Processed job files

# Render Settings
RENDER_PRESET = "YouTube 1080p"  # Name of your render preset in Resolve
RENDER_FORMAT = "mp4"  # Output format
RENDER_CODEC = "H.264"  # Video codec

# Timeline Configuration - Updated for 14-slot MagnumStream template matching MAG_FERRARI
TIMELINE_NAME = "MAG_FERARRI"  # Name of timeline in your template
CLIP_TRACKS = {
    1: "V1",  # Track 1 for all clips (single track template)
}

# Clip Mapping - Maps slot numbers to timeline positions (matches actual timeline structure)
# Based on actual DaVinci template analysis (debug.log output from get_timeline_clips_debug.lua)
# All clips are on video track V3 (track index 3)
# These are the EXACT frame positions from the template timeline
# 14 slots total: 7 cruising (slots 1-7), 6 chase (slots 8-13), 1 arrival (slot 14)
CLIP_POSITIONS = {
    # Cruising Scene (7 slots)
    1: {"track": 3, "start_frame": 86485},    # Cruising front view, 22 frames (0.918s)
    2: {"track": 3, "start_frame": 86549},    # Cruising front view, 29 frames (1.210s) → seamless to 3
    3: {"track": 3, "start_frame": 86578},    # Cruising side view, 31 frames (1.293s)
    4: {"track": 3, "start_frame": 86631},    # Cruising front view, 23 frames (0.959s) → seamless to 5
    5: {"track": 3, "start_frame": 86654},    # Cruising side view, 37 frames (1.543s)
    6: {"track": 3, "start_frame": 86790},    # Cruising front view, 16 frames (0.667s)
    7: {"track": 3, "start_frame": 86844},    # Cruising side view, 19 frames (0.792s)

    # Chase Scene (6 slots)
    8: {"track": 3, "start_frame": 86905},    # Chase front view, 22 frames (0.918s) → seamless to 9
    9: {"track": 3, "start_frame": 86927},    # Chase side view, 33 frames (1.376s)
    10: {"track": 3, "start_frame": 87035},   # Chase front view, 14 frames (0.584s)
    11: {"track": 3, "start_frame": 87106},   # Chase front view, 36 frames (1.502s) → seamless to 12
    12: {"track": 3, "start_frame": 87142},   # Chase side view, 34 frames (1.418s)
    13: {"track": 3, "start_frame": 87216},   # Chase side view, 13 frames (0.542s)

    # Arrival Scene (1 slot)
    14: {"track": 3, "start_frame": 87353},   # Arrival side view, 77 frames (3.212s)
}

# Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('davinci_automation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# MAIN AUTOMATION CLASS
# ============================================================================

class DaVinciAutomation:
    def __init__(self):
        """Initialize DaVinci Resolve connection"""
        self.resolve = None
        self.project_manager = None
        self.current_project = None
        self.media_pool = None
        self.timeline = None
        
        self._connect_to_resolve()
    
    def _connect_to_resolve(self):
        """Establish connection to DaVinci Resolve"""
        try:
            # Try to connect to existing DaVinci instance
            self.resolve = dvr.scriptapp("Resolve")
            if not self.resolve:
                logger.info("DaVinci Resolve not detected, attempting to start it...")
                # Try to launch DaVinci Resolve quietly
                import subprocess
                import time
                
                # Launch DaVinci Resolve in background (it will still show but minimized)
                davinci_paths = [
                    "/Applications/DaVinci Resolve/DaVinci Resolve.app",
                    "/Applications/DaVinci Resolve Studio/DaVinci Resolve.app"
                ]
                
                for app_path in davinci_paths:
                    if Path(app_path).exists():
                        logger.info(f"Starting DaVinci Resolve from: {app_path}")
                        # Use 'open -g' to launch in background without stealing focus
                        subprocess.Popen(['open', '-g', app_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        break
                
                # Wait for DaVinci to start and retry connection
                for attempt in range(30):  # Wait up to 30 seconds
                    time.sleep(1)
                    self.resolve = dvr.scriptapp("Resolve")
                    if self.resolve:
                        break
                    logger.info(f"Waiting for DaVinci Resolve to start... ({attempt + 1}/30)")
                
                if not self.resolve:
                    raise Exception("Could not connect to DaVinci Resolve after startup attempt")
            
            self.project_manager = self.resolve.GetProjectManager()
            if not self.project_manager:
                raise Exception("Could not get Project Manager")
            
            # Try to minimize DaVinci Resolve window to keep focus on dashboard
            try:
                import subprocess
                subprocess.run(['osascript', '-e', 'tell application "DaVinci Resolve" to set miniaturized of every window to true'], 
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
                logger.info("Minimized DaVinci Resolve windows")
            except:
                logger.info("Could not minimize DaVinci Resolve (this is normal)")
            
            logger.info("Successfully connected to DaVinci Resolve")
        except Exception as e:
            logger.error(f"Failed to connect to DaVinci Resolve: {e}")
            logger.error("Please ensure DaVinci Resolve Studio is installed and scripting is enabled")
            sys.exit(1)
    
    def process_job(self, job_data):
        """Main processing function for a single job (updated for MagnumStream workflow)"""
        try:
            project_name = job_data.get('projectName', job_data.get('project_name'))
            clips = job_data['clips']
            recording_id = job_data.get('recordingId', job_data.get('jobId'))
            
            logger.info(f"Starting DaVinci processing for project: {project_name}")
            logger.info(f"Recording ID: {recording_id}")
            logger.info(f"Processing {len(clips)} clips")
            
            # Debug: Show which slots are in the job file
            slot_numbers = list(clips.keys())
            logger.info(f"📋 Clips in job file: slots {slot_numbers}")
            for slot_num, clip_info in clips.items():
                logger.info(f"   Slot {slot_num}: {clip_info.get('filename', 'No filename')} ({clip_info.get('duration', 'No duration')}s)")
            
            # Load template project
            if not self._load_template_project():
                return False

            # PRE-FLIGHT CHECK: Verify all 14 expected slots exist in template
            if not self._verify_template_integrity():
                logger.error("❌ CRITICAL: Template integrity check failed - aborting render")
                logger.error("   The template is missing expected clips. Please restore from backup.")
                return False

            # Import and replace clips using existing project structure
            if not self._replace_clips_from_project(clips, recording_id):
                return False
            
            # Save as new project
            if not self._save_project(project_name):
                return False
            
            # Render the project with customer-based naming
            output_path = self._render_project(job_data)
            if not output_path:
                return False
            
            logger.info(f"Successfully completed DaVinci render: {output_path}")

            # Note: Google Drive sync is handled by the Node.js server after receiving the output path
            # This allows the server to update the database with the Drive path atomically

            return output_path

        except Exception as e:
            logger.error(f"Error processing DaVinci job: {e}")
            return False
    
    def _load_template_project(self):
        """Load the template project"""
        try:
            # First, close any currently open project
            current = self.project_manager.GetCurrentProject()
            if current:
                self.project_manager.CloseProject(current)

            # Load template
            self.current_project = self.project_manager.LoadProject(TEMPLATE_PROJECT_NAME)
            if not self.current_project:
                raise Exception(f"Could not load template project: {TEMPLATE_PROJECT_NAME}")

            self.media_pool = self.current_project.GetMediaPool()

            # Apply project settings to match working configuration
            self._configure_project_settings()

            # Get the timeline - with debugging
            timeline_count = self.current_project.GetTimelineCount()
            logger.info(f"Found {timeline_count} timelines in project")

            # List all available timelines for debugging
            available_timelines = []
            for i in range(1, timeline_count + 1):
                timeline = self.current_project.GetTimelineByIndex(i)
                timeline_name = timeline.GetName()
                available_timelines.append(timeline_name)
                logger.info(f"Timeline {i}: '{timeline_name}'")

                # Try to match the expected timeline name
                if timeline_name == TIMELINE_NAME:
                    self.timeline = timeline
                    self.current_project.SetCurrentTimeline(timeline)
                    logger.info(f"Using timeline: {timeline_name}")
                    break

            # If no exact match, use the first timeline as fallback
            if not self.timeline and timeline_count > 0:
                logger.warning(f"Timeline '{TIMELINE_NAME}' not found. Available timelines: {available_timelines}")
                logger.info("Using first timeline as fallback...")
                self.timeline = self.current_project.GetTimelineByIndex(1)
                self.current_project.SetCurrentTimeline(self.timeline)
                actual_name = self.timeline.GetName()
                logger.info(f"Using timeline: '{actual_name}'")

            if not self.timeline:
                raise Exception(f"No timelines found in project. Available: {available_timelines}")

            logger.info("Template project loaded successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to load template project: {e}")
            return False

    def _verify_template_integrity(self):
        """Verify all 14 expected clip positions exist in the template before starting"""
        try:
            logger.info("🔍 Verifying template integrity (checking for all 14 expected slots)...")

            track_index = 3  # All clips should be on track V3
            timeline_items = self.timeline.GetItemListInTrack('video', track_index)

            if not timeline_items:
                logger.error(f"❌ No items found on track V{track_index}")
                return False

            logger.info(f"   Found {len(timeline_items)} items on track V{track_index}")

            # Get all start frames from timeline
            actual_frames = set()
            for item in timeline_items:
                start = item.GetStart()
                if start is not None:
                    actual_frames.add(start)

            # Check each expected position
            expected_frames = {pos['start_frame'] for pos in CLIP_POSITIONS.values()}
            missing_frames = expected_frames - actual_frames
            extra_frames = actual_frames - expected_frames

            if missing_frames:
                logger.error(f"❌ Template is missing clips at these frame positions:")
                for slot_num, pos in CLIP_POSITIONS.items():
                    if pos['start_frame'] in missing_frames:
                        logger.error(f"   Slot {slot_num}: frame {pos['start_frame']} NOT FOUND")
                return False

            if extra_frames:
                logger.warning(f"⚠️ Template has unexpected clips at frames: {sorted(extra_frames)}")
                logger.warning("   This may be okay, but template might have been modified")

            logger.info(f"✅ Template integrity verified: All 14 expected slots found")
            logger.info(f"   Expected frames: {sorted(expected_frames)}")
            logger.info(f"   Actual frames: {sorted(actual_frames)}")

            return True

        except Exception as e:
            logger.error(f"Failed to verify template integrity: {e}")
            return False

    def _configure_project_settings(self):
        """Configure project settings to match working configuration"""
        try:
            logger.info("Configuring project settings...")

            # Critical settings from working project configuration
            project_settings = {
                # Timeline settings - must match template
                "timelineFrameRate": "23.976",
                "timelinePlaybackFrameRate": "23.976",
                "timelineResolutionWidth": "1920",
                "timelineResolutionHeight": "1080",
                "timelineOutputResolutionWidth": "1920",
                "timelineOutputResolutionHeight": "1080",

                # Color science settings
                "colorScienceMode": "davinciYRGB",
                "colorSpaceInput": "Rec.709 Gamma 2.4",
                "colorSpaceOutput": "Rec.709 (Scene)",
                "colorSpaceTimeline": "Rec.709 (Scene)",

                # Render cache settings
                "perfRenderCacheCodec": "apch",  # Apple ProRes 422 HQ
                "perfOptimisedCodec": "apch",
                "perfRenderCacheMode": "none",

                # Frame rate mismatch behavior
                "timelineFrameRateMismatchBehavior": "resolve",
                "timelineInputResMismatchBehavior": "scaleToFit",
                "timelineOutputResMismatchBehavior": "scaleToFit",

                # Super Scale settings
                "superScale": "1",
                "superScaleNoiseReduction": "Medium",
                "superScaleSharpness": "Medium",

                # Video data levels
                "videoDataLevels": "Video",
            }

            # Apply settings one by one with error handling
            settings_applied = 0
            settings_failed = 0

            for key, value in project_settings.items():
                try:
                    if hasattr(self.current_project, 'SetSetting'):
                        result = self.current_project.SetSetting(key, value)
                        if result:
                            settings_applied += 1
                            logger.debug(f"✅ Set {key} = {value}")
                        else:
                            settings_failed += 1
                            logger.debug(f"⚠️ Could not set {key} = {value}")
                except Exception as e:
                    settings_failed += 1
                    logger.debug(f"❌ Error setting {key}: {e}")

            logger.info(f"Project settings: {settings_applied} applied, {settings_failed} failed/skipped")
            logger.info("Note: Some settings may be template-locked or require different API calls")

        except Exception as e:
            logger.warning(f"Could not configure all project settings: {e}")
            logger.info("Continuing with template default settings")

    def _cleanup_old_clip_bins(self):
        """Remove old Clips_* bins from previous renders to prevent media pool pollution"""
        try:
            logger.info("🧹 Cleaning up old clip bins from previous renders...")
            root_folder = self.media_pool.GetRootFolder()

            if not root_folder:
                logger.warning("Could not access root folder for cleanup")
                return

            # Get all subfolders
            subfolders = root_folder.GetSubFolderList()
            if not subfolders:
                logger.info("   No subfolders found, nothing to clean")
                return

            bins_removed = 0
            for folder in subfolders:
                folder_name = folder.GetName()
                # Match folders created by previous renders (Clips_* pattern)
                if folder_name.startswith("Clips_"):
                    logger.info(f"   Removing old bin: {folder_name}")
                    # Delete all clips in the bin first
                    self.media_pool.SetCurrentFolder(folder)
                    clips_in_folder = folder.GetClipList()
                    if clips_in_folder:
                        self.media_pool.DeleteClips(clips_in_folder)
                    # Now delete the empty folder
                    self.media_pool.DeleteFolders([folder])
                    bins_removed += 1

            logger.info(f"🧹 Cleanup complete: removed {bins_removed} old bin(s)")
            # Reset to root folder
            self.media_pool.SetCurrentFolder(root_folder)

        except Exception as e:
            logger.warning(f"Could not clean up old bins: {e}")
            logger.info("Continuing without cleanup")

    def _replace_clips_from_project(self, clips, recording_id):
        """Replace placeholder clips with new recordings from ClipGenerator output"""
        try:
            # CRITICAL: Clean up old imported clips from previous renders
            # This prevents media pool pollution and potential AddTake failures
            self._cleanup_old_clip_bins()

            # Create a new bin for this project's clips
            root_folder = self.media_pool.GetRootFolder()
            clip_bin = self.media_pool.AddSubFolder(root_folder, f"Clips_{recording_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            self.media_pool.SetCurrentFolder(clip_bin)

            # Import all clips to media pool (using absolute paths from ClipGenerator)
            media_items = {}
            for slot_num, clip_info in clips.items():
                slot_number = int(slot_num)
                clip_path = Path(clip_info['fullPath'])

                if not clip_path.exists():
                    logger.warning(f"Clip file not found: {clip_path}")
                    logger.warning(f"Expected path: {clip_info.get('fullPath', 'No path provided')}")
                    continue

                # Verify clip exists and get metadata before importing
                expected_duration = clip_info.get('duration', 3.0)
                expected_frames = self._seconds_to_frames(expected_duration)

                # Import clip to media pool
                imported = self.media_pool.ImportMedia([str(clip_path)])
                if imported:
                    media_item = imported[0]

                    # Verify clip frame rate matches template (23.976 fps)
                    try:
                        clip_fps = media_item.GetClipProperty('FPS')
                        if clip_fps and abs(float(clip_fps) - 23.976) > 0.01:
                            logger.warning(f"⚠️ Slot {slot_number} FPS mismatch: {clip_fps} (expected 23.976)")
                    except Exception as e:
                        logger.debug(f"Could not verify FPS for slot {slot_number}: {e}")

                    # Calculate frame-based in/out points for precise timing
                    media_items[slot_number] = {
                        'media': media_item,
                        'in_point': 0,  # Start from beginning of generated clip
                        'out_point': expected_frames,  # Use exact duration from SLOT_TEMPLATE
                        'slot_info': clip_info
                    }
                    logger.info(f"✅ Imported slot {slot_number}: {clip_info['filename']} ({expected_duration}s = {expected_frames} frames)")
            
            # Replace clips on timeline - TWO-PHASE APPROACH to avoid timeline corruption
            # Phase 1: Try ReplaceClip method (non-destructive, safest)
            # Phase 2: If ReplaceClip not available, collect all clips then batch delete/add

            logger.info(f"🔄 Starting clip replacement for {len(media_items)} imported clips")

            # Get all timeline items ONCE at start
            track_index = 3  # All clips are on track V3
            timeline_items = self.timeline.GetItemListInTrack('video', track_index)
            logger.info(f"🔍 Found {len(timeline_items)} items on video track {track_index}")

            # Log all timeline item positions for debugging
            logger.info(f"📍 Timeline items on track V{track_index}:")
            for i, item in enumerate(timeline_items):
                item_start = item.GetStart()
                item_end = item.GetEnd()
                logger.info(f"   Item {i+1}: frames {item_start}-{item_end}")

            # Create mapping of frame position -> timeline item
            position_to_item = {}
            for item in timeline_items:
                item_start = item.GetStart()
                position_to_item[item_start] = item

            # Phase 1: Try non-destructive ReplaceClip method
            replaced_slots = []
            slots_needing_delete_add = []

            for slot_number, clip_data in media_items.items():
                logger.info(f"🎬 Processing slot {slot_number}: {clip_data['slot_info']['filename']}")

                if slot_number not in CLIP_POSITIONS:
                    logger.warning(f"❌ No position defined for slot {slot_number} in CLIP_POSITIONS")
                    continue

                position = CLIP_POSITIONS[slot_number]
                start_frame = position['start_frame']
                track_index = position['track']

                logger.info(f"🎯 Looking for slot {slot_number} at frame {start_frame} on track V{track_index}")

                # CRITICAL: Re-fetch timeline items for EACH slot to avoid stale references
                # After delete/add operations, the old list contains invalid item references
                current_timeline_items = self.timeline.GetItemListInTrack('video', track_index)
                logger.debug(f"📋 Refreshed timeline items, found {len(current_timeline_items)} items")

                # Find the item at this exact frame position
                target_item = None
                for item in current_timeline_items:
                    item_start = item.GetStart()
                    item_end = item.GetEnd()

                    # Skip items that return None (deleted or invalid references)
                    if item_start is None or item_end is None:
                        logger.debug(f"⚠️ Skipping invalid item reference")
                        continue

                    # Match if item starts at target frame OR contains target frame
                    if item_start == start_frame or (item_start <= start_frame < item_end):
                        target_item = item
                        logger.info(f"✅ Found item at frames {item_start}-{item_end} for slot {slot_number}")
                        break

                if not target_item:
                    logger.warning(f"❌ No timeline item found at frame {start_frame} for slot {slot_number}")
                    continue

                media_item = clip_data['media']
                replaced = False

                # Try different replacement methods in order of preference
                # Method 1: ReplaceClip (non-destructive, preserves timeline structure)
                if hasattr(target_item, 'ReplaceClip') and callable(getattr(target_item, 'ReplaceClip', None)):
                    try:
                        logger.info(f"   Trying Method 1: ReplaceClip")
                        result = target_item.ReplaceClip(media_item)
                        if result:
                            logger.info(f"✅ Method 1: ReplaceClip succeeded for slot {slot_number}")
                            replaced_slots.append(slot_number)
                            replaced = True
                        else:
                            logger.warning(f"⚠️ Method 1: ReplaceClip returned False for slot {slot_number}")
                    except Exception as e:
                        logger.warning(f"Method 1 failed: {e}")
                else:
                    logger.info(f"   Method 1: ReplaceClip not available")

                # Method 2: Use take system (if method exists)
                if not replaced and hasattr(target_item, 'AddTake') and callable(getattr(target_item, 'AddTake', None)):
                    try:
                        # Log current take count before adding
                        current_takes = target_item.GetTakesCount() if hasattr(target_item, 'GetTakesCount') else 0
                        logger.info(f"   Current takes count before AddTake: {current_takes}")

                        # Try to finalize existing takes first (if any)
                        if current_takes > 0 and hasattr(target_item, 'FinalizeTake') and callable(getattr(target_item, 'FinalizeTake', None)):
                            logger.info(f"   Finalizing existing takes before adding new one")
                            target_item.FinalizeTake()

                        if target_item.AddTake(media_item):
                            take_count = target_item.GetTakesCount()
                            logger.info(f"   Takes count after AddTake: {take_count}")
                            if hasattr(target_item, 'SelectTakeByIndex') and callable(getattr(target_item, 'SelectTakeByIndex', None)):
                                if target_item.SelectTakeByIndex(take_count):
                                    logger.info(f"✅ Method 2: AddTake succeeded for slot {slot_number}")
                                    replaced_slots.append(slot_number)
                                    replaced = True

                                    # Try to finalize the new take immediately
                                    if hasattr(target_item, 'FinalizeTake') and callable(getattr(target_item, 'FinalizeTake', None)):
                                        logger.info(f"   Finalizing new take to make it permanent")
                                        target_item.FinalizeTake()
                                else:
                                    logger.warning(f"⚠️ Method 2: AddTake added but SelectTakeByIndex failed for slot {slot_number}")
                            else:
                                logger.warning(f"⚠️ Method 2: AddTake succeeded but SelectTakeByIndex not available")
                        else:
                            logger.warning(f"⚠️ Method 2: AddTake returned False for slot {slot_number}")
                    except Exception as e:
                        logger.warning(f"Method 2 failed: {e}")

                # Method 3: Swap media source - replace the underlying media file reference
                if not replaced:
                    try:
                        logger.info(f"   Trying Method 3: Swap media source path")
                        # Get the current media pool item from the timeline clip
                        current_media = target_item.GetMediaPoolItem()
                        if current_media:
                            # Get the new clip's file path
                            new_clip_path = str(Path(clip_data['slot_info']['fullPath']))
                            logger.info(f"   Swapping source to: {new_clip_path}")

                            # Try to replace the media source
                            if hasattr(current_media, 'ReplaceClip') and callable(getattr(current_media, 'ReplaceClip', None)):
                                result = current_media.ReplaceClip(new_clip_path)
                                if result:
                                    logger.info(f"✅ Method 3: Media source swap succeeded for slot {slot_number}")
                                    replaced_slots.append(slot_number)
                                    replaced = True
                                else:
                                    logger.warning(f"⚠️ Method 3: ReplaceClip on media pool item returned False")

                            # Alternative: Try LinkProxyMedia or SetClipProperty
                            if not replaced and hasattr(current_media, 'SetClipProperty'):
                                try:
                                    # Try setting the file path property directly
                                    result = current_media.SetClipProperty('File Path', new_clip_path)
                                    if result:
                                        logger.info(f"✅ Method 3b: SetClipProperty succeeded for slot {slot_number}")
                                        replaced_slots.append(slot_number)
                                        replaced = True
                                except Exception as e:
                                    logger.warning(f"   SetClipProperty failed: {e}")
                        else:
                            logger.warning(f"   Could not get MediaPoolItem from timeline item")
                    except Exception as e:
                        logger.warning(f"Method 3 failed: {e}")

                # Method 4: Last resort - log failure but don't corrupt template
                if not replaced:
                    logger.error(f"❌ CRITICAL: All replacement methods failed for slot {slot_number}")
                    logger.error(f"   Method 1 (ReplaceClip on timeline item): Failed or not available")
                    logger.error(f"   Method 2 (AddTake): Failed or not available")
                    logger.error(f"   Method 3 (Swap media source): Failed or not available")
                    logger.error(f"   This clip will NOT be replaced. Aborting to protect template.")

                # Final check
                if not replaced:
                    logger.error(f"❌ ALL methods failed for slot {slot_number}")
                    logger.error(f"   This slot will show 'media not found' during render")

            # Phase 2: DISABLED - Batch delete/add was causing all clips to be removed
            # Keeping this code commented for reference but NOT executing
            if False and slots_needing_delete_add:
                logger.info(f"🔄 Phase 2: Batch delete/add for {len(slots_needing_delete_add)} slots")

                # Collect all items to delete
                items_to_delete = [slot_info['item'] for slot_info in slots_needing_delete_add]

                # Delete ALL at once (prevents timeline corruption from incremental deletes)
                if hasattr(self.timeline, 'DeleteClips') and callable(getattr(self.timeline, 'DeleteClips', None)):
                    logger.info(f"🗑️ Deleting {len(items_to_delete)} clips in one batch...")
                    delete_result = self.timeline.DeleteClips(items_to_delete)
                    if delete_result:
                        logger.info(f"✅ Batch delete successful")
                    else:
                        logger.warning(f"⚠️ Batch delete returned False, but continuing...")

                    # Now add clips ONE AT A TIME to ensure proper placement
                    # Batch add was causing issues - clips not placed at correct positions
                    logger.info(f"➕ Adding {len(slots_needing_delete_add)} clips individually to specific frames...")

                    for slot_info in slots_needing_delete_add:
                        slot_number = slot_info['slot_number']
                        start_frame = slot_info['start_frame']
                        media_item = slot_info['media_item']
                        out_point = int(slot_info['clip_data']['out_point'])

                        logger.info(f"📍 Adding slot {slot_number} at frame {start_frame} (duration: {out_point} frames)")

                        clip_info = {
                            "mediaPoolItem": media_item,
                            "startFrame": 0,
                            "endFrame": out_point,
                            "trackIndex": track_index,
                            "recordFrame": start_frame
                        }

                        # Add this single clip
                        if hasattr(self.media_pool, 'AppendToTimeline') and callable(getattr(self.media_pool, 'AppendToTimeline', None)):
                            add_result = self.media_pool.AppendToTimeline([clip_info])
                            if add_result:
                                # Verify this specific clip was placed correctly
                                final_timeline_items = self.timeline.GetItemListInTrack('video', track_index)
                                found = False
                                for item in final_timeline_items:
                                    if item.GetStart() == start_frame:
                                        logger.info(f"✅ Slot {slot_number} verified at frame {start_frame}")
                                        found = True
                                        break
                                if not found:
                                    logger.warning(f"⚠️ Slot {slot_number} added but not found at frame {start_frame}")
                            else:
                                logger.error(f"❌ Failed to add slot {slot_number} - AppendToTimeline returned False")
                        else:
                            logger.error(f"❌ AppendToTimeline method not available")
                else:
                    logger.error(f"❌ DeleteClips method not available")

            # POST-REPLACEMENT VALIDATION: Ensure ALL clips were successfully replaced
            logger.info(f"🎉 Clip replacement complete: {len(replaced_slots)}/{len(media_items)} slots replaced")

            if len(replaced_slots) < len(media_items):
                missing_slots = set(media_items.keys()) - set(replaced_slots)
                logger.error(f"❌ CRITICAL: Failed to replace {len(missing_slots)} slot(s): {sorted(missing_slots)}")
                logger.error(f"   Successfully replaced: {sorted(replaced_slots)}")
                logger.error(f"   Missing: {sorted(missing_slots)}")
                logger.error(f"   ABORTING: Will not save or render incomplete timeline")
                return False

            logger.info(f"✅ SUCCESS: All {len(replaced_slots)} slots were successfully replaced")
            return True
            
        except Exception as e:
            logger.error(f"Failed to replace clips from project: {e}")
            return False
    
    def _seconds_to_frames(self, seconds, fps=23.976):
        """Convert seconds to frames at project frame rate"""
        return int(seconds * fps)
    
    def _extract_customer_names(self, job_data):
        """Extract customer names from job metadata and format them properly"""
        try:
            metadata = job_data.get('metadata', {})
            project_name = metadata.get('projectName', '')
            
            # The projectName in metadata should contain the customer names
            # Format: "Joe & Sam" or "Emily" from the InfoPage input
            if project_name:
                # Remove common suffixes and clean up
                clean_name = project_name.replace('_Flight', '').replace(' Flight', '')
                clean_name = clean_name.replace('___', ' & ').replace('_', ' ')
                
                # Convert back to proper format for filename
                # "Joe & Sam" -> "Joe&Sam"
                # "Emily" -> "Emily"
                if ' & ' in clean_name:
                    parts = [part.strip() for part in clean_name.split(' & ')]
                    return '&'.join(parts)
                else:
                    return clean_name.strip()
            
            # Fallback: try to extract from sessionId
            session_id = metadata.get('sessionId', '')
            if session_id:
                # sessionId format might be "joe_&_sam" or similar
                clean_session = session_id.replace('_&_', '&').replace('_', ' ')
                if '&' in clean_session:
                    parts = [part.strip().title() for part in clean_session.split('&')]
                    return '&'.join(parts)
                else:
                    return clean_session.title()
            
            # Final fallback
            return "Customer"
            
        except Exception as e:
            logger.warning(f"Could not extract customer names: {e}")
            return "Customer"
    
    def _save_project(self, project_name):
        """Save the current project state without renaming"""
        try:
            # Just save the current project state - don't rename to avoid messing up the template
            self.project_manager.SaveProject()
            
            logger.info(f"Project saved successfully: {TEMPLATE_PROJECT_NAME}")
            logger.info(f"Clips have been updated in place")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save project: {e}")
            return False
    
    # Note: _sync_to_google_drive method removed
    # Google Drive sync is now handled by the Node.js server (routes.ts)
    # after receiving the render completion response. This ensures:
    # 1. Database is updated atomically with Drive path
    # 2. No double-syncing
    # 3. Better error handling and logging in one place

    def _render_project(self, job_data):
        """Set up and start rendering with customer-based naming, returns output file path on success"""
        try:
            # Ensure output directory exists with organized structure
            from datetime import datetime
            render_date = datetime.now()
            
            # Create organized folder structure: Year/Month/Day/CustomerName
            year_folder = OUTPUT_FOLDER / str(render_date.year)
            month_folder = year_folder / f"{render_date.month:02d}-{render_date.strftime('%B')}"
            day_folder = month_folder / f"{render_date.day:02d}"

            # Extract customer names from job data
            customer_names = self._extract_customer_names(job_data)

            # Add customer name subfolder within the day folder
            customer_folder = day_folder / customer_names

            # Create all directories including customer subfolder
            customer_folder.mkdir(parents=True, exist_ok=True)

            timestamp = render_date.strftime("%Y%m%d_%H%M%S")

            # Create filename: "Joe&Sam_20251025_143941" or "Emily_20251025_143941"
            render_filename = f"{customer_names}_{timestamp}"

            logger.info(f"📁 Organized output structure: {customer_folder}")
            logger.info(f"🎬 Customer-based filename: {render_filename}")

            # Update output folder to use organized structure with customer subfolder
            organized_output_folder = customer_folder
            
            # Set render settings with organized output folder and customer-based naming
            render_settings = {
                "SelectAllFrames": True,
                "TargetDir": str(organized_output_folder),
                "CustomName": render_filename,
                "UniqueFilenameStyle": 0,  # Don't add numbers
                "ExportVideo": True,
                "ExportAudio": True,
                "FormatWidth": 1920,   # Safe default for template
                "FormatHeight": 1080,  # Safe default for template  
                "FrameRate": "23.976", # Match template frame rate
                "VideoQuality": 0,     # Automatic quality
            }
                    
            logger.info(f"Setting render settings: {render_settings}")
            
            # SetRenderSettings is working, so use it directly
            try:
                success = self.current_project.SetRenderSettings(render_settings)
                if success:
                    logger.info("✅ Render settings applied successfully")
                else:
                    logger.warning("⚠️ SetRenderSettings returned False but continuing")
            except Exception as e:
                logger.error(f"❌ SetRenderSettings failed: {e}")
                raise Exception(f"Could not set render settings: {e}")
            
            # Load render preset if available
            try:
                self.current_project.LoadRenderPreset(RENDER_PRESET)
                logger.info(f"Loaded render preset: {RENDER_PRESET}")
            except:
                logger.warning(f"Could not load render preset {RENDER_PRESET}, using default settings")
            
            # Clear any existing render jobs from the queue before starting
            try:
                if hasattr(self.current_project, 'DeleteAllRenderJobs'):
                    self.current_project.DeleteAllRenderJobs()
                    logger.info("🗑️ Cleared existing render queue")
            except Exception as e:
                logger.warning(f"Could not clear render queue: {e}")

            # Delete any existing output file to avoid detecting old renders
            for ext in ['.mp4', '.mov', '.avi']:
                old_file = organized_output_folder / f"{render_filename}{ext}"
                if old_file.exists():
                    try:
                        old_file.unlink()
                        logger.info(f"🗑️ Deleted old render file: {old_file}")
                    except Exception as e:
                        logger.warning(f"Could not delete old file {old_file}: {e}")

            # Start rendering - we know these methods work from the diagnostic
            job_id = None
            try:
                # Add render job first (required)
                job_id = self.current_project.AddRenderJob()
                if job_id:
                    logger.info(f"✅ Render job added: {job_id}")
                else:
                    raise Exception("AddRenderJob returned None")

                # Start the rendering process
                render_started = self.current_project.StartRendering()
                if render_started:
                    logger.info(f"✅ Rendering started successfully")
                else:
                    logger.warning("⚠️ StartRendering returned False but job was added")

            except Exception as e:
                logger.error(f"❌ Failed to start rendering: {e}")
                raise Exception(f"Could not start rendering: {e}")
            
            logger.info(f"Rendering started with job ID: {job_id}")
            
            # Wait for render to complete with improved status monitoring
            last_progress = 0
            render_timeout = 0
            max_timeout = 300  # 5 minutes max wait time
            
            while render_timeout < max_timeout:
                # Try different ways to get render status
                status = None
                try:
                    # Method 1: Get status by job ID (if available)
                    if job_id and job_id != True and hasattr(self.current_project, 'GetRenderJobStatus') and callable(getattr(self.current_project, 'GetRenderJobStatus', None)):
                        status = self.current_project.GetRenderJobStatus(job_id)
                    
                    # Method 2: Get current render status (if available)
                    if not status and hasattr(self.current_project, 'GetCurrentRenderJobStatus') and callable(getattr(self.current_project, 'GetCurrentRenderJobStatus', None)):
                        status = self.current_project.GetCurrentRenderJobStatus()
                    
                    # Method 3: Check if rendering is still active (if available)
                    if not status and hasattr(self.current_project, 'IsRenderingInProgress') and callable(getattr(self.current_project, 'IsRenderingInProgress', None)):
                        is_rendering = self.current_project.IsRenderingInProgress()
                        if not is_rendering:
                            # Rendering completed, check for output file in organized folder
                            output_path = organized_output_folder / f"{render_filename}.mp4"
                            if output_path.exists():
                                logger.info(f"Rendering completed successfully: {output_path}")
                                return str(output_path)
                            else:
                                # Check with different extensions
                                for ext in ['.mp4', '.mov', '.avi']:
                                    alt_path = organized_output_folder / f"{render_filename}{ext}"
                                    if alt_path.exists():
                                        logger.info(f"Rendering completed successfully: {alt_path}")
                                        return str(alt_path)
                                        
                                logger.warning("Rendering finished but output file not found")
                                continue
                        else:
                            logger.info(f"Rendering in progress... ({render_timeout}s elapsed)")
                            time.sleep(5)
                            render_timeout += 5
                            continue
                    else:
                        # No render status methods available, wait longer before checking for file
                        # Only check every 10 seconds to avoid false positives from old files
                        if render_timeout % 10 == 0:
                            logger.info(f"No render status methods available, checking for output file... ({render_timeout}s elapsed)")

                            # Check with different extensions
                            for ext in ['.mp4', '.mov', '.avi']:
                                alt_path = organized_output_folder / f"{render_filename}{ext}"
                                if alt_path.exists():
                                    # Verify file was created recently (within last 30 seconds)
                                    import os
                                    file_age = time.time() - os.path.getmtime(str(alt_path))

                                    # Also check file size is growing (render in progress) or stable (render complete)
                                    file_size = os.path.getsize(str(alt_path))

                                    # If file is less than 1MB, it's probably still being created
                                    if file_size < 1_000_000:
                                        logger.debug(f"File exists but too small ({file_size:,} bytes), render likely in progress...")
                                        continue

                                    # Wait a bit and check if file size is still changing
                                    time.sleep(2)
                                    new_file_size = os.path.getsize(str(alt_path))

                                    if new_file_size > file_size:
                                        # File is still growing, render in progress
                                        logger.debug(f"File still growing ({file_size:,} → {new_file_size:,} bytes), render in progress...")
                                        continue

                                    # File exists, is large enough, and not growing - render complete!
                                    if file_age < 30:
                                        logger.info(f"Rendering completed successfully: {alt_path} (file age: {file_age:.1f}s, size: {file_size:,} bytes)")

                                        # Clear render queue after successful completion
                                        try:
                                            if hasattr(self.current_project, 'DeleteAllRenderJobs'):
                                                self.current_project.DeleteAllRenderJobs()
                                                logger.info("🗑️ Cleared render queue after completion")
                                        except Exception as cleanup_error:
                                            logger.warning(f"Could not clear render queue after completion: {cleanup_error}")

                                        return str(alt_path)
                                    else:
                                        logger.warning(f"Found file but it's too old ({file_age:.1f}s), waiting for new render...")

                        # Wait before next check
                        time.sleep(5)
                        render_timeout += 5
                        continue
                    
                except Exception as status_error:
                    logger.warning(f"Error getting render status: {status_error}")
                    # Still check for output file even if status check fails
                    output_path = organized_output_folder / f"{render_filename}.mp4"
                    if output_path.exists():
                        logger.info(f"Rendering completed successfully (status check failed): {output_path}")
                        return str(output_path)
                    
                    time.sleep(2)
                    render_timeout += 2
                    continue
                
                # Process status if we got one
                if status and isinstance(status, dict):
                    job_status = status.get('JobStatus', 'Unknown')
                    if job_status == 'Complete':
                        output_path = organized_output_folder / f"{render_filename}.mp4"
                        logger.info(f"Rendering completed successfully: {output_path}")

                        # Clear render queue after successful completion
                        try:
                            if hasattr(self.current_project, 'DeleteAllRenderJobs'):
                                self.current_project.DeleteAllRenderJobs()
                                logger.info("🗑️ Cleared render queue after completion")
                        except Exception as cleanup_error:
                            logger.warning(f"Could not clear render queue after completion: {cleanup_error}")

                        return str(output_path)
                    elif job_status == 'Failed':
                        raise Exception(f"Render failed: {status.get('Error', 'Unknown error')}")
                    elif job_status == 'Cancelled':
                        raise Exception("Render was cancelled")
                    
                    # Show progress
                    completion = status.get('CompletionPercentage', 0)
                    if completion and completion - last_progress >= 10:
                        logger.info(f"Rendering progress: {completion}%")
                        last_progress = completion
                else:
                    logger.info(f"Waiting for render status... ({render_timeout}s elapsed)")
                
                time.sleep(5)
                render_timeout += 5
            
            raise Exception(f"Render timeout after {max_timeout} seconds")
            
        except Exception as e:
            logger.error(f"Failed to render project: {e}")
            return False

# ============================================================================
# MAGNUMSTREAM INTEGRATION - CLI and Job Processing
# ============================================================================

def process_single_job(job_file_path):
    """Process a single DaVinci job file (for CLI usage)"""
    try:
        with open(job_file_path, 'r') as f:
            job_data = json.load(f)
        
        logger.info(f"Processing job file: {job_file_path}")
        
        # Initialize automation
        automation = DaVinciAutomation()
        
        # Process the job
        result = automation.process_job(job_data)
        
        if result:
            # Move job file to completed folder on success
            completed_path = COMPLETED_FOLDER / Path(job_file_path).name
            COMPLETED_FOLDER.mkdir(parents=True, exist_ok=True)
            shutil.move(str(job_file_path), str(completed_path))
            logger.info(f"Job completed successfully. Moved to: {completed_path}")
            return result
        else:
            # Mark job file as failed
            error_path = Path(job_file_path).with_suffix('.error')
            Path(job_file_path).rename(error_path)
            logger.error(f"Job failed. Marked as: {error_path}")
            return False
            
    except Exception as e:
        logger.error(f"Error processing job file {job_file_path}: {e}")
        return False

class JobWatcher:
    """Watch for new jobs from the MagnumStream Mac service"""
    
    def __init__(self, automation):
        self.automation = automation
        self.watch_folder = Path(WATCH_FOLDER)
        self.watch_folder.mkdir(parents=True, exist_ok=True)
        OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
        COMPLETED_FOLDER.mkdir(parents=True, exist_ok=True)
    
    def watch(self):
        """Main watch loop"""
        logger.info(f"Watching folder: {self.watch_folder}")
        
        while True:
            try:
                # Look for JSON job files
                job_files = list(self.watch_folder.glob("*.json"))
                
                for job_file in job_files:
                    logger.info(f"Found new job: {job_file.name}")
                    
                    # Read job data
                    with open(job_file, 'r') as f:
                        job_data = json.load(f)
                    
                    # Process the job
                    if self.automation.process_job(job_data):
                        # Move to completed folder on success
                        completed_path = Path(COMPLETED_FOLDER) / job_file.name
                        shutil.move(str(job_file), str(completed_path))
                        
                        # Notify web app of completion (you can implement webhook here)
                        self._notify_completion(job_data['project_name'])
                    else:
                        # Move to error folder or rename with .error extension
                        error_path = job_file.with_suffix('.error')
                        job_file.rename(error_path)
                
                # Wait before checking again
                time.sleep(5)
                
            except KeyboardInterrupt:
                logger.info("Stopping job watcher...")
                break
            except Exception as e:
                logger.error(f"Error in watch loop: {e}")
                time.sleep(10)
    
    def _notify_completion(self, project_name):
        """Notify web app that rendering is complete"""
        # Implement webhook or API call to your web app
        # Example:
        # requests.post("http://your-web-app/api/render-complete", 
        #               json={"project": project_name, "status": "complete"})
        pass

# ============================================================================
# SAMPLE JOB JSON FORMAT
# ============================================================================
"""
Expected JSON format from web app:
{
    "project_name": "Smith_Family_Tour_20241018_1430",
    "patron_name": "Smith Family",
    "purchase_amount": 89.99,
    "clips": {
        "1": {
            "filename": "smith_clip1.mp4",
            "in_point": 90,  # Frame number (3 seconds at 30fps)
            "out_point": 240  # Frame number (8 seconds at 30fps)
        },
        "2": {
            "filename": "smith_clip2.mp4",
            "in_point": 0,
            "out_point": 150
        },
        // ... clips 3-8
    },
    "render_settings": {
        "format": "mp4",
        "quality": "high",
        "watermark": false
    }
}
"""

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def main():
    """Main entry point with CLI argument support"""
    parser = argparse.ArgumentParser(description='DaVinci Resolve Automation for MagnumStream')
    parser.add_argument('--job-file', type=str, help='Process a single job file')
    parser.add_argument('--watch', action='store_true', help='Watch folder for new jobs')
    parser.add_argument('--version', action='version', version='MagnumStream DaVinci Automation 1.0')
    
    args = parser.parse_args()
    
    logger.info("="*60)
    logger.info("MagnumStream DaVinci Resolve Automation Started")
    logger.info("="*60)
    
    if args.job_file:
        # Process single job file (used by Mac service)
        job_file = Path(args.job_file)
        if not job_file.exists():
            logger.error(f"Job file not found: {job_file}")
            sys.exit(1)
        
        result = process_single_job(job_file)
        if result:
            print(f"SUCCESS: {result}")  # Print output path for Mac service
            sys.exit(0)
        else:
            print("FAILED")
            sys.exit(1)
    
    elif args.watch:
        # Watch mode for continuous processing
        automation = DaVinciAutomation()
        watcher = JobWatcher(automation)
        watcher.watch()
    
    else:
        # Default: show usage
        parser.print_help()
        print("\nExamples:")
        print("  python3 Davinci.py --job-file /path/to/job.json")
        print("  python3 Davinci.py --watch")

if __name__ == "__main__":
    main()