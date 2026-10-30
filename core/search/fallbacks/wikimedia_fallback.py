import re
import requests
from typing import List
from core.models import VisualCandidate

class WikimediaFallbackSearcher:
    """
    Search Fallback Tier 3: Wikimedia Commons Public Archives
    Triggered when web searches yield fewer than 3 verified photos.
    Queries Wikimedia Commons API for editorial, scientific, and historical imagery.
    """

    API_URL = "https://commons.wikimedia.org/w/api.php"

    def search(self, query: str, matched_entity: str = "", limit: int = 10) -> List[VisualCandidate]:
        candidates: List[VisualCandidate] = []
        clean_query = re.sub(r'["\']', '', query)
        target_term = matched_entity if matched_entity else " ".join(clean_query.split()[:3])

        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": target_term,
            "gsrnamespace": 6,  # File namespace
            "gsrlimit": limit,
            "prop": "imageinfo",
            "iiprop": "url|size|extmetadata",
            "format": "json"
        }

        try:
            resp = requests.get(
                self.API_URL,
                params=params,
                headers={"User-Agent": "NewsVideoGenerator/1.0"},
                timeout=6
            )
            if resp.status_code == 200:
                data = resp.json()
                pages = data.get("query", {}).get("pages", {})
                for _, page_info in pages.items():
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
                            matched_entity=matched_entity
                        ))
        except Exception:
            pass

        return candidates

# Backward-compatibility alias
WikimediaSearcher = WikimediaFallbackSearcher

