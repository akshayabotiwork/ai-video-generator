import os
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from core.pipeline import NewsVideoPipeline


def main():
    script_text = (
        "भारत ने वेस्टइंडीज के खिलाफ पहले वनडे में शानदार जीत दर्ज की। "
        "विराट कोहली ने नाबाद 139 रनों की तूफानी पारी खेली, जबकि शुभमन गिल ने भी शतक जड़कर टीम को मजबूत शुरुआत दी। "
        "गेंदबाजों ने शानदार प्रदर्शन किया और भारत ने मुकाबला 8 विकेट से जीतकर सीरीज में बढ़त बनाई।"
    )

    project_title = "India vs WI 1st ODI Historic Win"
    category = "sports"
    theme = "sports_center"
    voice = "hi-IN-MadhurNeural"

    print("=== Processing User Script for Broadcast Video ===")
    print(f"Script:\n{script_text}\n")

    pipeline = NewsVideoPipeline()

    print("Step 1: Parsing script into broadcast scenes with Director...")
    project = pipeline.parse_script_to_storyboard(
        script_text=script_text,
        category=category,
        project_title=project_title
    )
    project.theme = theme
    project.voice = voice
    project.include_ticker = False
    project.include_subtitles = True

    print(f"Segmented {len(project.scenes)} scenes:")
    for idx, s in enumerate(project.scenes):
        # Assign dynamic transitions
        if idx == 0:
            s.transition_type = "fade"
        elif idx == 1:
            s.transition_type = "slideleft"
        elif idx == 2:
            s.transition_type = "wipeleft"
        else:
            s.transition_type = "fade"
        s.transition_duration = 0.8
        print(f"  [Scene {s.scene_id}] Query: '{s.search_query}' | Motion: {s.motion_style} | Transition: {s.transition_type}")

    print("\nStep 2: Searching and downloading targeted images via SERP API...")
    pipeline.discover_media_for_project(project)
    for s in project.scenes:
        print(f"  [Scene {s.scene_id}] Visual: {s.local_media_path}")

    print("\nStep 3: Synthesizing Hindi narration (hi-IN-MadhurNeural) & word sync timestamps...")
    pipeline.generate_narration_for_project(project)
    for s in project.scenes:
        print(f"  [Scene {s.scene_id}] Timeline: [{s.timeline_start:.1f}s - {s.timeline_end:.1f}s] (Audio: {s.audio_duration:.2f}s)")

    print(f"Total Video Timeline Duration: {project.total_timeline_duration:.1f}s")

    print("\nStep 4: Executing Single-Pass Unified Timeline Video Rendering (FFmpeg)...")
    def on_progress(p):
        print(f"  Rendering Progress: {p}%")

    output_path = pipeline.render_project_video(project, progress_callback=on_progress)

    print(f"\n=======================================================")
    print(f"✅ VIDEO GENERATION COMPLETED SUCCESSFULLY!")
    print(f"Output File: {output_path}")
    print(f"Size: {os.path.getsize(output_path) / (1024*1024):.2f} MB")
    print(f"Duration: {project.total_timeline_duration:.1f}s")
    print(f"=======================================================")

if __name__ == "__main__":
    main()
