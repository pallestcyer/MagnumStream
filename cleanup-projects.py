#!/usr/bin/env python3
"""
Cleanup script to remove old project files and client data
"""

import os
import shutil
import json
from pathlib import Path
from datetime import datetime, timedelta

# Base directory
BASE_DIR = Path(__file__).parent
PROJECTS_DIR = BASE_DIR / "projects"
RENDERED_DIR = BASE_DIR / "rendered"
COMPLETED_DIR = BASE_DIR / "completed"
QUEUE_DIR = BASE_DIR / "queue"

def cleanup_old_projects(days_old=7):
    """Remove project folders older than specified days"""
    if not PROJECTS_DIR.exists():
        print("📂 No projects directory found")
        return
    
    cutoff_date = datetime.now() - timedelta(days=days_old)
    removed_count = 0
    
    print(f"🧹 Cleaning up projects older than {days_old} days (before {cutoff_date.strftime('%Y-%m-%d')})")
    
    for project_dir in PROJECTS_DIR.iterdir():
        if project_dir.is_dir():
            # Get directory modification time
            mod_time = datetime.fromtimestamp(project_dir.stat().st_mtime)
            
            if mod_time < cutoff_date:
                try:
                    print(f"🗑️ Removing old project: {project_dir.name} (modified: {mod_time.strftime('%Y-%m-%d %H:%M')})")
                    shutil.rmtree(project_dir)
                    removed_count += 1
                except Exception as e:
                    print(f"❌ Failed to remove {project_dir.name}: {e}")
    
    print(f"✅ Removed {removed_count} old project folders")

def cleanup_rendered_files(days_old=7):
    """Remove rendered files older than specified days"""
    if not RENDERED_DIR.exists():
        print("📂 No rendered directory found")
        return
        
    cutoff_date = datetime.now() - timedelta(days=days_old)
    removed_count = 0
    
    print(f"🧹 Cleaning up rendered files older than {days_old} days")
    
    # Walk through the organized folder structure
    for root, dirs, files in os.walk(RENDERED_DIR):
        for file in files:
            file_path = Path(root) / file
            if file_path.suffix.lower() in ['.mp4', '.mov', '.avi']:
                mod_time = datetime.fromtimestamp(file_path.stat().st_mtime)
                
                if mod_time < cutoff_date:
                    try:
                        print(f"🗑️ Removing old rendered file: {file_path.relative_to(RENDERED_DIR)}")
                        file_path.unlink()
                        removed_count += 1
                    except Exception as e:
                        print(f"❌ Failed to remove {file_path}: {e}")
    
    # Remove empty directories
    for root, dirs, files in os.walk(RENDERED_DIR, topdown=False):
        for dir_name in dirs:
            dir_path = Path(root) / dir_name
            try:
                if not any(dir_path.iterdir()):  # Directory is empty
                    print(f"🗑️ Removing empty directory: {dir_path.relative_to(RENDERED_DIR)}")
                    dir_path.rmdir()
            except Exception as e:
                print(f"❌ Failed to remove empty directory {dir_path}: {e}")
    
    print(f"✅ Removed {removed_count} old rendered files")

def cleanup_completed_jobs():
    """Remove old completed job files"""
    if not COMPLETED_DIR.exists():
        print("📂 No completed directory found")
        return
        
    removed_count = 0
    
    print("🧹 Cleaning up completed job files")
    
    for job_file in COMPLETED_DIR.glob("*.json"):
        try:
            print(f"🗑️ Removing completed job: {job_file.name}")
            job_file.unlink()
            removed_count += 1
        except Exception as e:
            print(f"❌ Failed to remove {job_file}: {e}")
    
    print(f"✅ Removed {removed_count} completed job files")

def cleanup_queue_files():
    """Remove any leftover files in queue"""
    if not QUEUE_DIR.exists():
        print("📂 No queue directory found")
        return
        
    removed_count = 0
    
    print("🧹 Cleaning up queue files")
    
    for queue_file in QUEUE_DIR.iterdir():
        if queue_file.is_file():
            try:
                print(f"🗑️ Removing queue file: {queue_file.name}")
                queue_file.unlink()
                removed_count += 1
            except Exception as e:
                print(f"❌ Failed to remove {queue_file}: {e}")
    
    print(f"✅ Removed {removed_count} queue files")

def show_storage_usage():
    """Show current storage usage"""
    print("\n📊 Current Storage Usage:")
    
    directories = [
        ("Projects", PROJECTS_DIR),
        ("Rendered", RENDERED_DIR),
        ("Completed", COMPLETED_DIR),
        ("Queue", QUEUE_DIR)
    ]
    
    total_size = 0
    
    for name, path in directories:
        if path.exists():
            size = sum(f.stat().st_size for f in path.rglob('*') if f.is_file())
            size_mb = size / (1024 * 1024)
            total_size += size
            
            # Count files
            file_count = sum(1 for f in path.rglob('*') if f.is_file())
            
            print(f"  {name}: {size_mb:.1f} MB ({file_count} files)")
        else:
            print(f"  {name}: Directory not found")
    
    total_mb = total_size / (1024 * 1024)
    print(f"\n📈 Total Usage: {total_mb:.1f} MB")

def main():
    print("🧹 MagnumStream Project Cleanup Tool")
    print("=" * 50)
    
    # Show current usage
    show_storage_usage()
    
    print("\nCleanup Options:")
    print("1. Remove old projects (7+ days)")
    print("2. Remove old rendered files (7+ days)")
    print("3. Remove completed job files")
    print("4. Remove queue files")
    print("5. Full cleanup (all of the above)")
    print("6. Custom cleanup (specify days)")
    print("0. Exit")
    
    try:
        choice = input("\nSelect option (0-6): ").strip()
        
        if choice == "0":
            print("👋 Cleanup cancelled")
            return
        elif choice == "1":
            cleanup_old_projects(7)
        elif choice == "2":
            cleanup_rendered_files(7)
        elif choice == "3":
            cleanup_completed_jobs()
        elif choice == "4":
            cleanup_queue_files()
        elif choice == "5":
            cleanup_old_projects(7)
            cleanup_rendered_files(7)
            cleanup_completed_jobs()
            cleanup_queue_files()
        elif choice == "6":
            days = int(input("Enter number of days to keep: "))
            cleanup_old_projects(days)
            cleanup_rendered_files(days)
            cleanup_completed_jobs()
            cleanup_queue_files()
        else:
            print("❌ Invalid option")
            return
            
        print("\n📊 Storage after cleanup:")
        show_storage_usage()
        
    except KeyboardInterrupt:
        print("\n👋 Cleanup cancelled")
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")

if __name__ == "__main__":
    main()