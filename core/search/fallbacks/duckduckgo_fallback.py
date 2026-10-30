import re
import random
import requests
from typing import List
from core.models import VisualCandidate

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0"
]

class DuckDuckGoFallbackSearcher:
    """
    Search Fallback Tier 1: DuckDuckGo Direct
    Triggered when Google Direct returns < 3 candidates or is temporarily rate-limited.
    Requires no API keys and does not block IP addresses.
    """

    TOKEN_URL = "https://duckduckgo.com/"
    HTML_URL = "https://html.duckduckgo.com/html/"
    API_URL = "https://duckduckgo.com/i.js"

    def _get_vqd_token(self, session: requests.Session, query: str) -> str:
        res = session.get(self.TOKEN_URL, params={"q": query}, timeout=5)
        match = re.search(r'vqd=([\d-]+)', res.text)
        if not match:
            res = session.get(self.HTML_URL, params={"q": query}, timeout=5)
            match = re.search(r'vqd=([\d-]+)', res.text)
        if not match:
            raise RuntimeError("Could not retrieve DuckDuckGo session token")
        return match.group(1)

    def search(self, query: str, matched_entity: str = "", limit: int = 10) -> List[VisualCandidate]:
        session = requests.Session()
        session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://duckduckgo.com/",
        })

        vqd = self._get_vqd_token(session, query)
        params = {
            "l": "us-en",
            "o": "json",
            "q": query,
            "vqd": vqd,
            "f": ",,,",
            "p": "1"
        }

        res = session.get(self.API_URL, params=params, timeout=6)
        if res.status_code != 200:
            raise RuntimeError(f"DuckDuckGo API responded with status {res.status_code}")

        data = res.json()
        results = data.get("results", [])
        candidates: List[VisualCandidate] = []

        for item in results:
            img_url = item.get("image")
            if not img_url or not img_url.startswith("http"):
                continue

            candidates.append(VisualCandidate(
                title=item.get("title", f"{query} photo"),
                source=item.get("source", "Web"),
                link=item.get("url", img_url),
                image_url=img_url,
                thumbnail_url=item.get("thumbnail") or img_url,
                width=item.get("width"),
                height=item.get("height"),
                matched_entity=matched_entity
            ))

            if len(candidates) >= limit * 2:
                break

        return candidates

# Backward-compatibility alias
DuckDuckGoDirectSearcher = DuckDuckGoFallbackSearcher

