from typing import List, Optional
from core.models import VisualCandidate

class SerpApiSearcher:
    """Official Google Images visual searcher via SERP API (Guaranteed Fallback)."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    def search(self, query: str, matched_entity: str = "", limit: int = 10) -> List[VisualCandidate]:
        if not self.api_key:
            raise ValueError("SERP API Key is required for SerpApiSearcher")

        from serpapi import GoogleSearch

        params = {
            "engine": "google_images",
            "q": query,
            "tbm": "isch",
            "tbs": "isz:l,itp:photo",
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

