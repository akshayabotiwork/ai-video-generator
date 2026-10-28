import os
import re
import requests
from typing import List, Dict, Any, Optional
from core.models import VisualCandidate, SceneData
from config import SERPAPI_API_KEY
from core.logger import system_logger

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
    """Discovers and ranks contextually relevant visual assets via SERP API & curated fallbacks."""

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or SERPAPI_API_KEY

    def search_for_scene(self, scene: SceneData, category: str = "news", limit: int = 10) -> List[VisualCandidate]:
        """Searches SERP API for exact scene visuals and scores relevance."""
        candidates: List[VisualCandidate] = []

        # 1. Try SERP API if API key is provided
        if self.api_key:
            try:
                system_logger.info("SERP", f"Scene {scene.scene_id}: Querying Google Images for '{scene.search_query}'")
                candidates = self._search_serp_api(scene, category, limit)
                system_logger.success("SERP", f"Scene {scene.scene_id}: Found {len(candidates)} photos via Google Images")
            except Exception as e:
                system_logger.warning("SERP", f"Scene {scene.scene_id}: SERP API search failed for '{scene.search_query}': {e}. Using fallback archives.")
        else:
            system_logger.info("SERP", f"Scene {scene.scene_id}: SERP API key not configured. Searching Wikimedia Commons archive...")

        # 2. If SERP API returns < 3 candidates or no key, search public high-quality archives
        if len(candidates) < 3:
            if self.api_key and candidates:
                system_logger.info("SERP", f"Scene {scene.scene_id}: Expanding visuals with Wikimedia Commons archive for '{scene.primary_entity or scene.search_query}'")
            elif not self.api_key:
                system_logger.info("SERP", f"Scene {scene.scene_id}: Searching Wikimedia Commons archive for '{scene.primary_entity or scene.search_query}'")
            fallback_candidates = self._search_public_archives(scene, category, limit)
            candidates.extend(fallback_candidates)
            system_logger.success("SERP", f"Scene {scene.scene_id}: Added {len(fallback_candidates)} verified archive visuals")

        # 3. Deduplicate and score candidates
        scored_candidates = self._rank_candidates(candidates, scene, category)
        return scored_candidates[:limit]

    def _query_google_images(self, query: str, matched_entity: str, limit: int) -> List[VisualCandidate]:
        """Queries Google Images via SERP API for a specific search string."""
        from serpapi import GoogleSearch

        params = {
            "engine": "google_images",
            "q": query,
            "tbm": "isch",
            "tbs": "isz:l,itp:photo",  # Large resolution only, photo type
            "api_key": self.api_key,
            "num": limit * 2
        }

        search = GoogleSearch(params)
        results = search.get_dict()
        images_results = results.get("images_results", [])

        candidates: List[VisualCandidate] = []
        for img in images_results:
            orig_url = img.get("original") or img.get("thumbnail")
            if not orig_url:
                continue

            candidates.append(VisualCandidate(
                title=img.get("title", ""),
                source=img.get("source", ""),
                link=img.get("link", ""),
                image_url=orig_url,
                thumbnail_url=img.get("thumbnail", orig_url),
                width=img.get("original_width"),
                height=img.get("original_height"),
                matched_entity=matched_entity
            ))

        return candidates

    def _search_serp_api(self, scene: SceneData, category: str, limit: int) -> List[VisualCandidate]:
        """Queries Google Images via SERP API using scene query and fallback secondary angles."""
        candidates = self._query_google_images(scene.search_query, scene.primary_entity or "", limit)

        # If primary query returned few results, query context-anchored secondary queries
        if len(candidates) < 3 and scene.secondary_queries:
            for alt_q in scene.secondary_queries[:2]:
                try:
                    alt_candidates = self._query_google_images(alt_q, scene.primary_entity or "", limit)
                    candidates.extend(alt_candidates)
                    if len(candidates) >= 4:
                        break
                except Exception:
                    pass

        return candidates

    def _search_public_archives(self, scene: SceneData, category: str, limit: int) -> List[VisualCandidate]:
        """Queries Wikimedia Commons public sources for verified editorial imagery."""
        candidates: List[VisualCandidate] = []
        clean_query = re.sub(r'["\']', '', scene.search_query)

        # Try Wikimedia Commons API targeted by entity or key terms
        try:
            wiki_query = scene.primary_entity if scene.primary_entity else " ".join(clean_query.split()[:3])
            wiki_url = "https://commons.wikimedia.org/w/api.php"
            wiki_params = {
                "action": "query",
                "generator": "search",
                "gsrsearch": wiki_query,
                "gsrnamespace": 6,  # File namespace
                "gsrlimit": limit,
                "prop": "imageinfo",
                "iiprop": "url|size|extmetadata",
                "format": "json"
            }
            resp = requests.get(wiki_url, params=wiki_params, headers={"User-Agent": "NewsVideoGenerator/1.0"}, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                pages = data.get("query", {}).get("pages", {})
                for page_id, page_info in pages.items():
                    imageinfo = page_info.get("imageinfo", [{}])[0]
                    file_url = imageinfo.get("url")
                    if file_url and any(file_url.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                        candidates.append(VisualCandidate(
                            title=page_info.get("title", "").replace("File:", ""),
                            source="Wikimedia Commons",
                            link=imageinfo.get("descriptionurl", file_url),
                            image_url=file_url,
                            thumbnail_url=imageinfo.get("thumburl", file_url),
                            width=imageinfo.get("width"),
                            height=imageinfo.get("height"),
                            matched_entity=scene.primary_entity
                        ))
        except Exception as e:
            print(f"[SerpSearcher] Wikimedia search error: {e}")

        return candidates

    def _rank_candidates(self, candidates: List[VisualCandidate], scene: SceneData, category: str) -> List[VisualCandidate]:
        """Applies multi-factor scoring to rank image candidates prioritizing person/entity match over generic resolution."""
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
                # Exact person in photo title (Strongest indicator: photo is directly about this person)
                if p_key in item_title:
                    score += 70.0
                    has_person_match = True
                    break
                # All tokens of person in title (e.g. 'travis' and 'head')
                p_words = p_key.split()
                if len(p_words) > 1 and all(w in item_title for w in p_words):
                    score += 55.0
                    has_person_match = True
                    break
                # Exact person in description / source / URL
                if p_key in full_text:
                    score += 40.0
                    has_person_match = True
                    break
                if len(p_words) > 1 and all(w in full_text for w in p_words):
                    score += 30.0
                    has_person_match = True
                    break

            # If a specific person was targeted but no match found in this candidate, penalize
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

            # 5. Resolution Bonus (Moderate: +5 pts, never overrides person match)
            if item.width and item.width >= 1080:
                score += 5.0

            # Penalties: Filter out icons, logos, cliparts
            bad_patterns = [".svg", "logo", "icon", "vector", "clipart", "avatar", "profile_picture"]
            if any(bad in item.image_url.lower() or bad in item.title.lower() for bad in bad_patterns):
                score -= 60.0

            item.relevance_score = max(score, 1.0)
            unique_candidates.append(item)

        # Sort descending by relevance score (Best person matches first)
        unique_candidates.sort(key=lambda x: x.relevance_score, reverse=True)
        return unique_candidates
