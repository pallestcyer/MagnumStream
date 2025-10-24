#!/usr/bin/env python3
"""
DaVinci Resolve Selected Clips Analyzer
Analyzes only the clips you have selected in the timeline
"""

import sys
import json
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

OUTPUT_FILE = "clip_positions.json"

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('selected_clips_analyzer.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# SELECTED CLIPS ANALYZER
# ============================================================================

class SelectedClipsAnalyzer:
    def __init__(self):
        """Initialize DaVinci Resolve connection"""
        self.resolve = None
        self.project_manager = None
        self.current_project = None
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
            
            self.current_project = self.project_manager.GetCurrentProject()
            if not self.current_project:
                raise Exception("No project is currently open")
            
            self.timeline = self.current_project.GetCurrentTimeline()
            if not self.timeline:
                raise Exception("No timeline is currently active")
            
            logger.info("Successfully connected to DaVinci Resolve")
            logger.info(f"Project: {self.current_project.GetName()}")
            logger.info(f"Timeline: {self.timeline.GetName()}")
            
        except Exception as e:
            logger.error(f"Failed to connect to DaVinci Resolve: {e}")
            sys.exit(1)
    
    def analyze_selected_clips(self):
        """Analyze only the selected clips in the timeline"""
        try:
            print("🎬 Analyzing selected clips...")
            print("Make sure you have selected the clips you want to analyze in DaVinci Resolve!")
            print("-" * 50)
            
            # Get selected timeline items
            selected_items = self.timeline.GetSelectedItems()
            
            if not selected_items:
                print("❌ No clips are selected in the timeline!")
                print("\nPlease:")
                print("1. Go to DaVinci Resolve")
                print("2. Select the clips you want to analyze")
                print("3. Run this script again")
                return None
            
            print(f"✅ Found {len(selected_items)} selected clips")
            
            # Get timeline information
            timeline_info = self._get_timeline_info()
            
            # Analyze each selected clip
            clips_data = []
            for index, item in enumerate(selected_items):
                clip_info = self._analyze_clip(item, index + 1)
                if clip_info:
                    clips_data.append(clip_info)
            
            # Sort clips by timeline position
            clips_data.sort(key=lambda x: x["timeline_position"]["start_frame"])
            
            # Renumber after sorting
            for i, clip in enumerate(clips_data):
                clip["slot_number"] = i + 1
            
            # Create analysis result
            analysis_result = {
                "project_name": self.current_project.GetName(),
                "timeline_name": self.timeline.GetName(),
                "analysis_date": datetime.now().isoformat(),
                "timeline_info": timeline_info,
                "selected_clips_count": len(clips_data),
                "clips": clips_data,
                "clip_positions_map": self._generate_positions_map(clips_data),
                "davinci_config": self._generate_davinci_config(clips_data)
            }
            
            # Save results
            self._save_analysis(analysis_result)
            
            return analysis_result
            
        except Exception as e:
            logger.error(f"Error analyzing selected clips: {e}")
            return None
    
    def _get_timeline_info(self):
        """Get basic timeline information"""
        try:
            frame_rate = float(self.timeline.GetSetting("timelineFrameRate"))
            resolution = self.timeline.GetSetting("timelineResolution")
            
            return {
                "frame_rate": frame_rate,
                "resolution": resolution,
                "total_duration_frames": self.timeline.GetDurationInFrames(),
                "total_duration_seconds": self.timeline.GetDurationInFrames() / frame_rate
            }
        except Exception as e:
            logger.error(f"Error getting timeline info: {e}")
            return {}
    
    def _analyze_clip(self, timeline_item, slot_number):
        """Analyze individual selected clip"""
        try:
            # Get timing info
            start_frame = timeline_item.GetStart()
            end_frame = timeline_item.GetEnd()
            duration_frames = timeline_item.GetDuration()
            
            # Convert to time
            frame_rate = float(self.timeline.GetSetting("timelineFrameRate"))
            start_seconds = start_frame / frame_rate
            end_seconds = end_frame / frame_rate
            duration_seconds = duration_frames / frame_rate
            
            # Get clip name
            clip_name = timeline_item.GetName() or f"Clip_{slot_number}"
            
            # Get track info
            track_index = self._get_clip_track(timeline_item)
            
            # Get media pool item info
            media_pool_item = timeline_item.GetMediaPoolItem()
            source_info = {}
            if media_pool_item:
                clip_properties = media_pool_item.GetClipProperty()
                source_info = {
                    "file_name": clip_properties.get("File Name", "Unknown"),
                    "file_path": clip_properties.get("File Path", "Unknown"),
                    "source_duration": clip_properties.get("Duration", "Unknown")
                }
            
            clip_info = {
                "slot_number": slot_number,
                "clip_name": clip_name,
                "track": f"V{track_index}" if track_index else "Unknown",
                "track_index": track_index,
                "timeline_position": {
                    "start_frame": start_frame,
                    "end_frame": end_frame,
                    "duration_frames": duration_frames,
                    "start_seconds": round(start_seconds, 3),
                    "end_seconds": round(end_seconds, 3),
                    "duration_seconds": round(duration_seconds, 3),
                    "start_timecode": self._frames_to_timecode(start_frame, frame_rate),
                    "end_timecode": self._frames_to_timecode(end_frame, frame_rate)
                },
                "source": source_info
            }
            
            return clip_info
            
        except Exception as e:
            logger.error(f"Error analyzing clip: {e}")
            return None
    
    def _get_clip_track(self, timeline_item):
        """Find which track this clip is on"""
        try:
            # Get all video tracks and search for the item
            video_track_count = self.timeline.GetTrackCount("video")
            
            for track_index in range(1, video_track_count + 1):
                track_items = self.timeline.GetItemListInTrack("video", track_index)
                if timeline_item in track_items:
                    return track_index
            
            return None
        except:
            return None
    
    def _generate_positions_map(self, clips_data):
        """Generate position mapping for easy reference"""
        positions_map = {}
        
        for clip in clips_data:
            positions_map[f"clip_{clip['slot_number']}"] = {
                "slot": clip['slot_number'],
                "track": clip['track'],
                "track_index": clip['track_index'],
                "start_frame": clip['timeline_position']['start_frame'],
                "duration_frames": clip['timeline_position']['duration_frames'],
                "start_seconds": clip['timeline_position']['start_seconds'],
                "duration_seconds": clip['timeline_position']['duration_seconds'],
                "timecode_in": clip['timeline_position']['start_timecode'],
                "timecode_out": clip['timeline_position']['end_timecode'],
                "current_clip_name": clip['clip_name']
            }
        
        return positions_map
    
    def _generate_davinci_config(self, clips_data):
        """Generate config for your Davinci.py script"""
        config = {
            "CLIP_POSITIONS": {},
            "CLIP_TRACKS": {}
        }
        
        for clip in clips_data:
            slot_number = clip['slot_number']
            config["CLIP_POSITIONS"][slot_number] = {
                "track": clip['track_index'],
                "start_frame": clip['timeline_position']['start_frame']
            }
            
            track_key = clip['track_index']
            if track_key not in config["CLIP_TRACKS"]:
                config["CLIP_TRACKS"][track_key] = clip['track']
        
        return config
    
    def _frames_to_timecode(self, frames, frame_rate):
        """Convert frame number to timecode string"""
        try:
            total_seconds = frames / frame_rate
            hours = int(total_seconds // 3600)
            minutes = int((total_seconds % 3600) // 60)
            seconds = int(total_seconds % 60)
            frame_remainder = int((total_seconds % 1) * frame_rate)
            
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}:{frame_remainder:02d}"
        except:
            return "00:00:00:00"
    
    def _save_analysis(self, analysis_result):
        """Save analysis results as clean JSON"""
        try:
            # Create clean, minimal output for your application
            clean_output = {
                "project_name": analysis_result['project_name'],
                "timeline_name": analysis_result['timeline_name'],
                "frame_rate": analysis_result['timeline_info']['frame_rate'],
                "clips": []
            }
            
            # Add only essential clip data
            for clip in analysis_result['clips']:
                clean_clip = {
                    "slot": clip['slot_number'],
                    "name": clip['clip_name'],
                    "track": clip['track_index'],
                    "start_frame": clip['timeline_position']['start_frame'],
                    "duration_frames": clip['timeline_position']['duration_frames'],
                    "start_seconds": clip['timeline_position']['start_seconds'],
                    "duration_seconds": clip['timeline_position']['duration_seconds']
                }
                clean_output["clips"].append(clean_clip)
            
            # Save clean JSON
            with open(OUTPUT_FILE, 'w') as f:
                json.dump(clean_output, f, indent=2)
            
            logger.info(f"Clip positions saved to: {OUTPUT_FILE}")
            
        except Exception as e:
            logger.error(f"Error saving analysis: {e}")
    

# ============================================================================
# MAIN FUNCTIONS
# ============================================================================

def print_results_summary(analysis_result):
    """Print quick summary to console"""
    if not analysis_result:
        return
    
    print("\n" + "="*50)
    print("SELECTED CLIPS ANALYSIS RESULTS")
    print("="*50)
    
    print(f"Project: {analysis_result['project_name']}")
    print(f"Timeline: {analysis_result['timeline_name']}")
    print(f"Selected Clips: {analysis_result['selected_clips_count']}")
    
    print("\nClip Positions (in timeline order):")
    for clip in analysis_result['clips']:
        pos = clip['timeline_position']
        print(f"  Slot {clip['slot_number']}: {pos['start_timecode']} - {pos['end_timecode']} "
              f"({pos['duration_seconds']:.1f}s) on {clip['track']}")
    
    print(f"\n📄 File generated: {OUTPUT_FILE}")
    print("="*50)

def main():
    """Main entry point"""
    print("🎯 DaVinci Resolve Selected Clips Analyzer")
    print("This will analyze only the clips you have selected in your timeline")
    print("-" * 60)
    
    # Initialize analyzer
    analyzer = SelectedClipsAnalyzer()
    
    # Run analysis
    analysis_result = analyzer.analyze_selected_clips()
    
    if analysis_result:
        print_results_summary(analysis_result)
        print("\n✅ Analysis complete!")
        print(f"\n🎯 Use {OUTPUT_FILE} in your application for clip positions")
    else:
        print("\n❌ Analysis failed!")
        print("Check the log for details or make sure clips are selected.")

if __name__ == "__main__":
    main()