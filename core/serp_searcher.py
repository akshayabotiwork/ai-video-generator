import re
from typing import List, Dict
from core.models import VisualCandidate, SceneData
from config import SERPAPI_API_KEY
from core.logger import system_logger
from core.search import (
    SearchCache,
    GoogleDirectSearcher,
    DuckDuckGoFallbackSearcher,
    SerpApiFallbackSearcher,
    WikimediaFallbackSearcher
)

# Trusted editorial, scientific, historical, and archival domains for relevance weighting
TRUSTED_EDITORIAL_DOMAINS = {
    "documentary": [
        "nationalgeographic.com", "smithsonianmag.com", "britannica.com", 
        "wikimedia.org", "wikipedia.org", "history.com", "bbc.com"
    ],
    "science": [
        "nasa.gov", "space.com", "nature.com", "scientificamerican.com", 
        "esa.int", "nationalgeographic.com", "smithsonianmag.com", "wikimedia.org"
    ],
    "nature": [
        "nationalgeographic.com", "worldwildlife.org", "smithsonianmag.com", 
        "britannica.com", "wikimedia.org", "bbc.com"
    ],
    "history": [
        "wikimedia.org", "wikipedia.org", "britannica.com", "history.com",
        "nationalgeographic.com", "smithsonianmag.com", "loc.gov", "gettyimages.com"
    ],
    "tech": [
        "theverge.com", "techcrunch.com", "wired.com", "arstechnica.com",
        "engadget.com", "cnet.com", "venturebeat.com", "bloomberg.com"
    ],
    "business": [
        "bloomberg.com", "cnbc.com", "reuters.com", "ft.com", 
        "wsj.com", "forbes.com", "economictimes.indiatimes.com", "moneycontrol.com"
    ],
    "sports": [
        "espncricinfo.com", "cricbuzz.com", "bcci.tv", "icc-cricket.com", 
        "reuters.com", "gettyimages.com", "thehindu.com", "skysports.com", "espn.com"
    ],
    "politics": [
        "reuters.com", "apnews.com", "bbc.com", "thehindu.com", 
        "indianexpress.com", "politico.com", "aljazeera.com"
    ],
    "news": [
        "reuters.com", "apnews.com", "bbc.com", "aljazeera.com", 
        "thehindu.com", "indianexpress.com", "ndtv.com", "timesofindia.indiatimes.com",
        "cnn.com", "theguardian.com", "nytimes.com", "afp.com"
    ]
}

