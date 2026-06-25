from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC timestamp (kept tz-naive so SQLite comparisons stay consistent)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
