#!/usr/bin/env python3
"""
DaVinci Resolve Project Analyzer
Analyzes template project to find exact clip positions and timestamps for replacement
"""

import sys
import json
import time
from datetime import datetime, timedelta
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

# Template project settings
TEMPLATE_PROJECT_NAME = "MAG_FERRARI-NEW"  # Your template project name
TIMELINE_NAME = "MAG_FERARRI"  # Timeline to analyze
OUTPUT_FILE = "clip_positions.json"  # Output file for analysis results

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('davinci_analyzer.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# ANALYZER CLASS
# ============================================================================

class DaVinciProjectAnalyzer:
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
            
            logger.info("Successfully connected to DaVinci Resolve")
        except Exception as e:
            logger.error(f"Failed to connect to DaVinci Resolve: {e}")
            sys.exit(1)
    
    def analyze_template_project(self):
        """Analyze the template project and extract clip positions"""
        try:
            # Load template project
            if not self._load_template_project():
                return None
            
            # Get timeline information
            timeline_info = self._get_timeline_info()
            
            # Analyze all tracks
            track_analysis = self._analyze_all_tracks()
            
            # Combine analysis results
            analysis_result = {
                "project_name": TEMPLATE_PROJECT_NAME,
                "timeline_name": TIMELINE_NAME,
                "analysis_date": datetime.now().isoformat(),
                "timeline_info": timeline_info,
                "tracks": track_analysis,
                "clip_positions": self._generate_clip_position_map(track_analysis),
                "replacement_guide": self._generate_replacement_guide(track_analysis)
            }
            
            # Save results
            self._save_analysis(analysis_result)
            
            return analysis_result
            
        except Exception as e:
            logger.error(f"Error analyzing project: {e}")
            return None
    
    def _load_template_project(self):
        """Load the template project"""
        try:
            # Close any currently open project
            current = self.project_manager.GetCurrentProject()
            if current:
                self.project_manager.CloseProject(current)
            
            # Load template
            self.current_project = self.project_manager.LoadProject(TEMPLATE_PROJECT_NAME)
            if not self.current_project:
                raise Exception(f"Could not load template project: {TEMPLATE_PROJECT_NAME}")
            
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
    
    def _get_timeline_info(self):
        """Get basic timeline information"""
        try:
            frame_rate = float(self.timeline.GetSetting("timelineFrameRate"))
            resolution = self.timeline.GetSetting("timelineResolution")
            
            timeline_info = {
                "frame_rate": frame_rate,
                "resolution": resolution,
                "total_duration_frames": self.timeline.GetDurationInFrames(),
                "total_duration_seconds": self.timeline.GetDurationInFrames() / frame_rate,
                "video_track_count": self.timeline.GetTrackCount("video"),
                "audio_track_count": self.timeline.GetTrackCount("audio")
            }
            
            logger.info(f"Timeline info: {frame_rate}fps, {resolution}, "
                       f"{timeline_info['total_duration_seconds']:.1f}s")
            
            return timeline_info
            
        except Exception as e:
            logger.error(f"Error getting timeline info: {e}")
            return {}
    
    def _analyze_all_tracks(self):
        """Analyze all video tracks for clips"""
        try:
            video_track_count = self.timeline.GetTrackCount("video")
            tracks_analysis = {}
            
            for track_index in range(1, video_track_count + 1):
                logger.info(f"Analyzing video track {track_index}...")
                
                # Get all items in this track
                track_items = self.timeline.GetItemListInTrack("video", track_index)
                
                clips_in_track = []
                for item_index, item in enumerate(track_items):
                    clip_info = self._analyze_clip(item, track_index, item_index)
                    if clip_info:
                        clips_in_track.append(clip_info)
                
                tracks_analysis[f"V{track_index}"] = {
                    "track_index": track_index,
                    "clip_count": len(clips_in_track),
                    "clips": clips_in_track
                }
                
                logger.info(f"Track V{track_index}: {len(clips_in_track)} clips found")
            
            return tracks_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing tracks: {e}")
            return {}
    
    def _analyze_clip(self, timeline_item, track_index, item_index):
        """Analyze individual clip properties"""
        try:
            # Get basic timing info
            start_frame = timeline_item.GetStart()
            end_frame = timeline_item.GetEnd()
            duration_frames = timeline_item.GetDuration()
            
            # Convert to time
            frame_rate = float(self.timeline.GetSetting("timelineFrameRate"))
            start_seconds = start_frame / frame_rate
            end_seconds = end_frame / frame_rate
            duration_seconds = duration_frames / frame_rate
            
            # Get media pool item (source clip)
            media_pool_item = timeline_item.GetMediaPoolItem()
            
            # Get clip properties
            clip_name = timeline_item.GetName() if timeline_item.GetName() else "Unnamed Clip"
            
            # Source file info
            source_info = {}
            if media_pool_item:
                clip_properties = media_pool_item.GetClipProperty()
                source_info = {
                    "file_name": clip_properties.get("File Name", "Unknown"),
                    "file_path": clip_properties.get("File Path", "Unknown"),
                    "resolution": f"{clip_properties.get('Resolution', 'Unknown')}",
                    "frame_rate": clip_properties.get("FPS", "Unknown"),
                    "duration": clip_properties.get("Duration", "Unknown")
                }
            
            # Check for effects/grades
            has_effects = len(timeline_item.GetFusionCompCount()) > 0
            
            clip_info = {
                "clip_index": item_index + 1,
                "clip_name": clip_name,
                "track": f"V{track_index}",
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
                "source": source_info,
                "has_effects": has_effects,
                "replacement_ready": self._is_replacement_candidate(clip_name, source_info)
            }
            
            return clip_info
            
        except Exception as e:
            logger.error(f"Error analyzing clip: {e}")
            return None
    
    def _is_replacement_candidate(self, clip_name, source_info):
        """Determine if this clip should be replaced"""
        # Define patterns that indicate placeholder clips
        placeholder_patterns = [
            "placeholder", "template", "sample", "demo", "test",
            "clip_1", "clip_2", "clip_3", "clip_4", 
            "clip_5", "clip_6", "clip_7", "clip_8"
        ]
        
        clip_name_lower = clip_name.lower()
        file_name_lower = source_info.get("file_name", "").lower()
        
        # Check if clip name or filename contains placeholder patterns
        for pattern in placeholder_patterns:
            if pattern in clip_name_lower or pattern in file_name_lower:
                return True
        
        return False
    
    def _generate_clip_position_map(self, tracks_analysis):
        """Generate a map of clip positions for easy replacement"""
        position_map = {}
        clip_counter = 1
        
        # Sort all clips by start time across all tracks
        all_clips = []
        for track_name, track_data in tracks_analysis.items():
            for clip in track_data["clips"]:
                clip["track_name"] = track_name
                all_clips.append(clip)
        
        # Sort by start time
        all_clips.sort(key=lambda x: x["timeline_position"]["start_frame"])
        
        # Create position map
        for clip in all_clips:
            if clip["replacement_ready"]:
                position_map[f"clip_{clip_counter}"] = {
                    "target_slot": clip_counter,
                    "track": clip["track_name"],
                    "timeline_start_seconds": clip["timeline_position"]["start_seconds"],
                    "timeline_duration_seconds": clip["timeline_position"]["duration_seconds"],
                    "start_frame": clip["timeline_position"]["start_frame"],
                    "end_frame": clip["timeline_position"]["end_frame"],
                    "timecode_in": clip["timeline_position"]["start_timecode"],
                    "timecode_out": clip["timeline_position"]["end_timecode"],
                    "current_clip_name": clip["clip_name"],
                    "replacement_instructions": {
                        "method": "replace_media",
                        "preserve_timing": True,
                        "preserve_effects": clip["has_effects"]
                    }
                }
                clip_counter += 1
        
        return position_map
    
    def _generate_replacement_guide(self, tracks_analysis):
        """Generate a human-readable replacement guide"""
        guide = {
            "summary": {},
            "step_by_step": [],
            "ffmpeg_commands": []
        }
        
        # Count total clips to replace
        total_clips = 0
        replacement_clips = 0
        
        for track_data in tracks_analysis.values():
            total_clips += track_data["clip_count"]
            replacement_clips += sum(1 for clip in track_data["clips"] if clip["replacement_ready"])
        
        guide["summary"] = {
            "total_clips_in_project": total_clips,
            "clips_to_replace": replacement_clips,
            "tracks_with_replacements": len([t for t in tracks_analysis.values() 
                                           if any(c["replacement_ready"] for c in t["clips"])])
        }
        
        # Generate step-by-step instructions
        step_counter = 1
        for track_name, track_data in tracks_analysis.items():
            for clip in track_data["clips"]:
                if clip["replacement_ready"]:
                    guide["step_by_step"].append({
                        "step": step_counter,
                        "action": f"Replace clip in {track_name}",
                        "current_clip": clip["clip_name"],
                        "position": f"{clip['timeline_position']['start_timecode']} - {clip['timeline_position']['end_timecode']}",
                        "duration": f"{clip['timeline_position']['duration_seconds']:.1f} seconds",
                        "notes": "Ensure new clip matches duration" if not clip["has_effects"] else "Preserve existing effects/grades"
                    })
                    step_counter += 1
        
        return guide
    
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
        """Save analysis results to JSON file"""
        try:
            output_path = Path(OUTPUT_FILE)
            with open(output_path, 'w') as f:
                json.dump(analysis_result, f, indent=2, default=str)
            
            logger.info(f"Analysis results saved to: {output_path.absolute()}")
            
            # Also create a human-readable summary
            summary_path = output_path.with_suffix('.summary.txt')
            self._create_text_summary(analysis_result, summary_path)
            
        except Exception as e:
            logger.error(f"Error saving analysis: {e}")
    
    def _create_text_summary(self, analysis_result, output_path):
        """Create a human-readable text summary"""
        try:
            with open(output_path, 'w') as f:
                f.write("DaVinci Resolve Project Analysis Summary\n")
                f.write("=" * 50 + "\n\n")
                
                # Project info
                f.write(f"Project: {analysis_result['project_name']}\n")
                f.write(f"Timeline: {analysis_result['timeline_name']}\n")
                f.write(f"Analysis Date: {analysis_result['analysis_date']}\n\n")
                
                # Timeline info
                timeline_info = analysis_result['timeline_info']
                f.write("Timeline Information:\n")
                f.write(f"  Frame Rate: {timeline_info.get('frame_rate', 'Unknown')} fps\n")
                f.write(f"  Resolution: {timeline_info.get('resolution', 'Unknown')}\n")
                f.write(f"  Duration: {timeline_info.get('total_duration_seconds', 0):.1f} seconds\n")
                f.write(f"  Video Tracks: {timeline_info.get('video_track_count', 0)}\n\n")
                
                # Replacement guide
                guide = analysis_result['replacement_guide']
                f.write("Replacement Summary:\n")
                f.write(f"  Total clips: {guide['summary']['total_clips_in_project']}\n")
                f.write(f"  Clips to replace: {guide['summary']['clips_to_replace']}\n\n")
                
                # Step by step
                f.write("Clips to Replace:\n")
                f.write("-" * 30 + "\n")
                for step in guide['step_by_step']:
                    f.write(f"{step['step']}. {step['action']}\n")
                    f.write(f"   Current: {step['current_clip']}\n")
                    f.write(f"   Position: {step['position']}\n")
                    f.write(f"   Duration: {step['duration']}\n")
                    f.write(f"   Notes: {step['notes']}\n\n")
                
                # Clip position mapping
                f.write("Clip Position Mapping:\n")
                f.write("-" * 30 + "\n")
                for clip_key, clip_data in analysis_result['clip_positions'].items():
                    f.write(f"{clip_key.upper()}:\n")
                    f.write(f"  Track: {clip_data['track']}\n")
                    f.write(f"  Timecode: {clip_data['timecode_in']} - {clip_data['timecode_out']}\n")
                    f.write(f"  Duration: {clip_data['timeline_duration_seconds']:.1f}s\n")
                    f.write(f"  Frame Range: {clip_data['start_frame']} - {clip_data['end_frame']}\n\n")
            
            logger.info(f"Text summary saved to: {output_path}")
            
        except Exception as e:
            logger.error(f"Error creating text summary: {e}")

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def print_analysis_summary(analysis_result):
    """Print a quick summary to console"""
    if not analysis_result:
        print("No analysis results to display")
        return
    
    print("\n" + "="*60)
    print("DAVINCI RESOLVE PROJECT ANALYSIS")
    print("="*60)
    
    print(f"Project: {analysis_result['project_name']}")
    print(f"Timeline: {analysis_result['timeline_name']}")
    
    timeline_info = analysis_result['timeline_info']
    print(f"Duration: {timeline_info.get('total_duration_seconds', 0):.1f} seconds")
    print(f"Frame Rate: {timeline_info.get('frame_rate', 'Unknown')} fps")
    
    guide = analysis_result['replacement_guide']
    print(f"\nClips to Replace: {guide['summary']['clips_to_replace']}")
    print(f"Total Clips: {guide['summary']['total_clips_in_project']}")
    
    print("\nClip Positions:")
    for clip_key, clip_data in analysis_result['clip_positions'].items():
        print(f"  {clip_key.upper()}: {clip_data['timecode_in']} - {clip_data['timecode_out']} "
              f"({clip_data['timeline_duration_seconds']:.1f}s) on {clip_data['track']}")
    
    print(f"\nDetailed results saved to: {OUTPUT_FILE}")
    print("="*60)

# ============================================================================
# MAIN FUNCTION
# ============================================================================

def main():
    """Main entry point"""
    print("DaVinci Resolve Project Analyzer")
    print("Analyzing template project for clip positions...")
    print("-" * 50)
    
    # Initialize analyzer
    analyzer = DaVinciProjectAnalyzer()
    
    # Run analysis
    analysis_result = analyzer.analyze_template_project()
    
    if analysis_result:
        print_analysis_summary(analysis_result)
        print(f"\nAnalysis complete! Check {OUTPUT_FILE} for detailed results.")
    else:
        print("Analysis failed. Check the log for details.")

if __name__ == "__main__":
    main()