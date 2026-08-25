"""
ingest_kaggle.py — Convert the Kaggle "Extended Recipes Dataset (64K Dishes)"
into the EcoBite model/data/recipes.json format.

Usage
-----
Run ingestion pointing to your CSV:
    python model/scripts/ingest_kaggle.py --csv "C:/Users/CNN COMPUTERS/Downloads/64k foods/recipes_extended.csv"

Options:
    --all-cuisines    Keep all recipes regardless of cuisine (default filters to EcoBite's 8 target cuisines)
    --limit N         Only ingest the first N matching recipes

Output
------
Writes: model/data/recipes.json (ready for build_index.py and model server)
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

# ── Target Cuisines ────────────────────────────────────────────────────────────
CUISINE_MAP: Dict[str, str] = {
    "sri lankan": "Sri Lankan",
    "sri_lankan": "Sri Lankan",
    "srilankan":  "Sri Lankan",
    "indian":     "Indian",
    "korean":     "Korean",
    "chinese":    "Chinese",
    "malaysian":  "Malaysian",
    "english":    "English",
    "british":    "English",
    "american":   "American",
    "italian":    "Italian",
}

# ── Column name candidates ────────────────────────────────────────────────────
TITLE_COLS    = ["recipe_title", "title", "name", "recipe_name", "dish_name", "RecipeName"]
ING_COLS      = ["ingredients_canonical", "ingredients", "Ingredients", "NER", "ingredient_list", "ingredients_raw"]
STEPS_COLS    = ["directions", "steps", "instructions", "Instructions", "directions_raw"]
CUISINE_COLS  = ["cuisine_list", "cuisine", "Cuisine", "category", "Category"]
TIME_COLS     = ["est_cook_time_min", "cook_time", "CookTime", "TotalTime", "total_time", "time"]
SERVINGS_COLS = ["servings", "Servings", "yield", "Yield"]
DESC_COLS     = ["description", "Description", "summary", "Summary"]


def _find_col(df_cols: List[str], candidates: List[str]) -> Optional[str]:
    for c in candidates:
        if c in df_cols:
            return c
    return None


def _parse_list(raw: Any) -> List[str]:
    """Parse list stored as JSON string, python literal, or delimited string."""
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    if not isinstance(raw, str) or not raw.strip():
        return []
    s = raw.strip()
    try:
        parsed = json.loads(s)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
    except Exception:
        pass
    try:
        parsed = ast.literal_eval(s)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
    except Exception:
        pass
    for sep in ["\n", "|", ";"]:
        if sep in s:
            return [x.strip() for x in s.split(sep) if x.strip()]
    return [s] if s else []


def _extract_cuisine(raw_val: Any) -> Optional[str]:
    """Extract and normalize cuisine from single value or JSON list."""
    if not raw_val or str(raw_val).strip() in ("", "nan", "None"):
        return None
    raw_str = str(raw_val).lower().strip()
    
    # If it's a list string (e.g. ["american", "asian", "korean"])
    items = _parse_list(raw_str)
    if not items:
        items = [raw_str]
        
    for item in items:
        item_lower = item.lower().strip()
        for key, norm in CUISINE_MAP.items():
            if key in item_lower:
                return norm
    return None


def _clean_time(raw: Any) -> str:
    """Format cook time to clean string e.g. '25 min'."""
    if not raw or str(raw).strip() in ("", "nan", "None"):
        return "30 min"
    s = str(raw).strip()
    try:
        mins = int(float(s))
        return f"{mins} min" if mins > 0 else "25 min"
    except ValueError:
        pass
    match = re.search(r"(\d+)\s*(?:min|minute|hr|hour)", s, re.IGNORECASE)
    if match:
        return s
    return f"{s} min" if s.isdigit() else "30 min"


def _difficulty(steps_count: int, raw_diff: Optional[str] = None) -> str:
    if raw_diff and str(raw_diff).strip().capitalize() in ("Easy", "Medium", "Hard"):
        return str(raw_diff).strip().capitalize()
    if steps_count <= 3:
        return "Easy"
    if steps_count <= 6:
        return "Medium"
    return "Hard"


def ingest(csv_path: Path, filter_cuisines: bool = True, limit: Optional[int] = None):
    try:
        import pandas as pd
    except ImportError:
        raise SystemExit("pandas is required: pip install pandas")

    print(f"==================================================")
    print(f"Reading dataset: {csv_path}")
    print(f"==================================================")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"Raw rows in dataset: {len(df):,}")

    cols = list(df.columns)
    title_col    = _find_col(cols, TITLE_COLS)
    ing_col      = _find_col(cols, ING_COLS)
    steps_col    = _find_col(cols, STEPS_COLS)
    cuisine_col  = _find_col(cols, CUISINE_COLS)
    time_col     = _find_col(cols, TIME_COLS)
    servings_col = _find_col(cols, SERVINGS_COLS)
    desc_col     = _find_col(cols, DESC_COLS)
    diff_col     = _find_col(cols, ["difficulty", "Difficulty"])

    print(f"Detected columns:")
    print(f"  • Title:       {title_col}")
    print(f"  • Ingredients: {ing_col}")
    print(f"  • Steps:       {steps_col}")
    print(f"  • Cuisine:     {cuisine_col}")
    print(f"  • Time:        {time_col}")

    if not title_col or not ing_col or not steps_col:
        raise SystemExit("Error: Missing required columns in CSV (title/ingredients/directions).")

    recipes: List[Dict[str, Any]] = []
    skipped = 0

    for idx, row in df.iterrows():
        if limit and len(recipes) >= limit:
            break

        title = str(row[title_col]).strip()
        if not title or title.lower() in ("nan", "none", ""):
            skipped += 1
            continue

        ingredients = _parse_list(row[ing_col])
        steps = _parse_list(row[steps_col])
        if not ingredients or not steps or len(ingredients) < 2:
            skipped += 1
            continue

        cuisine = _extract_cuisine(row[cuisine_col]) if cuisine_col else None
        if filter_cuisines and not cuisine:
            skipped += 1
            continue

        servings = 4
        if servings_col and str(row[servings_col]) not in ("nan", "", "None"):
            try:
                servings = max(1, min(int(float(row[servings_col])), 16))
            except Exception:
                servings = 4

        cook_time = _clean_time(row[time_col]) if time_col else "30 min"
        desc = str(row[desc_col]).strip() if desc_col and str(row[desc_col]) not in ("nan", "None", "") else f"A delicious {cuisine or ''} {title} recipe."

        diff_raw = str(row[diff_col]).strip() if diff_col else None

        recipes.append({
            "id":           str(uuid.uuid4()),
            "name":         title,
            "description":  desc,
            "cookTime":     cook_time,
            "servings":     servings,
            "difficulty":   _difficulty(len(steps), diff_raw),
            "ingredients":  ingredients,
            "instructions": steps,
            "cuisine":      cuisine or "International",
        })

    print(f"\nIngestion Complete:")
    print(f"  • Ingested recipes: {len(recipes):,}")
    print(f"  • Filtered/Skipped: {skipped:,}")

    from collections import Counter
    counts = Counter(r["cuisine"] for r in recipes)
    print("\nRecipes per Target Cuisine:")
    for c_name, cnt in sorted(counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  • {c_name:16s}: {cnt:>6,} recipes")

    out_path = Path(__file__).parent.parent / "data" / "recipes.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(recipes, f, indent=2, ensure_ascii=False)

    print(f"\nSuccessfully wrote recipes to: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Ingest Kaggle recipe dataset into EcoBite")
    parser.add_argument("--csv", type=Path, required=True, help="Path to recipes CSV")
    parser.add_argument("--all-cuisines", action="store_true", help="Keep all cuisines without filtering")
    parser.add_argument("--limit", type=int, default=None, help="Max recipes limit")
    args = parser.parse_args()

    if not args.csv.exists():
        raise SystemExit(f"File not found: {args.csv}")

    ingest(
        csv_path=args.csv,
        filter_cuisines=not args.all_cuisines,
        limit=args.limit,
    )


if __name__ == "__main__":
    main()
