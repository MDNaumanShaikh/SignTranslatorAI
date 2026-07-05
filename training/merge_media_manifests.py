"""
Merge thumbnail and video manifests into a single gloss_media.json.
"""
import json

# Load both manifests
with open("../models/gloss_media.json", 'r') as f:
    thumbnails = json.load(f)

with open("../models/gloss_videos.json", 'r') as f:
    videos = json.load(f)

# Merge: each entry has both thumbnailUrl and videoUrl if available
merged = {}
for label in set(list(thumbnails.keys()) + list(videos.keys())):
    merged[label] = {
        "thumbnailUrl": thumbnails.get(label),
        "videoUrl": videos.get(label)
    }

# Save merged manifest
with open("../models/gloss_media.json", 'w') as f:
    json.dump(merged, f, indent=2)

print(f"Merged {len(merged)} entries")
print(f"With thumbnails: {sum(1 for v in merged.values() if v['thumbnailUrl'])}")
print(f"With videos: {sum(1 for v in merged.values() if v['videoUrl'])}")
