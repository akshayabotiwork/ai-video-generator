import re
import random
import requests
from typing import List, Set
from core.models import VisualCandidate

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15"
]

class GoogleDirectSearcher:
    """Directly scrapes Google Images without API keys using anti-block headers and CDN extraction."""

    BASE_URL = "https://www.google.com/search"

    @staticmethod
    def _get_stealth_headers() -> dict:
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.google.com/",
            "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1"
        }

    def _extract_script_images(self, html: str, query: str, matched_entity: str, seen: Set[str], limit: int) -> List[VisualCandidate]:
        """Extracts high-resolution publisher image links from Google's AF_initDataCallback payload."""
        results: List[VisualCandidate] = []
        pattern = r'\["(https?://(?!www\.gstatic|encrypted-tbn|www\.google)[^"\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^"\\]*)?)",\s*(\d+),\s*(\d+)\]'
        matches = re.findall(pattern, html, re.IGNORECASE)

        for img_url, h, w in matches:
            clean_url = img_url.replace("\\u003d", "=").replace("\\u0026", "&").replace("\\", "")
            if clean_url in seen or any(bad in clean_url.lower() for bad in ["google.com", "gstatic.com", "schema.org"]):
                continue
            seen.add(clean_url)
            results.append(VisualCandidate(
                title=f"{query} ({matched_entity})".strip(),
                source="Google Direct",
                link=clean_url,
                image_url=clean_url,
                thumbnail_url=clean_url,
                width=int(w) if str(w).isdigit() else None,
                height=int(h) if str(h).isdigit() else None,
                matched_entity=matched_entity
            ))
            if len(results) >= limit:
                break
        return results

    def _extract_cdn_thumbnails(self, html: str, query: str, matched_entity: str, seen: Set[str], limit: int) -> List[VisualCandidate]:
        """Extracts fast, reliable encrypted-tbn gstatic thumbnail images."""
        results: List[VisualCandidate] = []
        pattern = r'https?://encrypted-tbn\d\.gstatic\.com/images\?q=tbn:[^"&\\\'\s<>]+'
        matches = re.findall(pattern, html)

        for tbn in matches:
            clean_tbn = tbn.replace("\\u003d", "=").replace("\\u0026", "&").replace("\\", "")
            if clean_tbn in seen:
                continue
            seen.add(clean_tbn)
            results.append(VisualCandidate(
                title=f"{query} ({matched_entity})".strip(),
                source="Google CDN",
                link=clean_tbn,
                image_url=clean_tbn,
                thumbnail_url=clean_tbn,
                matched_entity=matched_entity
            ))
            if len(results) >= limit:
                break
        return results

    def search(self, query: str, matched_entity: str = "", limit: int = 10) -> List[VisualCandidate]:
        params = {
            "q": query,
            "tbm": "isch",
            "hl": "en",
            "gl": "us",
            "source": "lnms"
        }

        resp = requests.get(self.BASE_URL, params=params, headers=self._get_stealth_headers(), timeout=6)
        if resp.status_code != 200 or "sorry/index" in resp.url or "captcha" in resp.text.lower():
            raise RuntimeError(f"Google direct rate-limited or captcha (HTTP {resp.status_code})")

        seen: Set[str] = set()
        candidates: List[VisualCandidate] = []

        # 1. Script high-res images
        candidates.extend(self._extract_script_images(resp.text, query, matched_entity, seen, limit))

        # 2. CDN thumbnails to fill the remaining requirement
        if len(candidates) < limit:
            remaining = (limit * 2) - len(candidates)
            candidates.extend(self._extract_cdn_thumbnails(resp.text, query, matched_entity, seen, remaining))

        if not candidates:
            raise RuntimeError("No direct Google images parsed")

        return candidates

