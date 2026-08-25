"""
PyTorch Dataset for recipe recommendation via contrastive learning.

Each sample is a (query_ids, positive_recipe_ids, negative_recipe_ids) tuple.

Training strategy
-----------------
* For each recipe, treat its OWN ingredient list as the positive query.
* To simulate partial user input (fridge not perfectly matching recipe),
  we randomly drop 20-40 % of the recipe's ingredient tokens.
* Negatives are other randomly selected recipes from the batch.
"""

import json
import random
from pathlib import Path
from typing import List, Tuple

import torch
from torch.utils.data import Dataset

from dataset.preprocessor import Vocabulary, extract_keywords


class RecipeDataset(Dataset):
    """
    Each item returns:
        query_ids  : LongTensor  — partial ingredient token IDs (user's fridge)
        recipe_ids : LongTensor  — full ingredient token IDs of the target recipe
        label      : int         — index of the positive recipe in self.recipes
    """

    def __init__(
        self,
        recipes_path: Path,
        vocab: Vocabulary,
        max_len: int = 64,
        drop_ratio: float = 0.3,
        augment: bool = True,
    ):
        with open(recipes_path, "r", encoding="utf-8") as f:
            self.recipes: List[dict] = json.load(f)

        self.vocab = vocab
        self.max_len = max_len
        self.drop_ratio = drop_ratio
        self.augment = augment

        # Pre-encode every recipe's full ingredient list
        self.recipe_token_ids: List[List[int]] = [
            vocab.encode(r["ingredients"]) for r in self.recipes
        ]

    def __len__(self) -> int:
        return len(self.recipes)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, int]:
        full_ids = self.recipe_token_ids[idx]

        if self.augment and len(full_ids) > 2:
            # Drop a random fraction of tokens to simulate an incomplete fridge
            keep_n = max(2, int(len(full_ids) * (1.0 - self.drop_ratio)))
            query_ids = random.sample(full_ids, keep_n)
        else:
            query_ids = full_ids[:]

        return (
            self._pad(query_ids),
            self._pad(full_ids),
            idx,
        )

    def _pad(self, ids: List[int]) -> torch.Tensor:
        ids = ids[: self.max_len]
        ids = ids + [Vocabulary.PAD] * (self.max_len - len(ids))
        return torch.tensor(ids, dtype=torch.long)

    def get_recipe(self, idx: int) -> dict:
        return self.recipes[idx]


def collate_fn(
    batch: List[Tuple[torch.Tensor, torch.Tensor, int]]
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    queries, recipes, labels = zip(*batch)
    return (
        torch.stack(queries),
        torch.stack(recipes),
        torch.tensor(labels, dtype=torch.long),
    )
