import time
from typing import Dict, List, Optional, Any
from core.models import VisualCandidate

class SearchCache:
    """In-memory cache for search queries with optional TTL to prevent redundant web calls."""

    def __init__(self, ttl_seconds: int = 86400):  # Default: 24 hours
        self.ttl = ttl_seconds
        self._store: Dict[str, Dict[str, Any]] = {}

    def _normalize_key(self, query: str, category: str = "") -> str:
        return f"{query.strip().lower()}::{category.strip().lower()}"

    def get(self, query: str, category: str = "") -> Optional[List[VisualCandidate]]:
        key = self._normalize_key(query, category)
        entry = self._store.get(key)
        if not entry:
            return None
        if time.time() - entry["timestamp"] > self.ttl:
            del self._store[key]
            return None
        return entry["results"]

    def set(self, query: str, category: str, results: List[VisualCandidate]) -> None:
        key = self._normalize_key(query, category)
        self._store[key] = {
            "timestamp": time.time(),
            "results": results
        }

    def clear(self) -> None:
        self._store.clear()

