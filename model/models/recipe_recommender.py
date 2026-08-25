"""
RecipeRecommender — Two-Tower contrastive model for ingredient-to-recipe matching.

Two separate IngredientEncoder towers:
  • Query tower  : encodes the user's available ingredients
  • Recipe tower : encodes a recipe's required ingredients

At training time, InfoNCE (NT-Xent) loss pushes matching
(query, recipe) pairs together and mismatched pairs apart.

At inference time, all recipe embeddings are pre-computed and stored
in a flat index. A forward pass through the query tower + a dot-product
search retrieves the top-K matching recipes in milliseconds.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

from models.ingredient_encoder import IngredientEncoder


class RecipeRecommender(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        embed_dim: int = 128,
        hidden_dim: int = 256,
        num_heads: int = 4,
        dropout: float = 0.1,
    ):
        super().__init__()

        # Separate weights for query and recipe so each tower can specialise
        self.query_encoder = IngredientEncoder(
            vocab_size, embed_dim, hidden_dim, num_heads, dropout
        )
        self.recipe_encoder = IngredientEncoder(
            vocab_size, embed_dim, hidden_dim, num_heads, dropout
        )

        # Learnable temperature (log-scale for numerical stability)
        self.log_temp = nn.Parameter(torch.zeros(1))  # starts at temp=1.0

    @property
    def temperature(self) -> torch.Tensor:
        # Clamp to [0.01, 1.0] so logits don't explode
        return self.log_temp.exp().clamp(0.01, 1.0)

    def encode_query(self, query_ids: torch.Tensor) -> torch.Tensor:
        """Encode user ingredient token IDs → unit vector."""
        return self.query_encoder(query_ids)

    def encode_recipe(self, recipe_ids: torch.Tensor) -> torch.Tensor:
        """Encode recipe ingredient token IDs → unit vector."""
        return self.recipe_encoder(recipe_ids)

    def forward(
        self,
        query_ids: torch.Tensor,
        recipe_ids: torch.Tensor,
    ) -> torch.Tensor:
        """
        Args:
            query_ids  : (B, seq_len) — user's ingredient token IDs
            recipe_ids : (B, seq_len) — recipe ingredient token IDs
        Returns:
            logits : (B, B) similarity matrix scaled by temperature.
                     logits[i,j] = similarity(query_i, recipe_j)
        """
        q = self.encode_query(query_ids)    # (B, D)
        r = self.encode_recipe(recipe_ids)  # (B, D)

        # Scaled dot-product similarity matrix
        logits = (q @ r.T) / self.temperature  # (B, B)
        return logits


def infonce_loss(logits: torch.Tensor) -> torch.Tensor:
    """
    InfoNCE / NT-Xent loss.
    Diagonal of logits = positive pairs; all off-diagonal = negatives.
    """
    B = logits.size(0)
    labels = torch.arange(B, device=logits.device)
    # Symmetric loss: both query→recipe and recipe→query directions
    loss_q2r = F.cross_entropy(logits, labels)
    loss_r2q = F.cross_entropy(logits.T, labels)
    return (loss_q2r + loss_r2q) / 2