class SerpVisualSearcher:
    """Orchestrates multi-tier visual search: Direct Google -> DuckDuckGo -> SERP API Fallback -> Wikimedia."""

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or SERPAPI_API_KEY
        self.cache = SearchCache()
        self.google_searcher = GoogleDirectSearcher()
        self.ddg_searcher = DuckDuckGoFallbackSearcher()
        self.serp_searcher = SerpApiFallbackSearcher(api_key=self.api_key)
        self.wiki_searcher = WikimediaFallbackSearcher()

    def search_for_scene(self, scene: SceneData, category: str = "news", limit: int = 10) -> List[VisualCandidate]:
        """Discovers visual assets with priority to free direct scraping, falling back to SERP API when needed."""
        query = scene.search_query.strip()
        matched_entity = scene.primary_entity or ""

        # 0. Cache check
        cached_candidates = self.cache.get(query, category)
        if cached_candidates:
            system_logger.info("SERP", f"Scene {scene.scene_id}: In-memory Cache HIT for '{query}'")
            return cached_candidates[:limit]

        candidates: List[VisualCandidate] = []

        # 1. Primary: Direct Google Images Scraping (Free & Direct)
        try:
            system_logger.info("SERP", f"Scene {scene.scene_id}: Querying Google Images directly for '{query}'...")
            google_candidates = self.google_searcher.search(query, matched_entity, limit)
            candidates.extend(google_candidates)
            system_logger.success("SERP", f"Scene {scene.scene_id}: Direct Google search found {len(google_candidates)} photos")
        except Exception as e:
            system_logger.warning("SERP", f"Scene {scene.scene_id}: Direct Google search notice: {e}")

        # 2. Secondary: Direct DuckDuckGo Images (Zero-block & Unlimited Free Backup)
        if len(candidates) < 3:
            try:
                system_logger.info("SERP", f"Scene {scene.scene_id}: Querying DuckDuckGo direct engine for '{query}'...")
                ddg_candidates = self.ddg_searcher.search(query, matched_entity, limit)
                candidates.extend(ddg_candidates)
                system_logger.success("SERP", f"Scene {scene.scene_id}: DuckDuckGo direct found {len(ddg_candidates)} photos")
            except Exception as e:
                system_logger.warning("SERP", f"Scene {scene.scene_id}: DuckDuckGo direct search notice: {e}")

        # 3. Tertiary: SERP API Fallback (Triggered only when direct results are insufficient)
        if len(candidates) < 3 and self.api_key:
            try:
                system_logger.info("SERP", f"Scene {scene.scene_id}: Triggering SERP API fallback for '{query}'...")
                serp_candidates = self.serp_searcher.search(query, matched_entity, limit)
                candidates.extend(serp_candidates)

                # Contextual secondary angles if still low results
                if len(candidates) < 3 and scene.secondary_queries:
                    for alt_q in scene.secondary_queries[:2]:
                        alt_cand = self.serp_searcher.search(alt_q, matched_entity, limit)
                        candidates.extend(alt_cand)
                        if len(candidates) >= 4:
                            break

                system_logger.success("SERP", f"Scene {scene.scene_id}: SERP API fallback retrieved {len(serp_candidates)} photos")
            except Exception as e:
                system_logger.warning("SERP", f"Scene {scene.scene_id}: SERP API fallback search failed: {e}")

        # 4. Quaternary: Public Archive Fallback (Wikimedia Commons)
        if len(candidates) < 3:
            system_logger.info("SERP", f"Scene {scene.scene_id}: Searching Wikimedia Commons archive for '{matched_entity or query}'...")
            wiki_candidates = self.wiki_searcher.search(query, matched_entity, limit)
            candidates.extend(wiki_candidates)
            system_logger.success("SERP", f"Scene {scene.scene_id}: Added {len(wiki_candidates)} verified archive visuals")

        # 5. Deduplicate and score candidates
        scored_candidates = self._rank_candidates(candidates, scene, category)
        final_results = scored_candidates[:limit]

        # Save to cache
        if final_results:
            self.cache.set(query, category, final_results)

        return final_results

    def _rank_candidates(self, candidates: List[VisualCandidate], scene: SceneData, category: str) -> List[VisualCandidate]:
        """Applies multi-factor scoring to rank image candidates prioritizing person/entity match."""
        seen_urls = set()
        unique_candidates: List[VisualCandidate] = []

        entity = (scene.primary_entity or "").strip().lower()
        quoted_match = re.search(r'"([^"]+)"', scene.search_query or "")
        quoted_entity = quoted_match.group(1).strip().lower() if quoted_match else ""
        person_keys = [e for e in [entity, quoted_entity] if len(e) > 2]

        opponent = (scene.opponent_or_context or "").strip().lower()
        year = str(scene.temporal_anchor or "").strip()
        cat = category.lower()

        trusted_domains = TRUSTED_EDITORIAL_DOMAINS.get(cat, TRUSTED_EDITORIAL_DOMAINS["news"])

        for item in candidates:
            if not item.image_url or item.image_url in seen_urls:
                continue
            seen_urls.add(item.image_url)

            score = 10.0  # Base score
            item_title = (item.title or "").lower()
            full_text = f"{item.title} {item.source} {item.link}".lower()

            # 1. Person / Entity Match (Highest Priority)
            has_person_match = False
            for p_key in person_keys:
                if p_key in item_title:
                    score += 70.0
                    has_person_match = True
                    break
                p_words = p_key.split()
                if len(p_words) > 1 and all(w in item_title for w in p_words):
                    score += 55.0
                    has_person_match = True
                    break
                if p_key in full_text:
                    score += 40.0
                    has_person_match = True
                    break
                if len(p_words) > 1 and all(w in full_text for w in p_words):
                    score += 30.0
                    has_person_match = True
                    break

            if person_keys and not has_person_match:
                score -= 25.0

            # 2. Opponent / Event / Context Match (+20 pts)
            if opponent and opponent in full_text:
                score += 20.0

            # 3. Temporal Year Match (+15 pts)
            if year and year in full_text:
                score += 15.0

            # 4. Editorial Trusted Domain Bonus (+10 pts)
            if any(domain in item.link.lower() or domain in item.source.lower() for domain in trusted_domains):
                score += 10.0

            # 5. Resolution Bonus
            if item.width and item.width >= 1080:
                score += 5.0

            # Penalties: Filter out icons, logos, cliparts
            bad_patterns = [".svg", "logo", "icon", "vector", "clipart", "avatar", "profile_picture"]
            if any(bad in item.image_url.lower() or bad in item.title.lower() for bad in bad_patterns):
                score -= 60.0

            item.relevance_score = max(score, 1.0)
            unique_candidates.append(item)

        unique_candidates.sort(key=lambda x: x.relevance_score, reverse=True)
        return unique_candidates
