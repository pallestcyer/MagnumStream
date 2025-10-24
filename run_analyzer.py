#!/usr/bin/env python3
"""
Quick runner script for DaVinci Resolve Project Analyzer
Simpler interface for one-time analysis
"""

import sys
import json
from pathlib import Path

# Import the analyzer
try:
    from davinci_analyzer import DaVinciProjectAnalyzer, print_analysis_summary
except ImportError:
    print("Error: Could not import davinci_analyzer.py")
    print("Make sure davinci_analyzer.py is in the same directory")
    sys.exit(1)

def quick_analyze(project_name=None, timeline_name=None):
    """Quick analysis with optional custom names"""
    
    print("🎬 DaVinci Resolve Project Analyzer")
    print("=" * 50)
    
    # Update project name if provided
    if project_name:
        import davinci_analyzer
        davinci_analyzer.TEMPLATE_PROJECT_NAME = project_name
        print(f"Analyzing project: {project_name}")
    
    if timeline_name:
        import davinci_analyzer
        davinci_analyzer.TIMELINE_NAME = timeline_name
        print(f"Timeline: {timeline_name}")
    
    print("Connecting to DaVinci Resolve...")
    
    try:
        # Run analysis
        analyzer = DaVinciProjectAnalyzer()
        result = analyzer.analyze_template_project()
        
        if result:
            print("\n✅ Analysis completed successfully!")
            print_analysis_summary(result)
            
            # Show file locations
            print(f"\n📄 Files created:")
            print(f"   • clip_positions.json (detailed data)")
            print(f"   • clip_positions.summary.txt (human readable)")
            print(f"   • davinci_analyzer.log (execution log)")
            
            return result
        else:
            print("\n❌ Analysis failed!")
            print("Check davinci_analyzer.log for details")
            return None
            
    except Exception as e:
        print(f"\n❌ Error during analysis: {e}")
        return None

def show_quick_help():
    """Show usage help"""
    print("DaVinci Resolve Project Analyzer")
    print("=" * 40)
    print("Usage:")
    print("  python run_analyzer.py                    # Analyze default template")
    print("  python run_analyzer.py ProjectName        # Analyze specific project")
    print("  python run_analyzer.py ProjectName Timeline  # Custom project + timeline")
    print("")
    print("What this script does:")
    print("• Connects to DaVinci Resolve")
    print("• Analyzes your template project")
    print("• Finds all clip positions and timestamps")
    print("• Identifies which clips need replacement")
    print("• Generates mapping for automation")
    print("")
    print("Make sure DaVinci Resolve is open before running!")

if __name__ == "__main__":
    # Parse command line arguments
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help', 'help']:
        show_quick_help()
        sys.exit(0)
    
    # Get project and timeline names from arguments
    project_name = sys.argv[1] if len(sys.argv) > 1 else None
    timeline_name = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Run analysis
    result = quick_analyze(project_name, timeline_name)
    
    if result:
        print("\n🎯 Next steps:")
        print("1. Review clip_positions.json for exact timestamps")
        print("2. Update your Davinci.py CLIP_POSITIONS with these values")
        print("3. Test replacement with your new clip files")
    else:
        print("\n💡 Troubleshooting:")
        print("• Make sure DaVinci Resolve is open")
        print("• Check that the project name exists")
        print("• Verify scripting is enabled in DaVinci preferences")