#!/usr/bin/env python3
"""
DaVinci Resolve Automation Script for Helicopter Tour Video Production
Automatically replaces clips, saves project, and renders final video
"""

import sys
import os
import json
import time
import shutil
from datetime import datetime
from pathlib import Path
import logging

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

# Paths Configuration
TEMPLATE_PROJECT_NAME = "MagnumPI_Template"  # Your template project name in Resolve
WATCH_FOLDER = Path(r"C:\TourVideos\Queue")  # Folder where web app drops JSON files
CLIPS_FOLDER = Path(r"C:\TourVideos\Clips")  # Folder containing the recorded clips
OUTPUT_FOLDER = Path(r"C:\TourVideos\Rendered")  # Final rendered videos
COMPLETED_FOLDER = Path(r"C:\TourVideos\Completed")  # Processed JSON files

# Render Settings
RENDER_PRESET = "YouTube 1080p"  # Name of your render preset in Resolve
RENDER_FORMAT = "mp4"  # Output format
RENDER_CODEC = "H.264"  # Video codec

# Timeline Configuration
TIMELINE_NAME = "Main Timeline"  # Name of timeline in your template
CLIP_TRACKS = {
    1: "V1",  # Track 1 for clips 1-4
    2: "V2"   # Track 2 for clips 5-8 (if using multiple tracks)
}

# Clip Mapping - Maps clip numbers to timeline positions
# Adjust these based on your template's clip positions (in frames)
CLIP_POSITIONS = {
    1: {"track": 1, "start_frame": 0},
    2: {"track": 1, "start_frame": 300},  # 10 seconds at 30fps
    3: {"track": 1, "start_frame": 600},
    4: {"track": 1, "start_frame": 900},
    5: {"track": 1, "start_frame": 1200},
    6: {"track": 1, "start_frame": 1500},
    7: {"track": 1, "start_frame": 1800},
    8: {"track": 1, "start_frame": 2100}
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
            self.resolve = dvr.scriptapp("Resolve")
            if not self.resolve:
                raise Exception("Could not connect to DaVinci Resolve")
            
            self.project_manager = self.resolve.GetProjectManager()
            if not self.project_manager:
                raise Exception("Could not get Project Manager")
            
            logger.info("Successfully connected to DaVinci Resolve")
        except Exception as e:
            logger.error(f"Failed to connect to DaVinci Resolve: {e}")
            sys.exit(1)
    
    def process_job(self, job_data):
        """Main processing function for a single job"""
        try:
            project_name = job_data['project_name']
            clips = job_data['clips']
            
            logger.info(f"Starting processing for project: {project_name}")
            
            # Load template project
            if not self._load_template_project():
                return False
            
            # Import and replace clips
            if not self._replace_clips(clips):
                return False
            
            # Save as new project
            if not self._save_project(project_name):
                return False
            
            # Render the project
            if not self._render_project(project_name):
                return False
            
            logger.info(f"Successfully completed project: {project_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing job: {e}")
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
            
            logger.info("Template project loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load template project: {e}")
            return False
    
    def _replace_clips(self, clips):
        """Replace placeholder clips with new recordings"""
        try:
            # Create a new bin for this project's clips
            root_folder = self.media_pool.GetRootFolder()
            clip_bin = self.media_pool.AddSubFolder(root_folder, f"Clips_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            self.media_pool.SetCurrentFolder(clip_bin)
            
            # Import all clips to media pool
            media_items = {}
            for clip_num, clip_info in clips.items():
                clip_path = Path(CLIPS_FOLDER) / clip_info['filename']
                
                if not clip_path.exists():
                    logger.warning(f"Clip file not found: {clip_path}")
                    continue
                
                # Import clip
                imported = self.media_pool.ImportMedia([str(clip_path)])
                if imported:
                    media_items[int(clip_num)] = {
                        'media': imported[0],
                        'in_point': clip_info.get('in_point', 0),
                        'out_point': clip_info.get('out_point', 300)  # 10 seconds at 30fps
                    }
                    logger.info(f"Imported clip {clip_num}: {clip_info['filename']}")
            
            # Replace clips on timeline
            for clip_num, clip_data in media_items.items():
                if clip_num not in CLIP_POSITIONS:
                    logger.warning(f"No position defined for clip {clip_num}")
                    continue
                
                position = CLIP_POSITIONS[clip_num]
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
                        media_item.SetClipProperty("Start", str(clip_data['in_point']))
                        media_item.SetClipProperty("End", str(clip_data['out_point']))
                        
                        # Replace the clip
                        # Note: This is a simplified approach. You might need to:
                        # 1. Delete the old clip
                        # 2. Add the new clip at the same position
                        # The exact method depends on your Resolve version
                        
                        # Alternative approach using take system:
                        if item.AddTake(media_item):
                            item.SelectTakeByIndex(item.GetTakesCount())
                            logger.info(f"Replaced clip {clip_num} at position {start_frame}")
                        else:
                            logger.warning(f"Could not replace clip {clip_num}")
                        break
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to replace clips: {e}")
            return False
    
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
            
            logger.info(f"Project saved as: {project_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save project: {e}")
            return False
    
    def _render_project(self, project_name):
        """Set up and start rendering"""
        try:
            # Set render settings
            render_settings = {
                "SelectAllFrames": True,
                "TargetDir": str(OUTPUT_FOLDER),
                "CustomName": project_name,
                "UniqueFilenameStyle": 0,  # Don't add numbers
                "ExportVideo": True,
                "ExportAudio": True,
                "FormatWidth": 1920,
                "FormatHeight": 1080,
                "FrameRate": "30",  # Or your project frame rate
                "VideoQuality": 0,  # 0 = Automatic
                "AudioCodec": "aac",
                "AudioBitDepth": 16,
                "AudioSampleRate": 48000
            }
            
            self.current_project.SetRenderSettings(render_settings)
            
            # Load render preset if available
            self.current_project.LoadRenderPreset(RENDER_PRESET)
            
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
                    logger.info(f"Rendering completed successfully")
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
# WEB APP INTEGRATION
# ============================================================================

class JobWatcher:
    """Watch for new jobs from the web app"""
    
    def __init__(self, automation):
        self.automation = automation
        self.watch_folder = Path(WATCH_FOLDER)
        self.watch_folder.mkdir(parents=True, exist_ok=True)
        Path(CLIPS_FOLDER).mkdir(parents=True, exist_ok=True)
        Path(OUTPUT_FOLDER).mkdir(parents=True, exist_ok=True)
        Path(COMPLETED_FOLDER).mkdir(parents=True, exist_ok=True)
    
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
    """Main entry point"""
    logger.info("="*60)
    logger.info("DaVinci Resolve Automation Script Started")
    logger.info("="*60)
    
    # Initialize automation
    automation = DaVinciAutomation()
    
    # Start watching for jobs
    watcher = JobWatcher(automation)
    watcher.watch()

if __name__ == "__main__":
    main()