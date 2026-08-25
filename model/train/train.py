"""
Training script for the EcoBite RecipeRecommender.

Usage (from the model/ directory):
    python -m train.train
    python -m train.train --epochs 100 --batch-size 32 --embed-dim 256
"""

import argparse
import sys
from pathlib import Path

# Allow imports from the model/ root when running as a module
sys.path.insert(0, str(Path(__file__).parent.parent))

import torch
import torch.optim as optim
from torch.utils.data import DataLoader, random_split

import config as cfg
from dataset.preprocessor import build_vocab_from_file
from dataset.recipe_dataset import RecipeDataset, collate_fn
from models.recipe_recommender import RecipeRecommender, infonce_loss


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train EcoBite recipe recommender")
    p.add_argument("--epochs",      type=int,   default=cfg.EPOCHS)
    p.add_argument("--batch-size",  type=int,   default=cfg.BATCH_SIZE)
    p.add_argument("--lr",          type=float, default=cfg.LR)
    p.add_argument("--embed-dim",   type=int,   default=cfg.EMBED_DIM)
    p.add_argument("--hidden-dim",  type=int,   default=cfg.HIDDEN_DIM)
    p.add_argument("--num-heads",   type=int,   default=cfg.NUM_HEADS)
    p.add_argument("--dropout",     type=float, default=cfg.DROPOUT)
    p.add_argument("--weight-decay",type=float, default=cfg.WEIGHT_DECAY)
    p.add_argument("--val-split",   type=float, default=0.15,
                   help="Fraction of data used for validation")
    p.add_argument("--seed",        type=int,   default=42)
    return p.parse_args()


def train_one_epoch(model, loader, optimizer, device) -> float:
    model.train()
    total_loss = 0.0
    for query_ids, recipe_ids, _ in loader:
        query_ids  = query_ids.to(device)
        recipe_ids = recipe_ids.to(device)

        logits = model(query_ids, recipe_ids)
        loss   = infonce_loss(logits)

        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        total_loss += loss.item()
    return total_loss / len(loader)


@torch.no_grad()
def evaluate(model, loader, device) -> float:
    model.eval()
    total_loss = 0.0
    correct = 0
    total   = 0
    for query_ids, recipe_ids, labels in loader:
        query_ids  = query_ids.to(device)
        recipe_ids = recipe_ids.to(device)
        labels     = labels.to(device)

        logits = model(query_ids, recipe_ids)
        loss   = infonce_loss(logits)
        total_loss += loss.item()

        # Recall@1: is the correct recipe the top-1 prediction?
        preds   = logits.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total   += labels.size(0)

    avg_loss = total_loss / len(loader)
    recall1  = correct / total if total else 0.0
    return avg_loss, recall1


def main():
    args   = parse_args()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    torch.manual_seed(args.seed)

    # ── Vocabulary ───────────────────────────────────────────────────────────
    print("Building vocabulary …")
    vocab = build_vocab_from_file(cfg.RECIPES_JSON)
    vocab.save(cfg.VOCAB_PATH)
    print(f"  Vocab size: {len(vocab)}")

    # ── Dataset ──────────────────────────────────────────────────────────────
    dataset = RecipeDataset(cfg.RECIPES_JSON, vocab, augment=True)
    val_size   = max(1, int(len(dataset) * args.val_split))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])

    # Disable augmentation for val set
    val_ds.dataset.augment = False

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=collate_fn,
        drop_last=True,    # InfoNCE needs full batches for good negatives
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        collate_fn=collate_fn,
    )

    # ── Model ────────────────────────────────────────────────────────────────
    model = RecipeRecommender(
        vocab_size  = len(vocab),
        embed_dim   = args.embed_dim,
        hidden_dim  = args.hidden_dim,
        num_heads   = args.num_heads,
        dropout     = args.dropout,
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Parameters: {total_params:,}")

    optimizer = optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=args.weight_decay,
    )
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    # ── Training loop ────────────────────────────────────────────────────────
    best_val_loss = float("inf")
    print(f"\nTraining for {args.epochs} epochs …\n")
    print(f"{'Epoch':>6}  {'Train Loss':>10}  {'Val Loss':>10}  {'Recall@1':>10}")
    print("-" * 46)

    for epoch in range(1, args.epochs + 1):
        train_loss = train_one_epoch(model, train_loader, optimizer, device)
        val_loss, recall1 = evaluate(model, val_loader, device)
        scheduler.step()

        print(f"{epoch:>6}  {train_loss:>10.4f}  {val_loss:>10.4f}  {recall1:>10.2%}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(
                {
                    "epoch":      epoch,
                    "model":      model.state_dict(),
                    "optimizer":  optimizer.state_dict(),
                    "vocab_size": len(vocab),
                    "embed_dim":  args.embed_dim,
                    "hidden_dim": args.hidden_dim,
                    "num_heads":  args.num_heads,
                    "dropout":    args.dropout,
                    "val_loss":   val_loss,
                    "recall1":    recall1,
                },
                cfg.CHECKPOINT,
            )
            print(f"         * saved best checkpoint (val_loss={val_loss:.4f})")

    print(f"\nTraining complete. Best val loss: {best_val_loss:.4f}")
    print(f"Checkpoint saved to: {cfg.CHECKPOINT}")
    print("\nNext step — build the recipe embedding index:")
    print("  python build_index.py")


if __name__ == "__main__":
    main()
