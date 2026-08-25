"""Tests for the text preprocessing module."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from preprocessing.cleaner import TextCleaner


cleaner = TextCleaner()


def test_url_removal():
    result = cleaner.clean("Check this out https://example.com/page it's cool")
    assert "https://example.com" not in result.cleaned_text
    assert "cool" in result.cleaned_text


def test_reddit_username_removal():
    result = cleaner.clean("Thanks u/SomeUser for the info")
    assert "u/SomeUser" not in result.cleaned_text
    assert "Thanks" in result.cleaned_text


def test_subreddit_mention_removal():
    result = cleaner.clean("Check r/technology for more")
    assert "r/technology" not in result.cleaned_text
    assert "Check" in result.cleaned_text


def test_markdown_bold():
    result = cleaner.clean("This is **bold** text")
    assert "**" not in result.cleaned_text
    assert "bold" in result.cleaned_text


def test_code_block_removal():
    result = cleaner.clean("Here is code ```python\nprint('hi')\n``` and more")
    assert "```" not in result.cleaned_text
    assert "more" in result.cleaned_text


def test_html_entity_decode():
    result = cleaner.clean("5 &gt; 3 &amp; 2 &lt; 4")
    assert ">" in result.cleaned_text
    assert "&" in result.cleaned_text


def test_repeated_chars():
    result = cleaner.clean("This is sooooooo amazing")
    assert "sooooooo" not in result.cleaned_text
    assert "soo" in result.cleaned_text


def test_emoji_preserved():
    result = cleaner.clean("Great work 🔥🚀")
    assert "🔥" in result.cleaned_text
    assert "🚀" in result.cleaned_text


def test_empty_input():
    result = cleaner.clean("")
    assert result.cleaned_text == ""
    assert result.original_text == ""


def test_none_input():
    result = cleaner.clean(None)
    assert result.cleaned_text == ""


def test_original_preserved():
    original = "Check https://example.com **bold** u/user 🔥"
    result = cleaner.clean(original)
    assert result.original_text == original
    assert result.original_text != result.cleaned_text


def test_excessive_punctuation():
    result = cleaner.clean("WOW!!!!!! Amazing?????")
    assert "!!!!!!" not in result.cleaned_text
    assert "!!" in result.cleaned_text


def test_batch_cleaning():
    texts = ["Hello https://x.com", "Test u/user", None, ""]
    results = cleaner.clean_batch(texts)
    assert len(results) == 4
    assert "https" not in results[0].cleaned_text
    assert results[2].cleaned_text == ""
    assert results[3].cleaned_text == ""
