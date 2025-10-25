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
TEMPLATE_PROJECT_NAME = "MAG_FERRARI-BACKUP"  # Your template project name in Resolve

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

# Timeline Configuration - Updated for 5-slot MagnumStream template
TIMELINE_NAME = "MAG_FERRARI"  # Name of timeline in your template
CLIP_TRACKS = {
    1: "V1",  # Track 1 for all clips (single track template)
}

# Clip Mapping - Maps slot numbers to timeline positions (matches SLOT_TEMPLATE from schema.ts)
# Updated for 5 slots with exact frame positions at 23.976fps to match schema durations
CLIP_POSITIONS = {
    1: {"track": 1, "start_frame": 0},      # Slot 1: 0s, duration 1.627s (39 frames)
    2: {"track": 1, "start_frame": 39},     # Slot 2: 1.627s, duration 1.502s (36 frames) 
    3: {"track": 1, "start_frame": 75},     # Slot 3: 3.129s, duration 1.543s (37 frames)
    4: {"track": 1, "start_frame": 112},    # Slot 4: 4.672s, duration 2.503s (60 frames)
    5: {"track": 1, "start_frame": 172},    # Slot 5: 7.175s, duration 2.002s (48 frames)
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
            
            # Load template project
            if not self._load_template_project():
                return False
            
            # Import and replace clips using existing project structure
            if not self._replace_clips_from_project(clips, recording_id):
                return False
            
            # Save as new project
            if not self._save_project(project_name):
                return False
            
            # Render the project
            output_path = self._render_project(project_name)
            if not output_path:
                return False
            
            logger.info(f"Successfully completed DaVinci render: {output_path}")
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
    
    def _replace_clips_from_project(self, clips, recording_id):
        """Replace placeholder clips with new recordings from ClipGenerator output"""
        try:
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
                
                # Import clip
                imported = self.media_pool.ImportMedia([str(clip_path)])
                if imported:
                    # Calculate frame-based in/out points for precise timing
                    duration_frames = self._seconds_to_frames(clip_info.get('duration', 3.0))
                    
                    media_items[slot_number] = {
                        'media': imported[0],
                        'in_point': 0,  # Start from beginning of generated clip
                        'out_point': duration_frames,  # Use exact duration from SLOT_TEMPLATE
                        'slot_info': clip_info
                    }
                    logger.info(f"Imported slot {slot_number}: {clip_info['filename']} ({clip_info.get('duration', 3.0)}s)")
            
            # Replace clips on timeline using precise slot positions
            for slot_number, clip_data in media_items.items():
                if slot_number not in CLIP_POSITIONS:
                    logger.warning(f"No position defined for slot {slot_number}")
                    continue
                
                position = CLIP_POSITIONS[slot_number]
                track_index = position['track']
                start_frame = position['start_frame']
                
                # Get the timeline item at this position
                timeline_items = self.timeline.GetItemListInTrack('video', track_index)
                
                # Find the item at our target position
                for item in timeline_items:
                    item_start = item.GetStart()
                    item_end = item.GetEnd()
                    
                    # Check if this is the placeholder we want to replace
                    if item_start <= start_frame < item_end:
                        # Set in and out points on the media pool item
                        media_item = clip_data['media']
                        
                        # Replace the clip using take system for clean replacement
                        if item.AddTake(media_item):
                            item.SelectTakeByIndex(item.GetTakesCount())
                            logger.info(f"Replaced slot {slot_number} at frame {start_frame} with {clip_data['slot_info']['filename']}")
                        else:
                            # Fallback: Delete and add new clip
                            logger.warning(f"Take system failed for slot {slot_number}, trying direct replacement")
                            # This might require timeline edit operations depending on DaVinci version
                        break
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to replace clips from project: {e}")
            return False
    
    def _seconds_to_frames(self, seconds, fps=23.976):
        """Convert seconds to frames at project frame rate"""
        return int(seconds * fps)
    
    def _save_project(self, project_name):
        """Save the project with a new name"""
        try:
            # Save current state
            self.project_manager.SaveProject()
            
            # Create a new project with our name
            # Note: DaVinci Resolve doesn't have a "Save As" in the API
            # So we save the current project and then rename it
            self.current_project.SetName(project_name)
            self.project_manager.SaveProject()
            
            logger.info(f"Project saved and renamed to: {project_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save project: {e}")
            return False
    
    def _render_project(self, project_name):
        """Set up and start rendering, returns output file path on success"""
        try:
            # Ensure output directory exists
            OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
            
            # Set render settings for final output
            render_settings = {
                "SelectAllFrames": True,
                "TargetDir": str(OUTPUT_FOLDER),
                "CustomName": project_name,
                "UniqueFilenameStyle": 0,  # Don't add numbers
                "ExportVideo": True,
                "ExportAudio": True,
                "FormatWidth": 1920,
                "FormatHeight": 1080,
                "FrameRate": "23.976",  # Match template frame rate
                "VideoQuality": 0,  # 0 = Automatic
                "AudioCodec": "aac",
                "AudioBitDepth": 16,
                "AudioSampleRate": 48000
            }
            
            self.current_project.SetRenderSettings(render_settings)
            
            # Load render preset if available
            try:
                self.current_project.LoadRenderPreset(RENDER_PRESET)
                logger.info(f"Loaded render preset: {RENDER_PRESET}")
            except:
                logger.warning(f"Could not load render preset {RENDER_PRESET}, using default settings")
            
            # Add current timeline to render queue
            if not self.current_project.AddRenderJob():
                raise Exception("Could not add render job")
            
            # Start rendering
            job_id = self.current_project.StartRendering()
            if not job_id:
                raise Exception("Could not start rendering")
            
            logger.info(f"Rendering started with job ID: {job_id}")
            
            # Wait for render to complete with progress tracking
            last_progress = 0
            while True:
                status = self.current_project.GetRenderJobStatus(job_id)
                if status['JobStatus'] == 'Complete':
                    output_path = OUTPUT_FOLDER / f"{project_name}.mp4"
                    logger.info(f"Rendering completed successfully: {output_path}")
                    return str(output_path)
                elif status['JobStatus'] == 'Failed':
                    raise Exception(f"Render failed: {status.get('Error', 'Unknown error')}")
                elif status['JobStatus'] == 'Cancelled':
                    raise Exception("Render was cancelled")
                
                # Show progress (only log when it changes significantly)
                completion = status.get('CompletionPercentage', 0)
                if completion - last_progress >= 10:  # Log every 10%
                    logger.info(f"Rendering progress: {completion}%")
                    last_progress = completion
                
                time.sleep(2)
            
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