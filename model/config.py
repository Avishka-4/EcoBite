"""Central configuration for the EcoBite recipe recommendation model."""

from pathlib import Path

ROOT = Path(__file__).parent

# ── Data ──────────────────────────────────────────────────────────────────────
RECIPES_JSON = ROOT / "data" / "recipes.json"
INDEX_PATH   = ROOT / "data" / "recipe_index.pt"   # pre-built embedding index
VOCAB_PATH   = ROOT / "data" / "vocab.json"

# ── Model hyperparameters ─────────────────────────────────────────────────────
EMBED_DIM    = 128
HIDDEN_DIM   = 256
NUM_HEADS    = 4
DROPOUT      = 0.1

# ── Training ──────────────────────────────────────────────────────────────────
BATCH_SIZE   = 64
EPOCHS       = 50
LR           = 3e-4
WEIGHT_DECAY = 1e-4
NEG_SAMPLES  = 7          # negatives per positive in contrastive loss
CHECKPOINT   = ROOT / "data" / "model.pt"

# ── Inference ─────────────────────────────────────────────────────────────────
TOP_K        = 5          # recipes returned per query
MIN_OVERLAP  = 0.2        # minimum ingredient overlap ratio to consider a recipe
