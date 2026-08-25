"""
Builds and manages the ingredient vocabulary, and converts ingredient
strings (e.g. "400g chicken breast, cubed") into token IDs.
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Tuple

# Common filler words that don't identify an ingredient
_STOP_WORDS = {
    "a", "an", "the", "and", "or", "of", "with", "for", "in", "to",
    "into", "from", "fresh", "dry", "dried", "frozen", "canned",
    "large", "small", "medium", "big", "whole", "ground", "minced",
    "sliced", "diced", "chopped", "grated", "shredded", "cubed",
    "halved", "quartered", "roughly", "finely", "thinly", "thickly",
    "optional", "to", "taste", "serve", "season", "garnish", "squeeze",
}

_UNIT_PATTERN = re.compile(
    r"\b(\d+[\d./]*)\s*(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb|lbs|piece|pieces"
    r"|slice|slices|clove|cloves|bunch|handful|pinch|sprig|sprigs|can|cans"
    r"|package|pkg|strip|strips)\b",
    re.IGNORECASE,
)

_PAREN_PATTERN = re.compile(r"\(.*?\)")


def _clean_ingredient(raw: str) -> str:
    """Strip quantities, units, and noise from a raw ingredient string."""
    text = raw.lower()
    text = _PAREN_PATTERN.sub("", text)   # remove parenthetical notes
    text = _UNIT_PATTERN.sub("", text)    # remove quantities + units
    text = re.sub(r"\d+", "", text)       # remove stray numbers
    text = re.sub(r"[^a-z\s]", " ", text) # keep only letters
    tokens = [t for t in text.split() if t not in _STOP_WORDS and len(t) > 2]
    return " ".join(tokens).strip()


def extract_keywords(raw: str) -> List[str]:
    """Return cleaned keyword tokens for one ingredient string."""
    return _clean_ingredient(raw).split()


class Vocabulary:
    """Maps ingredient keyword tokens ↔ integer IDs."""

    PAD = 0   # padding
    UNK = 1   # unknown token

    def __init__(self):
        self._token2id: Dict[str, int] = {"<PAD>": self.PAD, "<UNK>": self.UNK}
        self._id2token: Dict[int, str] = {self.PAD: "<PAD>", self.UNK: "<UNK>"}

    # ── building ────────────────────────────────────────────────────────────

    def add(self, token: str) -> int:
        if token not in self._token2id:
            idx = len(self._token2id)
            self._token2id[token] = idx
            self._id2token[idx] = token
        return self._token2id[token]

    def build_from_recipes(self, recipes: List[dict]) -> None:
        for recipe in recipes:
            for ing in recipe.get("ingredients", []):
                for token in extract_keywords(ing):
                    self.add(token)

    # ── lookup ───────────────────────────────────────────────────────────────

    def __len__(self) -> int:
        return len(self._token2id)

    def token_to_id(self, token: str) -> int:
        return self._token2id.get(token, self.UNK)

    def id_to_token(self, idx: int) -> str:
        return self._id2token.get(idx, "<UNK>")

    def encode(self, ingredient_list: List[str]) -> List[int]:
        """Convert a list of raw ingredient strings into a flat token-ID list."""
        ids = []
        for ing in ingredient_list:
            for token in extract_keywords(ing):
                ids.append(self.token_to_id(token))
        return ids or [self.UNK]

    # ── persistence ──────────────────────────────────────────────────────────

    def save(self, path: Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._token2id, f, indent=2)

    @classmethod
    def load(cls, path: Path) -> "Vocabulary":
        vocab = cls()
        with open(path, "r", encoding="utf-8") as f:
            token2id = json.load(f)
        vocab._token2id = token2id
        vocab._id2token = {v: k for k, v in token2id.items()}
        return vocab


def build_vocab_from_file(recipes_path: Path) -> Vocabulary:
    with open(recipes_path, "r", encoding="utf-8") as f:
        recipes = json.load(f)
    vocab = Vocabulary()
    vocab.build_from_recipes(recipes)
    return vocab
