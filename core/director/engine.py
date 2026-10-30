import re
import json
import time
from typing import List, Dict, Any, Tuple, Optional
from core.models import SceneData
from config import OPENAI_API_KEY, GEMINI_API_KEY, MOTION_CONFIG
from core.logger import system_logger
from core.director.prompts import SYSTEM_DIRECTOR_PROMPT

class ScriptDirector:
    """
    Universal AI Film & Video Director.
    Intelligently analyzes, segments, and directs ANY raw script across all genres
    into a fast-paced, high-retention cinematic video storyboard with maximum <= 3s cuts.
    """

    def __init__(self, openai_api_key: str = "", gemini_api_key: str = ""):
        self.openai_key = openai_api_key or OPENAI_API_KEY
        self.gemini_key = gemini_api_key or GEMINI_API_KEY

    def segment_script(
        self,
        script_text: str,
        category: str = "general",
        project_title: str = "",
        aspect_ratio: str = "16:9"
    ) -> List[SceneData]:
        """Main entry point to parse a raw script into structured SceneData objects."""
        clean_text = script_text.strip()
        if not clean_text:
            return []

        raw_scenes: List[SceneData] = []

        # 1. Primary AI Engine: Google Gemini
        if self.gemini_key:
            try:
                system_logger.info("DIRECTOR", f"Directing full script with Google Gemini (Title: '{project_title or 'Untitled'}', Format: {aspect_ratio}, Category: {category})...")
                raw_scenes = self._segment_with_gemini(clean_text, category, project_title=project_title, aspect_ratio=aspect_ratio)
                if raw_scenes:
                    system_logger.success("DIRECTOR", f"Gemini Director produced {len(raw_scenes)} cinematic scenes")
            except Exception as e:
                system_logger.warning("DIRECTOR", f"Gemini Director notice: {e}. Checking secondary engine...")
        else:
            system_logger.info("DIRECTOR", "Gemini API key not provided. Checking secondary AI engine...")

        # 2. Secondary AI Engine: OpenAI GPT-4o
        if not raw_scenes:
            if self.openai_key:
                try:
                    system_logger.info("DIRECTOR", f"Directing full script with OpenAI GPT-4o (Title: '{project_title or 'Untitled'}', Format: {aspect_ratio})...")
                    raw_scenes = self._segment_with_openai(clean_text, category, project_title=project_title, aspect_ratio=aspect_ratio)
                    if raw_scenes:
                        system_logger.success("DIRECTOR", f"OpenAI Director produced {len(raw_scenes)} cinematic scenes")
                except Exception as e:
                    system_logger.warning("DIRECTOR", f"OpenAI Director notice: {e}. Switching to universal fallback...")
            else:
                system_logger.info("DIRECTOR", "OpenAI API key not provided. Proceeding to universal fallback engine...")

        # 3. Universal Lightweight Fallback
        if not raw_scenes:
            system_logger.info("DIRECTOR", "Applying Universal Granular Sentence Segmentation Fallback...")
            raw_scenes = self._segment_fallback(clean_text, category)
            system_logger.success("DIRECTOR", f"Universal Fallback Director produced {len(raw_scenes)} scenes")

        # 4. Enforce strict <= 3.0s cut pacing
        raw_scenes = self._split_oversized_scenes(raw_scenes, max_words=8)

        # 5. Standardize scene IDs and bind transition defaults
        default_tdur = float(MOTION_CONFIG.get("transition_duration", 0.5))
        default_trans = str(MOTION_CONFIG.get("default_transition", "crossfade"))
        default_motion = MOTION_CONFIG.get("motion_styles", ["zoom_in"])[0]

        for idx, sc in enumerate(raw_scenes, start=1):
            sc.scene_id = idx
            if not sc.transition_duration or sc.transition_duration <= 0:
                sc.transition_duration = default_tdur
            if not sc.transition_type:
                sc.transition_type = default_trans
            if not sc.motion_style:
                sc.motion_style = default_motion

        system_logger.success("DIRECTOR", f"Director complete: {len(raw_scenes)} fast-paced scenes locked (<= 3s duration)")
        return raw_scenes

    def _split_oversized_scenes(self, scenes: List[SceneData], max_words: int = 8) -> List[SceneData]:
        motion_cycles = list(MOTION_CONFIG.get("motion_styles", ["zoom_in", "pan_right", "zoom_out", "pan_left"]))
        default_trans = str(MOTION_CONFIG.get("default_transition", "crossfade"))
        default_tdur = float(MOTION_CONFIG.get("transition_duration", 0.5))

        refined_scenes: List[SceneData] = []
        for sc in scenes:
            text = (sc.narration_text or "").strip()
            words = text.split()
            if len(words) <= max_words:
                refined_scenes.append(sc)
                continue

            split_pattern = r'([,;।!?॥—\n]|(?:\s+(?:और|and|तथा|लेकिन|but|या|or|कि|ताकि|तो)\s+))'
            raw_parts = re.split(split_pattern, text)
            
            chunks = []
            curr_chunk = ""
            for p in raw_parts:
                if not p:
                    continue
                test_chunk = (curr_chunk + p).strip()
                if len(test_chunk.split()) <= max_words:
                    curr_chunk = test_chunk + " "
                else:
                    if curr_chunk.strip():
                        chunks.append(curr_chunk.strip())
                    curr_chunk = p.strip() + " "
            if curr_chunk.strip():
                chunks.append(curr_chunk.strip())

            final_chunks = []
            for ch in chunks:
                ch_words = ch.split()
                if len(ch_words) <= max_words:
                    final_chunks.append(ch)
                else:
                    for i in range(0, len(ch_words), max_words):
                        sub = " ".join(ch_words[i:i + max_words])
                        if sub.strip():
                            final_chunks.append(sub.strip())

            if not final_chunks:
                final_chunks = [text]

            for sub_idx, chunk_text in enumerate(final_chunks):
                sub_query = sc.search_query
                if sub_idx == 1 and sc.secondary_queries and len(sc.secondary_queries) > 0:
                    sub_query = sc.secondary_queries[0]
                elif sub_idx >= 2 and sc.secondary_queries and len(sc.secondary_queries) > 1:
                    sub_query = sc.secondary_queries[1]
                elif sub_idx > 0:
                    sub_query = f"{sc.search_query} alternate angle hd".strip()

                chunk_words = chunk_text.split()
                headline = " ".join([w for w in chunk_words[:5] if len(w) > 1]).upper()

                micro_scene = SceneData(
                    scene_id=len(refined_scenes) + 1,
                    narration_text=chunk_text,
                    primary_entity=sc.primary_entity,
                    action=sc.action,
                    opponent_or_context=sc.opponent_or_context,
                    temporal_anchor=sc.temporal_anchor,
                    visual_category=getattr(sc, "visual_category", "dynamic_action"),
                    focal_point=getattr(sc, "focal_point", "center"),
                    motion_speed=getattr(sc, "motion_speed", "slow_dramatic"),
                    chapter_marker=getattr(sc, "chapter_marker", "") if sub_idx == 0 else "",
                    search_query=sub_query,
                    secondary_queries=sc.secondary_queries,
                    visual_type_preference=sc.visual_type_preference,
                    lower_third_headline=headline or sc.lower_third_headline,
                    category_tag=sc.category_tag,
                    motion_style=motion_cycles[(len(refined_scenes)) % len(motion_cycles)],
                    transition_type=sc.transition_type or default_trans,
                    transition_duration=sc.transition_duration or default_tdur
                )
                refined_scenes.append(micro_scene)

        return refined_scenes

    def _enforce_story_context_coherence(
        self,
        scenes: List[SceneData],
        global_story_anchor: str
    ) -> List[SceneData]:
        if not global_story_anchor or not global_story_anchor.strip():
            return scenes

        anchor_clean = global_story_anchor.strip()
        anchor_tokens = [
            w.lower() for w in re.findall(r'\b[A-Za-z0-9]+\b', anchor_clean)
            if len(w) > 2 and w.lower() not in {"with", "from", "that", "this", "over", "into", "the", "and", "for"}
        ]

        for sc in scenes:
            q = (sc.search_query or "").strip()
            has_quoted_entity = bool(re.search(r'"[^"]+"', q))
            entity_is_person = bool(sc.primary_entity and len(sc.primary_entity.split()) >= 2)
            query_words = q.split()

            if has_quoted_entity or (entity_is_person and len(query_words) >= 3) or len(query_words) >= 5:
                continue

            query_lower = q.lower()
            matched_count = sum(1 for kw in anchor_tokens if kw in query_lower)
            if matched_count < max(1, len(anchor_tokens) // 2):
                sc.search_query = f"{q} {anchor_clean}".strip()

        return scenes

    def _segment_with_gemini(
        self,
        script_text: str,
        category: str = "general",
        project_title: str = "",
        aspect_ratio: str = "16:9"
    ) -> List[SceneData]:
        from google import genai
        client = genai.Client(api_key=self.gemini_key)

        format_note = (
            "9:16 Vertical Video (TikTok / Shorts / Reels) -> prioritize vertical mobile portrait composition in visual queries and framing"
            if aspect_ratio == "9:16"
            else "16:9 Landscape Video (YouTube / TV / Web) -> prioritize wide cinematic landscape framing in visual queries"
        )

        prompt = (
            f"{SYSTEM_DIRECTOR_PROMPT}\n\n"
            f"PROJECT METADATA:\n"
            f"- Project Title: {project_title or 'Untitled Creative Video'}\n"
            f"- Video Genre / Category: {category}\n"
            f"- Target Aspect Ratio: {aspect_ratio} ({format_note})\n\n"
            f"RAW SCRIPT TO DIRECT:\n{script_text}\n\n"
            f"DIRECTOR'S MANDATORY CHECKLIST:\n"
            f"1. 100% COMPLETE VERBATIM SCRIPT FIDELITY: Cover entire script without omitting words.\n"
            f"2. STRICT SCENE DURATION & PACING (MAX 3 SECONDS PER SCENE, MAX 7-8 WORDS).\n"
            f"3. MULTI-ENTITY BREAKDOWN: Split each person into their OWN separate scene and search query.\n"
            f"4. VIDEO EDITOR B-ROLL & SMART QUERIES: Query individuals directly in double quotes. Tailor for {aspect_ratio} video ({format_note}).\n"
            f"5. Return ONLY a valid JSON object adhering to the schema."
        )

        models_to_try = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest']

        for model_name in models_to_try:
            for attempt in range(2):
                try:
                    system_logger.info("DIRECTOR", f"Querying Gemini API ({model_name}, attempt {attempt + 1})...")
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config={'response_mime_type': 'application/json'}
                    )
                    data = json.loads(response.text)
                    global_anchor = ""
                    items = []

                    if isinstance(data, dict):
                        global_anchor = data.get("global_story_anchor", "")
                        items = data.get("scenes", data.get("data", []))
                    elif isinstance(data, list):
                        items = data

                    if items:
                        parsed_scenes = [SceneData(**item) for item in items]
                        if not global_anchor and parsed_scenes:
                            global_anchor = parsed_scenes[0].opponent_or_context or parsed_scenes[0].temporal_anchor
                        system_logger.success(
                            "DIRECTOR",
                            f"Gemini ({model_name}) structured {len(parsed_scenes)} scenes (Story Anchor: '{global_anchor}')"
                        )
                        return self._enforce_story_context_coherence(parsed_scenes, global_anchor)
                except Exception as err:
                    err_msg = str(err)
                    system_logger.warning("DIRECTOR", f"Gemini ({model_name}) attempt {attempt + 1} notice: {err_msg[:120]}")
                    if "503" in err_msg or "UNAVAILABLE" in err_msg:
                        time.sleep(1.0)
                    else:
                        break

        raise RuntimeError("All Gemini model attempts exhausted.")

    def _segment_with_openai(
        self,
        script_text: str,
        category: str = "general",
        project_title: str = "",
        aspect_ratio: str = "16:9"
    ) -> List[SceneData]:
        from openai import OpenAI
        client = OpenAI(api_key=self.openai_key)

        format_note = (
            "9:16 Vertical Video (TikTok / Shorts / Reels) -> prioritize vertical mobile portrait composition in visual queries and framing"
            if aspect_ratio == "9:16"
            else "16:9 Landscape Video (YouTube / TV / Web) -> prioritize wide cinematic landscape framing in visual queries"
        )

        user_content = (
            f"PROJECT METADATA:\n"
            f"- Project Title: {project_title or 'Untitled Creative Video'}\n"
            f"- Video Genre / Category: {category}\n"
            f"- Target Aspect Ratio: {aspect_ratio} ({format_note})\n\n"
            f"RAW SCRIPT TO DIRECT:\n{script_text}"
        )

        messages = [
            {"role": "system", "content": SYSTEM_DIRECTOR_PROMPT},
            {"role": "user", "content": user_content}
        ]
        system_logger.info("DIRECTOR", "Sending prompt to OpenAI GPT-4o...")
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        parsed = json.loads(content)

        global_anchor = ""
        items = []
        if isinstance(parsed, dict):
            global_anchor = parsed.get("global_story_anchor", "")
            items = parsed.get("scenes", parsed.get("data", []))
        elif isinstance(parsed, list):
            items = parsed

        parsed_scenes = [SceneData(**item) for item in items]
        system_logger.success(
            "DIRECTOR",
            f"OpenAI GPT-4o structured {len(parsed_scenes)} scenes (Story Anchor: '{global_anchor}')"
        )
        return self._enforce_story_context_coherence(parsed_scenes, global_anchor)

    def _segment_fallback(self, script_text: str, category: str = "general") -> List[SceneData]:
        from core.director.fallback_segmenter import FallbackScriptDirector
        return FallbackScriptDirector.segment_script_fallback(script_text, category)

