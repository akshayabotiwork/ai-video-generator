import os
import sys

# Force UTF-8 for console output on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from core.pipeline import NewsVideoPipeline

def generate_real_news_video():
    print("==========================================================")
    print("[AI NEWS VIDEO GENERATOR - 9:16 SHORTS / REELS RENDER]")
    print("==========================================================")

    hindi_script = (
        "भारतीय क्रिकेट टीम ने अफगानिस्तान के खिलाफ तीन मैचों की T20I सीरीज के लिए टीम का ऐलान कर दिया है।\n"
        "सबसे बड़ा आकर्षण युवा वैभव सूर्यवंशी का पहली बार भारतीय टीम में शामिल होना है।\n"
        "जसप्रीत बुमराह और संजू सैमसन की भी टीम में वापसी हुई है, जबकि हार्दिक पंड्या चोट के कारण बाहर हैं।\n"
        "भारत और अफगानिस्तान के बीच तीनों मुकाबले दिल्ली में खेले जाएंगे।"
    )

    pipeline = NewsVideoPipeline()

    print("\n[Step 1] Analyzing Script & Segmenting Scenes with AI Director...")
    project = pipeline.parse_script_to_storyboard(
        script_text=hindi_script,
        category="sports",
        project_title="India vs Afghanistan T20 Squad"
    )
    project.theme = "sports_center"
    project.aspect_ratio = "9:16"      # 9:16 Portrait for Shorts / Reels
    project.voice = "hi-IN-MadhurNeural" # High-quality Hindi Voice
    project.include_subtitles = True
    project.include_ticker = True
    project.include_background_music = True

    print(f"Created {len(project.scenes)} scenes:")
    for s in project.scenes:
        print(f"   Scene {s.scene_id}: Query='{s.search_query}' | Entity='{s.primary_entity}' | Headline='{s.lower_third_headline}'")

    print("\n[Step 2] Searching Google Images via SERP API & Downloading Contextual Visuals...")
    pipeline.discover_media_for_project(project)
    for s in project.scenes:
        cand_count = len(s.visual_candidates)
        print(f"   Scene {s.scene_id}: Found {cand_count} candidates -> Downloaded: {s.local_media_path}")

    print("\n[Step 3] Generating Hindi Speech Narration with Edge-TTS...")
    pipeline.generate_narration_for_project(project)
    for s in project.scenes:
        print(f"   Scene {s.scene_id}: Audio duration = {s.audio_duration:.2f}s")

    print("\n[Step 4] FFmpeg Compositing (9:16 Format + Motion + Lower Thirds + Subtitles + Ducked Music)...")
    def on_progress(percent):
        print(f"   Rendering Progress: {percent}%")

    output_file = pipeline.render_project_video(project, progress_callback=on_progress)

    print("\n==========================================================")
    print("SUCCESS: REAL 9:16 BROADCAST VIDEO GENERATED SUCCESSFULLY!")
    print(f"Output Video: {output_file}")
    print(f"Video File Size: {os.path.getsize(output_file) / (1024 * 1024):.2f} MB")
    print("==========================================================")

if __name__ == "__main__":
    generate_real_news_video()

