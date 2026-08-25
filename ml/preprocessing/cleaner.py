"""
Reddit-aware text cleaner.

Handles URLs, Reddit usernames (u/…), subreddit mentions (r/…),
markdown formatting, HTML entities, code blocks, quoted text,
excessive characters, and whitespace — while preserving emojis
and enough context for downstream NLP models.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass


@dataclass
class CleanedText:
    original_text: str
    cleaned_text: str


class TextCleaner:
    """Stateless text cleaner.  Thread-safe, no model to load."""

    # ── Compiled patterns (class-level, compiled once) ────────────

    _URL_RE = re.compile(
        r"https?://\S+|www\.\S+", re.IGNORECASE
    )
    _REDDIT_USER_RE = re.compile(r"/?u/[A-Za-z0-9_-]+")
    _SUBREDDIT_RE = re.compile(r"/?r/[A-Za-z0-9_]+")
    _CODE_BLOCK_RE = re.compile(r"```[\s\S]*?```|`[^`]+`")
    _QUOTE_RE = re.compile(r"^>.*$", re.MULTILINE)
    _MARKDOWN_BOLD_ITALIC_RE = re.compile(r"[*_]{1,3}(.+?)[*_]{1,3}")
    _MARKDOWN_STRIKE_RE = re.compile(r"~~(.+?)~~")
    _MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
    _MARKDOWN_HEADER_RE = re.compile(r"^#{1,6}\s*", re.MULTILINE)
    _HTML_TAG_RE = re.compile(r"<[^>]+>")
    _REPEATED_CHAR_RE = re.compile(r"(.)\1{3,}")  # 4+ repeated chars
    _MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")
    _MULTI_NEWLINE_RE = re.compile(r"\n{3,}")
    _MULTI_PUNCT_RE = re.compile(r"([!?.]){3,}")

    def clean(self, text: str | None) -> CleanedText:
        """Return a ``CleanedText`` with both original and cleaned text."""
        if not text or not text.strip():
            return CleanedText(original_text=text or "", cleaned_text="")

        original = text
        t = text

        # 1. Decode HTML entities  (&amp; → &, etc.)
        t = html.unescape(t)

        # 2. Remove code blocks (preserve surrounding text)
        t = self._CODE_BLOCK_RE.sub(" ", t)

        # 3. Remove block quotes  (lines starting with >)
        t = self._QUOTE_RE.sub("", t)

        # 4. Strip HTML tags
        t = self._HTML_TAG_RE.sub("", t)

        # 5. Remove URLs
        t = self._URL_RE.sub("", t)

        # 6. Handle Reddit-specific mentions
        #    We strip them so the model doesn't get confused by u/someone
        t = self._REDDIT_USER_RE.sub("", t)
        t = self._SUBREDDIT_RE.sub("", t)

        # 7. Markdown → plain text
        t = self._MARKDOWN_LINK_RE.sub(r"\1", t)       # [text](url) → text
        t = self._MARKDOWN_BOLD_ITALIC_RE.sub(r"\1", t) # **bold** → bold
        t = self._MARKDOWN_STRIKE_RE.sub(r"\1", t)      # ~~strike~~ → strike
        t = self._MARKDOWN_HEADER_RE.sub("", t)          # ### Header → Header

        # 8. Reduce repeated characters  (heeeeello → heello)
        t = self._REPEATED_CHAR_RE.sub(r"\1\1", t)

        # 9. Reduce excessive punctuation  (!!!!! → !!)
        t = self._MULTI_PUNCT_RE.sub(r"\1\1", t)

        # 10. Normalise whitespace
        t = self._MULTI_NEWLINE_RE.sub("\n", t)
        t = self._MULTI_SPACE_RE.sub(" ", t)
        t = t.strip()

        return CleanedText(original_text=original, cleaned_text=t)

    def clean_batch(self, texts: list[str | None]) -> list[CleanedText]:
        """Clean a list of texts."""
        return [self.clean(t) for t in texts]
