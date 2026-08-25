"""
build_index.py — Pre-compute and cache recipe embeddings.

Run this AFTER training:
    python build_index.py          (from model/ directory)

Produces: model/data/recipe_index.pt
The index is loaded at startup by RecipePredictor for fast inference.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import torch

import config as cfg
from dataset.preprocessor import Vocabulary
from models.recipe_recommender import RecipeRecommender


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # ── Load vocab ────────────────────────────────────────────────────────────
    if not cfg.VOCAB_PATH.exists():
        print(f"ERROR: vocab not found at {cfg.VOCAB_PATH}")
        print("Run training first:  python -m train.train")
        sys.exit(1)
    vocab = Vocabulary.load(cfg.VOCAB_PATH)
    print(f"Vocab size: {len(vocab)}")

    # ── Load model ────────────────────────────────────────────────────────────
    if not cfg.CHECKPOINT.exists():
        print(f"ERROR: checkpoint not found at {cfg.CHECKPOINT}")
        print("Run training first:  python -m train.train")
        sys.exit(1)
    ckpt = torch.load(cfg.CHECKPOINT, map_location=device, weights_only=True)
    model = RecipeRecommender(
        vocab_size  = ckpt["vocab_size"],
        embed_dim   = ckpt["embed_dim"],
        hidden_dim  = ckpt["hidden_dim"],
        num_heads   = ckpt["num_heads"],
        dropout     = 0.0,
    ).to(device)
    model.load_state_dict(ckpt["model"])
    model.eval()
    print(f"Model loaded (epoch {ckpt['epoch']}, val_loss={ckpt['val_loss']:.4f})")

    # ── Load recipes ──────────────────────────────────────────────────────────
    with open(cfg.RECIPES_JSON, "r", encoding="utf-8") as f:
        recipes = json.load(f)
    print(f"Recipes: {len(recipes)}")

    # ── Encode all recipes ────────────────────────────────────────────────────
    embeddings = []
    MAX_LEN = 64

    with torch.no_grad():
        for recipe in recipes:
            ids = vocab.encode(recipe["ingredients"])
            ids = ids[:MAX_LEN]
            ids = ids + [0] * (MAX_LEN - len(ids))
            tensor = torch.tensor([ids], dtype=torch.long, device=device)
            emb = model.encode_recipe(tensor)  # (1, D)
            embeddings.append(emb.squeeze(0))

    emb_matrix = torch.stack(embeddings)  # (N, D)
    print(f"Embedding matrix shape: {emb_matrix.shape}")

    # ── Save index ────────────────────────────────────────────────────────────
    cfg.INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"embeddings": emb_matrix.cpu(), "recipes": recipes}, cfg.INDEX_PATH)
    print(f"\nIndex saved to: {cfg.INDEX_PATH}")
    print("\nYou can now start the model server:")
    print("  python serve.py")


if __name__ == "__main__":
    main()
