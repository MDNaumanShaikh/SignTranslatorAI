"""
Copy sign videos from ASL Citizen dataset to media folder for dictionary playback.
"""
import json
import os
import shutil
from pathlib import Path

# Paths
LABELS_JSON = "../models/labels.json"
DATASET_ROOT = "D:/OFFICIAL (D)/Downloads/ASL_Citizen/ASL_Citizen/videos"
OUTPUT_DIR = "../media/gloss_videos"
OUTPUT_MANIFEST = "../models/gloss_videos.json"

# Create output directory
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load labels
with open(LABELS_JSON, 'r') as f:
    labels = json.load(f)

# Map to store video paths
video_map = {}

# Find matching videos in dataset
dataset_path = Path(DATASET_ROOT)
if dataset_path.exists():
    for label in labels:
        # Look for video files matching the label
        # Format: <digits>-<GLOSS>.mp4
        label_sanitized = label.replace(' ', '_').replace('-', '_')
        
        # Search for matching video files
        for video_file in dataset_path.glob(f"*-{label}.mp4"):
            output_filename = f"{label}.mp4"
            output_path = os.path.join(OUTPUT_DIR, output_filename)
            
            # Copy video
            try:
                shutil.copy2(video_file, output_path)
                video_map[label] = f"media/gloss_videos/{output_filename}"
                print(f"Copied: {label}")
                break
            except Exception as e:
                print(f"Failed to copy {label}: {e}")
        
        # If not found with exact match, try with underscores
        if label not in video_map:
            for video_file in dataset_path.glob(f"*-{label_sanitized}.mp4"):
                output_filename = f"{label}.mp4"
                output_path = os.path.join(OUTPUT_DIR, output_filename)
                
                try:
                    shutil.copy2(video_file, output_path)
                    video_map[label] = f"media/gloss_videos/{output_filename}"
                    print(f"Copied: {label} (with underscores)")
                    break
                except Exception as e:
                    print(f"Failed to copy {label}: {e}")
else:
    print(f"Dataset path not found: {DATASET_ROOT}")

# Save manifest
with open(OUTPUT_MANIFEST, 'w') as f:
    json.dump(video_map, f, indent=2)

print(f"\nTotal videos copied: {len(video_map)}/{len(labels)}")
print(f"Manifest saved to: {OUTPUT_MANIFEST}")
