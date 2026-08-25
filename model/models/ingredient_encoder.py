"""
IngredientEncoder — encodes a variable-length set of ingredient token IDs
into a single fixed-size unit-normalized embedding vector.

Architecture
------------
  Embedding → Multi-head Self-Attention → Mean Pool → LayerNorm → Linear → L2 Norm

The self-attention allows the model to learn which ingredients are most
discriminative within a given set (e.g. "truffle" carries more signal than
"salt"), while mean pooling makes the encoder order-invariant.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class IngredientEncoder(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        embed_dim: int = 128,
        hidden_dim: int = 256,
        num_heads: int = 4,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.embed_dim = embed_dim

        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.pos_dropout = nn.Dropout(dropout)

        # Self-attention over ingredient tokens
        self.attn = nn.MultiheadAttention(
            embed_dim=embed_dim,
            num_heads=num_heads,
            dropout=dropout,
            batch_first=True,
        )
        self.norm1 = nn.LayerNorm(embed_dim)

        # Token-level feed-forward
        self.ff = nn.Sequential(
            nn.Linear(embed_dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, embed_dim),
        )
        self.norm2 = nn.LayerNorm(embed_dim)

        # Final projection to embedding space
        self.proj = nn.Linear(embed_dim, embed_dim)

    def forward(self, token_ids: torch.Tensor) -> torch.Tensor:
        """
        Args:
            token_ids: LongTensor of shape (B, seq_len)
                       Padding positions have value 0.
        Returns:
            Tensor of shape (B, embed_dim), L2-normalized.
        """
        # Build key-padding mask: True where token is PAD → ignored in attention
        pad_mask = token_ids == 0  # (B, seq_len)

        x = self.embedding(token_ids)          # (B, seq_len, embed_dim)
        x = self.pos_dropout(x)

        # Self-attention with residual
        attn_out, _ = self.attn(x, x, x, key_padding_mask=pad_mask)
        x = self.norm1(x + attn_out)

        # Feed-forward with residual
        x = self.norm2(x + self.ff(x))

        # Masked mean pool: exclude PAD positions
        mask_float = (~pad_mask).unsqueeze(-1).float()  # (B, seq_len, 1)
        x = (x * mask_float).sum(dim=1) / mask_float.sum(dim=1).clamp(min=1)

        x = self.proj(x)
        return F.normalize(x, dim=-1)  # unit sphere → cosine = dot product
