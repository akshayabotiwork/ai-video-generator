import re
import json
import time
from typing import List, Dict, Any, Tuple, Optional
from core.models import SceneData
from config import OPENAI_API_KEY, GEMINI_API_KEY
from core.logger import system_logger

SYSTEM_DIRECTOR_PROMPT = """
You are an elite, universal AI Film Director, Storyboard Artist, and Senior Visual Video Editor.
Your mission is to analyze ANY raw voiceover script in ANY language (Hindi, English, Hinglish, Gujarati, Marathi, etc.) across ANY genre (Sports, Documentaries, Biographies, Science, History, Nature, Tech, Business, News) and direct it into a fast-paced, high-retention cinematic visual storyboard.

================================================================================
🎥 CORE DIRECTING & EDITING PRINCIPLES
================================================================================

1. MAXIMUM SCENE DURATION: STRICT <= 3 SECONDS (HIGH-PACING VISUAL CUTS):
   - Fast, modern digital video retention requires dynamic cuts every 1.5 to 3.0 seconds.
   - HARD RULE: NO SCENE MAY EXCEED 3 SECONDS OF VOICEOVER DURATION.
   - Average speaking speed is ~2.3 words/second. Therefore, each scene must contain roughly 3 to 7 words (NEVER exceed 8 words in a single scene).
   - Aggressively cut every sentence at commas, conjunctions ('और', 'and', 'लेकिन', 'but', 'तथा', 'या', 'ताकि', 'कि', 'तो'), pauses, and subject shifts into separate micro-scenes.
   - MAXIMIZE SCENE COUNT: Creating plenty of granular scenes gives the video maximum visual variety and ensures each visual beat has its own distinct image.

2. MULTI-ENTITY SEPARATION RULE (INDIVIDUAL PLAYER / SUBJECT CUTS):
   - When a sentence lists multiple people, athletes, products, or entities (e.g. "जसप्रीत बुमराह, मोहम्मद सिराज और हार्दिक पांड्या शानदार फॉर्म में हैं"):
     * NEVER group them together into a single scene or a joint search query!
     * NEVER search for a combination photo of multiple players together.
     * Cut them into separate individual scenes:
       - Scene 1: "जसप्रीत बुमराह," (~1.2s) -> Entity: "Jasprit Bumrah" -> Query: '"Jasprit Bumrah" bowling celebration match'
       - Scene 2: "मोहम्मद सिराज" (~1.2s) -> Entity: "Mohammed Siraj" -> Query: '"Mohammed Siraj" bowling action wickets'
       - Scene 3: "और हार्दिक पांड्या" (~1.3s) -> Entity: "Hardik Pandya" -> Query: '"Hardik Pandya" cricket all rounder celebration'
       - Scene 4: "शानदार फॉर्म में हैं।" (~2.0s) -> Thematic B-Roll -> Query: 'cricket team dressing room practice ground'
     * Each individual gets their own dedicated 1.5 - 2.5 second cut with their own authentic image.

3. THE 5 UNIVERSAL VISUAL ARCHETYPES & CONTRAST RULE:
   Assign every single cut to one of these 5 universal shot types across ANY domain:
   - 'character_portrait': A person/figure/leader/athlete (e.g. Napoleon, Hardik Pandya, focused student, detective, CEO). Focus: expression, intensity, eye line.
   - 'dynamic_action': Physical action, movement, process (e.g. bowler delivery, rocket launch, factory assembly, runner sprinting, soldier charging).
   - 'symbolic_metaphor': Philosophical, psychological, thematic B-roll (e.g. burning candle in dark, falling hourglass sand, lone wolf on cliff, chess king, maze, cracking stone).
   - 'wide_environment': Setting, landscape, architecture, cosmos (e.g. James Webb deep space nebula, Roman Colosseum, cricket stadium floodlights, stormy sea).
   - 'artifact_detail': Concrete evidence, document, object, macro detail (e.g. ancient parchment, antique clock at 2 AM, magnifying glass, stock chart graph, microscope lens).
   * RULE OF VISUAL CONTRAST: Consecutive cuts MUST alternate visual categories (e.g. Portrait -> Wide Environment -> Symbolic Metaphor -> Action) to maintain high viewer retention!

4. CAMERA FOCAL POINT & PACING DYNAMICS:
   - 'focal_point':
     * "top_face": For character portraits (zooms towards the upper face/eyes; never cuts off the head!).
     * "center": For objects, symbols, artifacts, and general action.
     * "wide_horizon": For landscapes, stadiums, and environments (pans/zooms smoothly across the horizon).
   - 'motion_speed':
     * "slow_dramatic": For deep thoughts, history, philosophy, and suspense (subtle cinematic zoom).
     * "fast_punch": For sudden wickets, revelations, shocks, breaking news, or turning points (dynamic punch zoom).
     * "steady_pan": For comparisons, landscapes, and wide environments.
   - 'chapter_marker':
     * On major story milestones or act shifts (every 15-25 seconds), assign a punchy chapter title (e.g. "ACT I: THE AWAKENING", "THE POINT OF NO RETURN", "CHAPTER 2: THE BETRAYAL"). On other scenes, leave as an empty string ("").

5. EDITORIAL-GRADE SEARCH QUERY FORMULATION (MUSEUM & NATGEO QUALITY):
   Image search engines (Google Images / SERP API) deliver award-winning photography when queries use editorial modifiers:
   - For Character Portraits:
     * Format: '"{Full Name in double quotes}" {35mm portrait lighting / raw expression / authentic press}'
     * Example: '"Hardik Pandya" cricket bowling action hd'
     * Example: '"Julius Caesar" Roman statue bust marble museum archive'
     * Example: '"Steve Jobs" 1997 keynote portrait authentic'
     * CRITICAL: DO NOT add confusing global anchors to individual player/person queries!
   - For Wide Environments & Cosmos:
     * Format: '{Location / phenomenon} National Geographic 8k award winning photography wide angle'
     * Example: 'supermassive black hole event horizon accretion disk NASA visualization 8k'
     * Example: 'First Battle of Panipat 1526 historical miniature painting landscape'
   - For Symbolic Metaphors:
     * Format: 'cinematic metaphor {concept} moody dramatic lighting 35mm still'
     * Example: 'lone wolf standing on mountain cliff fog sunrise cinematic'
     * Example: 'hourglass sand running out dark background macro shot'
   - For Artifacts & Documents:
     * Format: 'macro shot {artifact/document} dramatic side lighting archival'
     * Example: 'antique pocket watch showing 2 am moonlight shadows noir'

6. SMART GLOBAL STORY ANCHOR USAGE (SELECTIVE, NOT FORCIBLE):
   - Identify the GLOBAL STORY ANCHOR for the overall narrative (e.g. "T20 World Cup 2024", "Apollo 11 Moon Landing 1969", "Battle of Waterloo 1815").
   - USE the Global Anchor ONLY on scenes describing event-level milestones or team outcomes where context is essential to prevent pulling photos from the wrong year or wrong match.
   - DO NOT USE the Global Anchor on individual player/entity shots or thematic B-rolls where it would pollute the query and cause search engines to fail.

7. 100% VERBATIM SCRIPT FIDELITY (ZERO DROPPED WORDS / ZERO SUMMARIZATION):
   - ABSOLUTE MANDATE: NEVER summarize, condense, shorten, rewrite, or drop ANY word or sentence from the script.
   - Joining all scenes' 'narration_text' in sequential order MUST reconstruct the 100% complete original script word-for-word in the original language.

================================================================================
OUTPUT JSON FORMAT:
================================================================================
Return a JSON object adhering to this structure:
{
  "global_story_anchor": "Concise English phrase identifying overarching event or context",
  "genre": "DOCUMENTARY / SCIENCE & TECH / HISTORY / NATURE / BIOGRAPHY / SPORTS / BUSINESS / EXPLAINER",
  "scenes": [
    {
      "scene_id": 1,
      "narration_text": "Exact voiceover text segment in original language (MAX 3-7 words, <= 3s)",
      "primary_entity": "Subject or B-roll category in English",
      "action": "Visual action / milestone / B-roll in English",
      "opponent_or_context": "Setting / opponent / era if applicable",
      "temporal_anchor": "Year or date if applicable",
      "visual_category": "character_portrait / dynamic_action / symbolic_metaphor / wide_environment / artifact_detail",
      "focal_point": "top_face / center / wide_horizon",
      "motion_speed": "slow_dramatic / fast_punch / steady_pan",
      "chapter_marker": "ACT I: THE BEGINNING (or empty string)",
      "search_query": "Clean, optimized editorial search query",
      "secondary_queries": [
        "Alternative visual angle 1 in English",
        "Alternative visual angle 2 in English"
      ],
      "visual_type_preference": "image",
      "lower_third_headline": "PUNCHY 3-5 WORD CAPTION IN ALL CAPS",
      "category_tag": "GENRE",
      "motion_style": "zoom_in / zoom_out / pan_left / pan_right / static",
      "transition_type": "crossfade / wipe / slide / push / zoom / circleReveal / blur / dipToBlack / glitch / spin",
      "transition_direction": "left / right / up / down / diagonal-tl / diagonal-tr",
      "layer_effects": ["vignette", "grain", "motion-blur", "glow"]
    }
  ]
}
"""

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

        # 1. Primary AI Engine: Google Gemini (State-of-the-Art Universal Director)
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

        # 3. Universal Lightweight Fallback (Zero hardcoding, works for any language/topic)
        if not raw_scenes:
            system_logger.info("DIRECTOR", "Applying Universal Granular Sentence Segmentation Fallback...")
            raw_scenes = self._segment_fallback(clean_text, category)
            system_logger.success("DIRECTOR", f"Universal Fallback Director produced {len(raw_scenes)} scenes")

        # 4. Enforce strict <= 3.0s cut pacing (subdivide any scenes exceeding 7-8 words)
        raw_scenes = self._split_oversized_scenes(raw_scenes, max_words=8)

        # 5. Standardize scene IDs and bind transition defaults from global config
        from config import MOTION_CONFIG
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
        """
        Strict 3-Second Cut Guarantee:
        Ensures no scene exceeds ~3 seconds of speech (max 7-8 words per scene).
        Splits any oversized scenes at natural linguistic boundaries (commas, conjunctions, pauses)
        while preserving 100% verbatim script words in exact sequential order.
        """
        from config import MOTION_CONFIG
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

            # Split on natural boundaries: commas, semicolons, dashes, and conjunctions
            split_pattern = r'([,;।!?॥—\n]|(?:\s+(?:और|and|तथा|लेकिन|but|या|or|कि|ताकि|तो)\s+))'
            raw_parts = re.split(split_pattern, text)
            
            # Reassemble into balanced chunks where each chunk <= max_words
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

            # If any chunk is still longer than max_words, chunk by words
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

            # Create micro-scenes for each chunk
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
        """
        Smart Contextual Coherence:
        Applies global anchor ONLY when a query lacks identity or is generic.
        NEVER appends the global anchor to specific individual person queries or
        cinematic B-rolls, avoiding search engine corruption and missing images.
        """
        if not global_story_anchor or not global_story_anchor.strip():
            return scenes

        anchor_clean = global_story_anchor.strip()
        anchor_tokens = [
            w.lower() for w in re.findall(r'\b[A-Za-z0-9]+\b', anchor_clean)
            if len(w) > 2 and w.lower() not in {"with", "from", "that", "this", "over", "into", "the", "and", "for"}
        ]

        for sc in scenes:
            q = (sc.search_query or "").strip()
            
            # Check if this query is an individual person query (has quoted name or primary_entity with multiple words)
            has_quoted_entity = bool(re.search(r'"[^"]+"', q))
            entity_is_person = bool(sc.primary_entity and len(sc.primary_entity.split()) >= 2)
            
            # Check if query already has sufficient descriptive detail (>= 4 words)
            query_words = q.split()
            
            # If the query is already specific (quoted person or rich B-roll descriptor), DO NOT pollute it!
            if has_quoted_entity or (entity_is_person and len(query_words) >= 3) or len(query_words) >= 5:
                continue

            # Only append global anchor if the query is brief/ambiguous and anchor is not already present
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
        """Directs the script using Google Gemini structured JSON output and automatic model fallback."""
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
            f"1. 100% COMPLETE VERBATIM SCRIPT FIDELITY (ZERO DROPPED WORDS / ZERO SUMMARIZATION):\n"
            f"   - You MUST cover the ENTIRE script from the very first word to the very last word.\n"
            f"   - DO NOT summarize, condense, rewrite, or drop ANY word or sentence from the script.\n"
            f"   - Joining the 'narration_text' of all scenes MUST reconstruct the 100% complete original script word-for-word in the original language.\n"
            f"2. STRICT SCENE DURATION & PACING (MAX 3 SECONDS PER SCENE):\n"
            f"   - CRITICAL: NO SCENE CAN EXCEED 3 SECONDS (Roughly 3 to 7 words per scene; NEVER exceed 8 words in a single scene).\n"
            f"   - Break down every sentence at commas, conjunctions ('और', 'and', 'लेकिन', 'but', etc.), and pauses.\n"
            f"   - Maximize scene count so the video receives plenty of visual cuts and images.\n"
            f"3. MULTI-ENTITY BREAKDOWN:\n"
            f"   - If a sentence lists multiple players/people/entities (e.g. 'Mohammad Siraj, Jasprit Bumrah aur Hardik Pandya'), NEVER combine them into one scene!\n"
            f"   - Split each person into their OWN separate scene with their OWN dedicated search query so that an authentic photo of each person is displayed.\n"
            f"4. VIDEO EDITOR B-ROLL & SMART QUERIES:\n"
            f"   - Think like a video editor: for individual people, query that person directly in double quotes ('\"Hardik Pandya\" cricket bowling action'). DO NOT add confusing global anchors to individual player shots!\n"
            f"   - For abstract concepts (study, research, excitement, strategy, crowd), generate rich cinematic B-roll queries ('students studying library concentration', 'cricket stadium crowd cheering floodlights').\n"
            f"   - Tailor search queries and framing for {aspect_ratio} video ({format_note}).\n"
            f"   - Use the Global Story Anchor ONLY for specific event/milestone beats where context is needed.\n"
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
                        # Apply programmatic coherence guarantee
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
                    print(f"[Director] Model {model_name} attempt {attempt + 1} notice: {err_msg[:120]}")
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
        """Calls OpenAI GPT-4o with structured JSON output."""
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
            f"DIRECTING DIRECTIVE: Analyze this full script and generate a cinematic visual storyboard.\n"
            f"1. 100% VERBATIM COVERAGE: Cover the entire script without summarizing, shortening, or omitting ANY words. Concatenating all scenes' narration_text MUST match the original script word-for-word.\n"
            f"2. STRICT MAX 3-SECOND CUTS (MAX 7-8 WORDS PER SCENE): Break down the script into fast-paced granular scenes (each <= 3 seconds, max 7-8 words) at commas, conjunctions, and pauses.\n"
            f"3. MULTI-ENTITY SEPARATION: When multiple players or entities are listed in a sentence, break each person into a separate scene so each gets an individual image cut and search query.\n"
            f"4. VIDEO EDITOR B-ROLL & SMART SEARCH QUERIES: Query individuals directly ('\"Person Name\" action') without conflicting global anchors. Use rich cinematic B-rolls for concepts/atmosphere. Only apply global anchor to overarching event beats.\n\n"
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
        """
        Lightweight, universal rule fallback for offline or zero-API-key use.
        Splits script into granular <= 3-second micro-scenes (max 7-8 words)
        with clean entity detection and editorial B-rolls.
        """
        from config import MOTION_CONFIG

        raw_units = []
        sentence_splits = re.split(r'(?<=[.!?।॥\n])\s*|\n+', script_text)
        for s in sentence_splits:
            s = s.strip()
            if not s:
                continue
            
            sub_parts = re.split(r'[,;—]|\s+(?:और|and|तथा|लेकिन|but|या|or|कि|ताकि)\s+', s)
            for sp in sub_parts:
                sp_clean = sp.strip()
                if not sp_clean:
                    continue
                words = sp_clean.split()
                if len(words) <= 8:
                    raw_units.append(sp_clean)
                else:
                    for i in range(0, len(words), 7):
                        chunk = " ".join(words[i:i + 7])
                        if chunk:
                            raw_units.append(chunk)

        sentences = [u for u in raw_units if len(u.split()) >= 1]
        if not sentences and script_text.strip():
            sentences = [script_text.strip()]

        # Extract dynamic global anchor from opening sentence / title
        all_caps = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', script_text)
        stop_words = {"The", "This", "That", "In", "On", "At", "After", "Before", "During", "When", "While", "A", "An", "With", "According", "As", "Now", "Today", "Yesterday"}
        valid_nouns = [w for w in all_caps if w not in stop_words and len(w) > 2]
        dominant_subject = valid_nouns[0] if valid_nouns else (category.title() if category != "general" else "Documentary")

        # Detect year/era if present anywhere in the script
        year_match = re.search(r'\b(18\d\d|19\d\d|20\d\d)\b', script_text)
        year_str = year_match.group(1) if year_match else ""

        global_anchor = f"{dominant_subject} {year_str}".strip()

        motion_cycles = list(MOTION_CONFIG.get("motion_styles", ["zoom_in", "pan_right", "zoom_out", "pan_left"]))
        default_trans = str(MOTION_CONFIG.get("default_transition", "crossfade"))
        default_tdur = float(MOTION_CONFIG.get("transition_duration", 0.5))

        openreel_transitions = ["crossfade", "wipe", "slide", "push", "zoom", "circleReveal", "blur", "glitch", "spin"]
        openreel_directions = ["left", "right", "up", "diagonal-tl", "diagonal-tr"]

        scenes: List[SceneData] = []
        for idx, sentence in enumerate(sentences, start=1):
            sent_year_match = re.search(r'\b(18\d\d|19\d\d|20\d\d)\b', sentence)
            sent_year = sent_year_match.group(1) if sent_year_match else year_str

            words = sentence.split()
            cap_candidates = [w for w in re.findall(r'\b[A-Z][a-z]+\b', sentence) if w not in stop_words]
            entity = cap_candidates[0] if cap_candidates else dominant_subject

            clean_words = [re.sub(r'[^\w]', '', w) for w in words if len(w) > 3][:3]
            keyword_str = " ".join(clean_words) if clean_words else "action"

            if len(cap_candidates) > 0:
                search_query = f'"{entity}" {keyword_str} photo'.strip()
            else:
                search_query = f'"{dominant_subject}" {keyword_str} {global_anchor}'.strip()

            headline_words = [w for w in words[:5] if len(w) > 1]
            headline = " ".join(headline_words).upper()

            archetypes = ["wide_environment", "character_portrait", "dynamic_action", "symbolic_metaphor", "artifact_detail"]
            v_cat = "character_portrait" if len(cap_candidates) > 0 else archetypes[(idx - 1) % len(archetypes)]
            f_point = "top_face" if v_cat == "character_portrait" else ("wide_horizon" if v_cat == "wide_environment" else "center")
            m_speed = "slow_dramatic" if idx % 3 == 0 else "fast_punch"

            # Assign genre-based layer effects
            effects = []
            if category == "sports" or m_speed == "fast_punch":
                effects = ["motion-blur"]
            elif category == "documentary" or category == "history":
                effects = ["film-grain", "vignette"]
            elif category == "tech":
                effects = ["glow"]

            chosen_trans = openreel_transitions[(idx - 1) % len(openreel_transitions)]
            chosen_dir = openreel_directions[(idx - 1) % len(openreel_directions)]

            scenes.append(SceneData(
                scene_id=idx,
                narration_text=sentence,
                primary_entity=entity,
                action=keyword_str,
                opponent_or_context=global_anchor,
                temporal_anchor=sent_year,
                visual_category=v_cat,
                focal_point=f_point,
                motion_speed=m_speed,
                chapter_marker="ACT I: THE BEGINNING" if idx == 1 else "",
                search_query=search_query,
                secondary_queries=[
                    f'"{entity}" cinematic perspective hd'.strip(),
                    f'"{entity}" close-up action'.strip()
                ],
                visual_type_preference="image",
                lower_third_headline=headline,
                category_tag=category.upper() if category and category != "general" else "DOCUMENTARY",
                motion_style=motion_cycles[(idx - 1) % len(motion_cycles)],
                transition_type=chosen_trans,
                transition_direction=chosen_dir,
                transition_duration=0.5,
                layer_effects=effects
            ))

        return scenes
