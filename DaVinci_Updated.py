#!/usr/bin/env python3
"""
DaVinci Resolve Automation Script for MagnumStream Integration
Updated to work with 5-slot structure and Mac service file paths
"""

import sys
import os
import json
import time
import subprocess
from datetime import datetime
from pathlib import Path
import logging
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except ImportError:
    from backports.zoneinfo import ZoneInfo  # Fallback for older Python

# Hawaii timezone - ensures folders are always created with Hawaii dates
HAWAII_TZ = ZoneInfo('Pacific/Honolulu')

def get_hawaii_datetime():
    """Get current datetime in Hawaii timezone"""
    return datetime.now(HAWAII_TZ)

# DaVinci Resolve Script API
try:
    import DaVinciResolveScript as dvr
except ImportError:
    print("ERROR: DaVinci Resolve Script API not found.")
    print("Please ensure DaVinci Resolve Studio is installed and scripting is enabled.")
    sys.exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Paths Configuration (Updated for Mac service integration)
TEMPLATE_PROJECT_NAME = "MAG_FERRARI-BACKUP"  # Your actual template project name
MAC_SERVICE_PROJECTS_DIR = Path("/Users/magnummedia/MagnumStream/projects")  # Mac service projects
OUTPUT_FOLDER = Path("./rendered_videos")  # Local output folder
COMPLETED_FOLDER = Path("./completed_jobs")  # Processed job files

# Your actual DaVinci template positions (from get_clips_simple.lua output)
CLIP_POSITIONS = {
    1: {"track": 3, "start_frame": 86570, "duration_frames": 39},   # Cruising front
    2: {"track": 3, "start_frame": 86633, "duration_frames": 36},   # Cruising side
    3: {"track": 3, "start_frame": 87135, "duration_frames": 37},   # Chase side
    4: {"track": 3, "start_frame": 87328, "duration_frames": 60},   # Chase side  
    5: {"track": 3, "start_frame": 87565, "duration_frames": 48}    # Arrival side
}

# Render Settings
RENDER_PRESET = "YouTube 1080p"
TIMELINE_NAME = "MAG_FERARRI"  # Your actual timeline name

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

