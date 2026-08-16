"""Load and fill prompt templates from the prompts/ directory."""

from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent


def render(name: str, **kwargs) -> str:
    """Load prompts/<name>.txt and substitute {placeholders}."""
    path = PROMPTS_DIR / f"{name}.txt"
    template = path.read_text(encoding="utf-8")
    return template.format(**kwargs).strip()
