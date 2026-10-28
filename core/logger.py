import time
import datetime
import threading
import logging
from typing import List, Dict, Any, Optional

class SystemLogRecord:
    def __init__(
        self,
        log_id: int,
        level: str,
        source: str,
        message: str,
        details: Optional[Any] = None,
        timestamp: Optional[str] = None
    ):
        self.id = log_id
        now = datetime.datetime.now()
        self.timestamp = timestamp or now.strftime("%H:%M:%S.") + f"{now.microsecond // 1000:03d}"
        self.iso = now.isoformat()
        self.level = level.upper()
        self.source = source.upper()
        self.message = message
        self.details = details

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "iso": self.iso,
            "level": self.level,
            "source": self.source,
            "message": self.message,
            "details": self.details
        }


class SystemLogger:
    """Thread-safe in-memory ring-buffer logger for AI News Video Arranger Studio."""

    def __init__(self, max_records: int = 3000):
        self._max_records = max_records
        self._records: List[SystemLogRecord] = []
        self._lock = threading.RLock()
        self._next_id = 1
        
        # Add initial system diagnostics
        self._bootstrap_initial_logs()

    def _bootstrap_initial_logs(self):
        self.info("SYSTEM", "AI News Video Studio Engine initialized")
        self.info("SYSTEM", "FFmpeg Single-Pass Compositor & Broadcast FX Pipeline online")
        self.info("TTS", "EdgeTTS Neural Speech Synthesis Engine ready")
        self.info("DIRECTOR", "AI Script Director & Visual Scene Segmentation ready")
        self.info("SERP", "Contextual Visual Asset Search & Validation ready")

    def log(
        self,
        level: str,
        source: str,
        message: str,
        details: Optional[Any] = None,
        custom_time: Optional[str] = None
    ) -> SystemLogRecord:
        with self._lock:
            rec = SystemLogRecord(
                log_id=self._next_id,
                level=level,
                source=source,
                message=message,
                details=details,
                timestamp=custom_time
            )
            self._next_id += 1
            self._records.append(rec)
            if len(self._records) > self._max_records:
                self._records = self._records[-self._max_records:]
            return rec

    def info(self, source: str, message: str, details: Optional[Any] = None) -> SystemLogRecord:
        return self.log("INFO", source, message, details)

    def success(self, source: str, message: str, details: Optional[Any] = None) -> SystemLogRecord:
        return self.log("SUCCESS", source, message, details)

    def warning(self, source: str, message: str, details: Optional[Any] = None) -> SystemLogRecord:
        return self.log("WARNING", source, message, details)

    def error(self, source: str, message: str, details: Optional[Any] = None) -> SystemLogRecord:
        return self.log("ERROR", source, message, details)

    def debug(self, source: str, message: str, details: Optional[Any] = None) -> SystemLogRecord:
        return self.log("DEBUG", source, message, details)

    def get_logs(
        self,
        since_id: int = 0,
        limit: int = 250,
        level: Optional[str] = None,
        source: Optional[str] = None,
        query: Optional[str] = None
    ) -> Dict[str, Any]:
        with self._lock:
            all_records = list(self._records)
            latest_id = all_records[-1].id if all_records else 0

        # Compute counts in a single fast pass outside lock
        stats = {"total": len(all_records), "info": 0, "success": 0, "warning": 0, "error": 0, "debug": 0}
        for r in all_records:
            k = r.level.lower()
            if k in stats:
                stats[k] += 1

        filtered = all_records
        if since_id > 0:
            filtered = [r for r in filtered if r.id > since_id]

        if level and level.upper() != "ALL":
            lvl_up = level.upper()
            filtered = [r for r in filtered if r.level == lvl_up]

        if source and source.upper() != "ALL":
            src_up = source.upper()
            filtered = [r for r in filtered if r.source == src_up]

        if query and query.strip():
            q = query.strip().lower()
            filtered = [
                r for r in filtered
                if q in r.message.lower() or q in r.source.lower() or (r.details and q in str(r.details).lower())
            ]

        total_filtered = len(filtered)
        sliced = filtered[-limit:] if limit > 0 else filtered

        return {
            "logs": [r.to_dict() for r in sliced],
            "total_available": total_filtered,
            "latest_id": latest_id,
            "last_id": latest_id,
            "stats": stats
        }

    def clear(self):
        with self._lock:
            self._records.clear()
            self._bootstrap_initial_logs()

    def export_text(self) -> str:
        with self._lock:
            records = list(self._records)

        lines = []
        for r in records:
            det = f" | {r.details}" if r.details else ""
            lines.append(f"[{r.timestamp}] [{r.level:<7}] [{r.source:<10}] {r.message}{det}")
        return "\n".join(lines)


# Singleton instance
system_logger = SystemLogger()


class SystemLogHandler(logging.Handler):
    """Bridges standard python logging into the system_logger while discarding polling chatter."""
    def emit(self, record: logging.LogRecord):
        try:
            msg = self.format(record)
            # Filter high frequency polling noise & static requests
            if any(term in msg for term in ("/api/system-logs", "/api/config", "/api/project-status", "/static/", "GET / ")):
                return

            lvl = "INFO"
            if record.levelno >= logging.ERROR:
                lvl = "ERROR"
            elif record.levelno >= logging.WARNING:
                lvl = "WARNING"
            elif record.levelno <= logging.DEBUG:
                lvl = "DEBUG"

            src = record.name.split(".")[-1].upper()
            if "UVICORN" in record.name.upper():
                src = "API"
            system_logger.log(lvl, src, msg)
        except Exception:
            pass


def attach_logging_handler():
    """Attaches SystemLogHandler to root and uvicorn loggers safely."""
    handler = SystemLogHandler()
    formatter = logging.Formatter("%(message)s")
    handler.setFormatter(formatter)
    
    root_log = logging.getLogger()
    # Avoid duplicate handlers on re-import
    if not any(isinstance(h, SystemLogHandler) for h in root_log.handlers):
        root_log.addHandler(handler)

