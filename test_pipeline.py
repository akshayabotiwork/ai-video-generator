import os
import sys
from core.pipeline import NewsVideoPipeline

def test_pipeline():
    print("=== Testing AI News-Video Generator Pipeline ===")
    
    sample_script = (
        "In a historic 2012 cricket showdown, Virat Kohli produced a masterclass batting performance against England. "
        "The dynamic Indian batsman dominated the English bowling attack with pinpoint precision and aggressive stroke play. "
        "This iconic innings cemented his reputation as one of the modern era's greatest match-winners in world cricket."
    )
    
    pipeline = NewsVideoPipeline()
    
    print("\n1. Parsing script into scenes...")
    project = pipeline.parse_script_to_storyboard(
        script_text=sample_script,
        category="sports",
        project_title="Kohli 2012 Masterclass"
    )
    print(f"Generated {len(project.scenes)} scenes:")
    for s in project.scenes:
        print(f"  [Scene {s.scene_id}] Query: '{s.search_query}' | Entity: '{s.primary_entity}' | Year: '{s.temporal_anchor}' | Headline: '{s.lower_third_headline}'")

    print("\n2. Discovering & ranking media via SERP Searcher...")
    pipeline.discover_media_for_project(project)
    for s in project.scenes:
        print(f"  [Scene {s.scene_id}] Downloaded: {s.local_media_path} | Candidates: {len(s.visual_candidates)}")

    print("\n3. Synthesizing voiceover narration with Edge-TTS...")
    pipeline.generate_narration_for_project(project)
    for s in project.scenes:
        print(f"  [Scene {s.scene_id}] Audio: {s.local_audio_path} ({s.audio_duration:.2f}s)")

    print("\n4. Rendering Broadcast Video via FFmpeg...")
    def on_progress(p):
        print(f"  Rendering Progress: {p}%")
        
    output_path = pipeline.render_project_video(project, progress_callback=on_progress)
    print(f"\nSUCCESS! Broadcast Video exported to: {output_path}")
    print(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    test_pipeline()