class MagnumStreamDaVinciAutomation:
    def __init__(self):
        """Initialize DaVinci Resolve connection"""
        self.resolve = None
        self.project_manager = None
        self.current_project = None
        self.media_pool = None
        self.timeline = None
        
        self._connect_to_resolve()
    
    def _connect_to_resolve(self):
        """Establish connection to DaVinci Resolve with auto-launch"""
        try:
            # First, try to connect to existing instance
            self.resolve = dvr.scriptapp("Resolve")
            
            if not self.resolve:
                logger.info("DaVinci Resolve not running, attempting to start...")
                # Launch DaVinci Resolve
                if sys.platform == "darwin":  # macOS
                    subprocess.Popen(["/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/MacOS/Resolve"])
                    time.sleep(15)  # Give it time to start
                    
                    # Retry connection
                    for attempt in range(5):
                        logger.info(f"Connection attempt {attempt + 1}/5...")
                        self.resolve = dvr.scriptapp("Resolve")
                        if self.resolve:
                            break
                        time.sleep(5)
            
            if not self.resolve:
                raise Exception("Could not connect to DaVinci Resolve")
            
            self.project_manager = self.resolve.GetProjectManager()
            if not self.project_manager:
                raise Exception("Could not get Project Manager")
            
            logger.info("Successfully connected to DaVinci Resolve")
        except Exception as e:
            logger.error(f"Failed to connect to DaVinci Resolve: {e}")
            sys.exit(1)
    
    def process_magnumstream_job(self, job_file_path):
        """Process a MagnumStream job file"""
        try:
            # Read the MagnumStream DaVinci job file
            with open(job_file_path, 'r') as f:
                job_data = json.load(f)
            
            project_name = job_data['projectName']
            clips = job_data['clips']
            
            logger.info(f"Processing MagnumStream job: {project_name}")
            logger.info(f"Found {len(clips)} clips to replace")
            
            # Load template project
            if not self._load_template_project():
                return False
            
            # Replace clips with MagnumStream recordings
            if not self._replace_clips_magnumstream(clips):
                return False
            
            # Save as new project
            if not self._save_project(project_name):
                return False
            
            # Render the project
            if not self._render_project(project_name):
                return False
            
            logger.info(f"Successfully completed MagnumStream project: {project_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing MagnumStream job: {e}")
            return False
    
    def _load_template_project(self):
        """Load the Ferrari template project"""
        try:
            # Close any currently open project
            current = self.project_manager.GetCurrentProject()
            if current:
                self.project_manager.CloseProject(current)
            
            # Load template
            self.current_project = self.project_manager.LoadProject(TEMPLATE_PROJECT_NAME)
            if not self.current_project:
                raise Exception(f"Could not load template project: {TEMPLATE_PROJECT_NAME}")
            
            self.media_pool = self.current_project.GetMediaPool()
            
            # Get the timeline
            timeline_count = self.current_project.GetTimelineCount()
            for i in range(1, timeline_count + 1):
                timeline = self.current_project.GetTimelineByIndex(i)
                if timeline.GetName() == TIMELINE_NAME:
                    self.timeline = timeline
                    self.current_project.SetCurrentTimeline(timeline)
                    break
            
            if not self.timeline:
                raise Exception(f"Could not find timeline: {TIMELINE_NAME}")
            
            logger.info(f"Template project '{TEMPLATE_PROJECT_NAME}' loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load template project: {e}")
            return False
    
    def _replace_clips_magnumstream(self, clips):
        """Replace placeholder clips with MagnumStream recordings"""
        try:
            # Create a new bin for this project's clips
            root_folder = self.media_pool.GetRootFolder()
            clip_bin = self.media_pool.AddSubFolder(root_folder, f"MagnumStream_{get_hawaii_datetime().strftime('%Y%m%d_%H%M%S')}")
            self.media_pool.SetCurrentFolder(clip_bin)
            
            # Import all clips to media pool
            media_items = {}
            for slot_num_str, clip_info in clips.items():
                slot_num = int(slot_num_str)
                clip_path = Path(clip_info['fullPath'])
                
                if not clip_path.exists():
                    logger.warning(f"Clip file not found: {clip_path}")
                    continue
                
                # Import clip
                imported = self.media_pool.ImportMedia([str(clip_path)])
                if imported:
                    media_items[slot_num] = {
                        'media': imported[0],
                        'clip_info': clip_info
                    }
                    logger.info(f"Imported slot {slot_num}: {clip_info['filename']}")
            
            # Replace clips on timeline using exact frame positions
            for slot_num, media_data in media_items.items():
                if slot_num not in CLIP_POSITIONS:
                    logger.warning(f"No template position defined for slot {slot_num}")
                    continue
                
                position = CLIP_POSITIONS[slot_num]
                track_index = position['track']
                start_frame = position['start_frame']
                template_duration = position['duration_frames']
                
                logger.info(f"Replacing slot {slot_num} at frame {start_frame} on track {track_index}")
                
                # Get timeline items from the specific track
                timeline_items = self.timeline.GetItemListInTrack('video', track_index)
                
                # Find the item at our target position
                target_item = None
                for item in timeline_items:
                    item_start = item.GetStart()
                    item_end = item.GetEnd()
                    
                    # Check if this placeholder overlaps our target frame
                    if item_start <= start_frame < item_end:
                        target_item = item
                        break
                
                if target_item:
                    # Set source in/out points to match template duration
                    media_item = media_data['media']
                    
                    # Use the entire 3-second clip (MagnumStream clips are already cut to size)
                    media_item.SetClipProperty("Start", "0")
                    media_item.SetClipProperty("End", str(template_duration))
                    
                    # Replace using take system (most reliable method)
                    if target_item.AddTake(media_item):
                        take_count = target_item.GetTakesCount()
                        target_item.SelectTakeByIndex(take_count)
                        logger.info(f"✅ Successfully replaced slot {slot_num} (take {take_count})")
                    else:
                        logger.warning(f"❌ Could not replace slot {slot_num} using take system")
                else:
                    logger.warning(f"❌ No timeline item found at frame {start_frame} for slot {slot_num}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to replace clips: {e}")
            return False
    
    def _save_project(self, project_name):
        """Save the project with a new name"""
        try:
            # Save current state
            self.project_manager.SaveProject()
            
            # Rename the project
            sanitized_name = f"MagnumStream_{project_name}_{get_hawaii_datetime().strftime('%Y%m%d_%H%M%S')}"
            self.current_project.SetName(sanitized_name)
            self.project_manager.SaveProject()
            
            logger.info(f"Project saved as: {sanitized_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save project: {e}")
            return False
    
    def _render_project(self, project_name):
        """Set up and start rendering"""
        try:
            # Ensure output directory exists
            OUTPUT_FOLDER.mkdir(exist_ok=True)
            
            # Set render settings
            render_settings = {
                "SelectAllFrames": True,
                "TargetDir": str(OUTPUT_FOLDER),
                "CustomName": f"MagnumStream_{project_name}",
                "UniqueFilenameStyle": 0,
                "ExportVideo": True,
                "ExportAudio": True,
                "FormatWidth": 1920,
                "FormatHeight": 1080,
                "FrameRate": "24",  # Match your template frame rate
                "VideoQuality": 0,
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
                logger.warning(f"Could not load render preset: {RENDER_PRESET}, using default settings")
            
            # Add current timeline to render queue
            if not self.current_project.AddRenderJob():
                raise Exception("Could not add render job")
            
            # Start rendering
            job_id = self.current_project.StartRendering()
            if not job_id:
                raise Exception("Could not start rendering")
            
            logger.info(f"Rendering started with job ID: {job_id}")
            
            # Wait for render to complete
            while True:
                status = self.current_project.GetRenderJobStatus(job_id)
                if status['JobStatus'] == 'Complete':
                    logger.info("Rendering completed successfully")
                    break
                elif status['JobStatus'] == 'Failed':
                    raise Exception(f"Render failed: {status.get('Error', 'Unknown error')}")
                elif status['JobStatus'] == 'Cancelled':
                    raise Exception("Render was cancelled")
                
                # Show progress
                completion = status.get('CompletionPercentage', 0)
                logger.info(f"Rendering progress: {completion}%")
                time.sleep(2)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to render project: {e}")
            return False

# ============================================================================
# JOB PROCESSING
# ============================================================================

def process_magnumstream_jobs():
    """Watch for MagnumStream job files and process them"""
    automation = MagnumStreamDaVinciAutomation()
    
    logger.info("Watching for MagnumStream job files...")
    logger.info(f"Projects directory: {MAC_SERVICE_PROJECTS_DIR}")
    
    while True:
        try:
            # Look for DaVinci job files in project directories
            for project_dir in MAC_SERVICE_PROJECTS_DIR.glob("*"):
                if project_dir.is_dir():
                    davinci_dir = project_dir / "davinci"
                    if davinci_dir.exists():
                        job_files = list(davinci_dir.glob("job_*.json"))
                        
                        for job_file in job_files:
                            logger.info(f"Found MagnumStream job: {job_file.name}")
                            
                            # Process the job
                            if automation.process_magnumstream_job(job_file):
                                # Move to completed folder on success
                                COMPLETED_FOLDER.mkdir(exist_ok=True)
                                completed_path = COMPLETED_FOLDER / job_file.name
                                job_file.rename(completed_path)
                                logger.info(f"Job completed and moved to: {completed_path}")
                            else:
                                # Rename with .error extension
                                error_path = job_file.with_suffix('.error')
                                job_file.rename(error_path)
                                logger.error(f"Job failed, renamed to: {error_path}")
            
            # Wait before checking again
            time.sleep(10)
            
        except KeyboardInterrupt:
            logger.info("Stopping job processor...")
            break
        except Exception as e:
            logger.error(f"Error in job processing loop: {e}")
            time.sleep(30)

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def main():
    """Main entry point"""
    logger.info("=" * 60)
    logger.info("MagnumStream DaVinci Resolve Automation Started")
    logger.info("=" * 60)
    
    # Start processing jobs
    process_magnumstream_jobs()

if __name__ == "__main__":
    main()