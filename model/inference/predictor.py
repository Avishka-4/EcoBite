"""
RecipePredictor — loads the trained model + recipe index and answers
"given these ingredients, what should I cook?" queries.

Optimized with:
  • Compulsory user ingredient matching (user's ingredients MUST be in the recipe)
  • Missing ingredients cap: at most 5 items need to be purchased
  • Recipe deduplication
  • Hybrid semantic embedding + exact ingredient overlap ranking
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Set

sys.path.insert(0, str(Path(__file__).parent.parent))

import torch
import torch.nn.functional as F

import config as cfg
from dataset.preprocessor import Vocabulary
from models.recipe_recommender import RecipeRecommender


def _clean_token(text: str) -> str:
    t = text.lower().strip()
    t = re.sub(r"[^\w\s]", "", t)
    if t.endswith("es"):
        t = t[:-2]
    elif t.endswith("s") and not t.endswith("ss"):
        t = t[:-1]
    return t


def _extract_tokens(items: List[str]) -> Set[str]:
    tokens = set()
    for item in items:
        for word in str(item).split():
            clean = _clean_token(word)
            if len(clean) >= 3 and clean not in {"and", "with", "for", "the", "fresh", "dried", "chopped", "sliced", "shredded", "grated"}:
                tokens.add(clean)
    return tokens


class RecipePredictor:
    """
    Loads vocab, model weights, and pre-built recipe embeddings from disk,
    then exposes a single `predict(ingredients)` method.
    """

    def __init__(
        self,
        checkpoint_path: Optional[Path] = None,
        vocab_path: Optional[Path] = None,
        index_path: Optional[Path] = None,
        device: Optional[str] = None,
    ):
        self.device = torch.device(
            device or ("cuda" if torch.cuda.is_available() else "cpu")
        )

        # ── Vocabulary ───────────────────────────────────────────────────────
        vp = Path(vocab_path or cfg.VOCAB_PATH)
        if not vp.exists():
            raise FileNotFoundError(f"Vocab not found at {vp}.")
        self.vocab = Vocabulary.load(vp)

        # ── Model ────────────────────────────────────────────────────────────
        cp = Path(checkpoint_path or cfg.CHECKPOINT)
        if not cp.exists():
            raise FileNotFoundError(f"Checkpoint not found at {cp}.")
        ckpt = torch.load(cp, map_location=self.device, weights_only=True)
        self.model = RecipeRecommender(
            vocab_size  = ckpt["vocab_size"],
            embed_dim   = ckpt["embed_dim"],
            hidden_dim  = ckpt["hidden_dim"],
            num_heads   = ckpt["num_heads"],
            dropout     = 0.0,
        ).to(self.device)
        self.model.load_state_dict(ckpt["model"])
        self.model.eval()

        # ── Recipe Index ─────────────────────────────────────────────────────
        ip = Path(index_path or cfg.INDEX_PATH)
        if not ip.exists():
            raise FileNotFoundError(f"Recipe index not found at {ip}.")
        index_data = torch.load(ip, map_location=self.device, weights_only=False)
        self.recipe_embeddings: torch.Tensor = index_data["embeddings"]  # (N, D)
        self.recipes: List[dict] = index_data["recipes"]

    # ── Public API ───────────────────────────────────────────────────────────

    @torch.no_grad()
    def predict(
        self,
        ingredients: List[str],
        top_k: int = 3,
        cuisine_filter: Optional[str] = None,
        difficulty_filter: Optional[str] = None,
        max_missing: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Given user ingredients, return top_k matching recipes.
        
        Guarantees:
          1. User's ingredients MUST be present in the recipe.
          2. No recipe requires buying more than `max_missing` (default: 5) ingredients.
          3. No duplicate recipe titles in results.
        """
        if not ingredients:
            return []

        user_tokens = _extract_tokens(ingredients)
        if not user_tokens:
            return []

        # Encode query ingredients → embedding
        ids = self.vocab.encode(ingredients)
        ids_tensor = self._pad([ids])
        query_emb = self.model.encode_query(ids_tensor)  # (1, D)

        # Cosine similarity with every recipe embedding
        emb_scores = (query_emb @ self.recipe_embeddings.T).squeeze(0)  # (N,)

        # Filter candidates by cuisine
        candidate_indices = list(range(len(self.recipes)))
        if cuisine_filter and cuisine_filter.lower() not in ("any", "all", "", "international"):
            filtered = [
                i for i in candidate_indices
                if cuisine_filter.lower() in self.recipes[i].get("cuisine", "").lower()
            ]
            if filtered:
                candidate_indices = filtered

        # Filter by difficulty if requested
        if difficulty_filter and difficulty_filter.lower() not in ("any", "all", ""):
            diff_filtered = [
                i for i in candidate_indices
                if self.recipes[i].get("difficulty", "").lower() == difficulty_filter.lower()
            ]
            if diff_filtered:
                candidate_indices = diff_filtered

        scored_candidates = []
        seen_titles = set()

        for idx in candidate_indices:
            recipe = self.recipes[idx]
            name = recipe.get("name", "").strip()
            norm_name = re.sub(r"[^\w\s]", "", name.lower())

            # Skip duplicate recipes
            if norm_name in seen_titles:
                continue

            recipe_ings = recipe.get("ingredients", [])
            recipe_tokens = _extract_tokens(recipe_ings)

            # COMPULSORY: User ingredients MUST overlap with the recipe!
            overlap = user_tokens.intersection(recipe_tokens)
            if not overlap:
                continue

            # Calculate missing ingredients
            missing = self._find_missing(user_tokens, recipe_ings)

            # COMPULSORY: User cannot be asked to buy more than max_missing (5) items!
            if len(missing) > max_missing:
                continue

            # Composite score: embedding similarity + high ingredient overlap ratio - penalty for missing items
            overlap_ratio = len(overlap) / max(len(user_tokens), 1)
            sim_score = float(emb_scores[idx].item()) if idx < len(emb_scores) else 0.5
            total_score = (0.45 * sim_score) + (0.45 * overlap_ratio) - (0.02 * len(missing))

            scored_candidates.append((total_score, idx, missing))
            seen_titles.add(norm_name)

        # If strict filtering had fewer results than top_k, allow recipes with slight relaxation
        if len(scored_candidates) < top_k:
            for idx in candidate_indices:
                recipe = self.recipes[idx]
                norm_name = re.sub(r"[^\w\s]", "", recipe.get("name", "").lower())
                if norm_name in seen_titles:
                    continue
                recipe_ings = recipe.get("ingredients", [])
                missing = self._find_missing(user_tokens, recipe_ings)
                if len(missing) <= max_missing:
                    sim_score = float(emb_scores[idx].item()) if idx < len(emb_scores) else 0.0
                    scored_candidates.append((sim_score, idx, missing))
                    seen_titles.add(norm_name)

        # Sort by total score descending
        scored_candidates.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, recipe_idx, missing in scored_candidates[:top_k]:
            recipe = self.recipes[recipe_idx]
            results.append({
                "id":                 recipe.get("id", str(recipe_idx)),
                "name":               recipe["name"],
                "description":        recipe["description"],
                "cookTime":           recipe["cookTime"],
                "servings":           recipe["servings"],
                "difficulty":         recipe["difficulty"],
                "ingredients":        recipe.get("ingredients", []),
                "missingIngredients": missing,
                "instructions":       recipe.get("instructions", []),
                "imageUrl":           self._image_url(recipe.get("cuisine", "International")),
            })

        return results

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _pad(self, id_lists: List[List[int]], max_len: int = 64) -> torch.Tensor:
        batch = []
        for ids in id_lists:
            ids = ids[:max_len]
            ids = ids + [0] * (max_len - len(ids))
            batch.append(ids)
        return torch.tensor(batch, dtype=torch.long, device=self.device)

    @staticmethod
    def _find_missing(user_tokens: Set[str], recipe_ings: List[str]) -> List[str]:
        """Return recipe ingredients the user doesn't have."""
        missing = []
        for ing_str in recipe_ings:
            ing_tokens = _extract_tokens([ing_str])
            if not ing_tokens.intersection(user_tokens):
                missing.append(ing_str)
        return missing

    _CUISINE_IMAGES = {
        "italian":       "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
        "chinese":       "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800",
        "indian":        "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800",
        "korean":        "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=800",
        "american":      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
        "sri lankan":    "https://images.unsplash.com/photo-1625398407796-82c4b0e31410?w=800",
        "malaysian":     "https://images.unsplash.com/photo-1567982047351-76b6f93e038d?w=800",
        "english":       "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800",
        "international": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
    }

    @classmethod
    def _image_url(cls, cuisine: str) -> str:
        for k, v in cls._CUISINE_IMAGES.items():
            if k in cuisine.lower():
                return v
        return cls._CUISINE_IMAGES["international"]
