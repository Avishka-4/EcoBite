package com.ecobite.app.ui;

import android.graphics.Color;
import android.graphics.Paint;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import com.ecobite.app.R;
import com.ecobite.app.api.models.Recipe;
import com.ecobite.app.database.AppDatabase;
import com.ecobite.app.database.SavedRecipeEntity;
import com.ecobite.app.databinding.ActivityRecipeDetailBinding;
import com.ecobite.app.utils.Constants;
import com.google.gson.Gson;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class RecipeDetailActivity extends AppCompatActivity {

    private ActivityRecipeDetailBinding binding;
    private Recipe recipe;
    private boolean isSaved = false;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private static final int[] HEADER_COLORS = {
        Color.parseColor("#10b981"),
        Color.parseColor("#0891b2"),
        Color.parseColor("#f59e0b"),
        Color.parseColor("#8b5cf6"),
        Color.parseColor("#ef4444"),
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityRecipeDetailBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        String json = getIntent().getStringExtra(Constants.EXTRA_RECIPE_JSON);
        if (json == null) { finish(); return; }

        recipe = new Gson().fromJson(json, Recipe.class);

        executor.execute(() -> {
            List<SavedRecipeEntity> saved = AppDatabase.getInstance(this).savedRecipeDao().getAll();
            for (SavedRecipeEntity e : saved) {
                if (e.id.equals(recipe.id)) { isSaved = true; break; }
            }
            runOnUiThread(this::updateSaveButton);
        });

        bindRecipe();
        binding.btnBack.setOnClickListener(v -> finish());
        binding.btnSave.setOnClickListener(v -> toggleSave());
    }

    private void bindRecipe() {
        // Header
        binding.headerBand.setBackgroundColor(headerColor());
        binding.tvEmoji.setText(emojiFor(recipe.name));
        binding.tvName.setText(recipe.name);

        // Stats strip
        binding.tvCookTime.setText(recipe.cookTime);
        binding.tvServings.setText(recipe.servings + " servings");
        binding.tvDifficulty.setText(recipe.difficulty);

        // Description
        binding.tvDescription.setText(recipe.description);

        // Missing ingredients card
        Set<String> missingSet = new HashSet<>();
        if (recipe.missingIngredients != null && !recipe.missingIngredients.isEmpty()) {
            missingSet.addAll(recipe.missingIngredients);
            binding.cardMissing.setVisibility(View.VISIBLE);
            StringBuilder sb = new StringBuilder();
            for (String m : recipe.missingIngredients) sb.append("• ").append(m).append("\n");
            binding.tvMissingList.setText(sb.toString().trim());
        }

        // Ingredient rows
        if (recipe.ingredients != null) {
            for (int i = 0; i < recipe.ingredients.size(); i++) {
                if (i > 0) binding.ingredientContainer.addView(divider());
                binding.ingredientContainer.addView(
                        makeIngredientRow(recipe.ingredients.get(i), missingSet));
            }
        }

        // Step rows
        if (recipe.instructions != null) {
            for (int i = 0; i < recipe.instructions.size(); i++) {
                if (i > 0) binding.stepContainer.addView(divider());
                binding.stepContainer.addView(makeStepRow(i + 1, recipe.instructions.get(i)));
            }
        }
    }

    private View makeIngredientRow(String ingredient, Set<String> missingSet) {
        View row = LayoutInflater.from(this)
                .inflate(R.layout.item_ingredient_row, binding.ingredientContainer, false);
        TextView tvCheck = row.findViewById(R.id.tvCheck);
        TextView tvIngredient = row.findViewById(R.id.tvIngredient);

        tvIngredient.setText(ingredient);

        // Highlight if this ingredient is missing
        boolean foundMissing = false;
        for (String m : missingSet) {
            if (ingredient.toLowerCase().contains(m.toLowerCase())) { foundMissing = true; break; }
        }
        final boolean missing = foundMissing;
        if (missing) {
            tvIngredient.setTextColor(Color.parseColor("#d97706"));
        }

        final boolean[] checked = {false};
        row.setOnClickListener(v -> {
            checked[0] = !checked[0];
            if (checked[0]) {
                tvCheck.setText("✓");
                tvCheck.setBackgroundResource(R.drawable.step_num_done_bg);
                tvCheck.setTextColor(Color.WHITE);
                tvIngredient.setPaintFlags(
                        tvIngredient.getPaintFlags() | Paint.STRIKE_THRU_TEXT_FLAG);
                tvIngredient.setAlpha(0.38f);
            } else {
                tvCheck.setText("");
                tvCheck.setBackgroundResource(R.drawable.step_num_bg);
                tvCheck.setTextColor(ContextCompat.getColor(this, R.color.colorPrimary));
                tvIngredient.setPaintFlags(
                        tvIngredient.getPaintFlags() & ~Paint.STRIKE_THRU_TEXT_FLAG);
                tvIngredient.setAlpha(1f);
                if (missing) tvIngredient.setTextColor(Color.parseColor("#d97706"));
                else tvIngredient.setTextColor(Color.parseColor("#1f2937"));
            }
        });

        return row;
    }

    private View makeStepRow(int num, String text) {
        View row = LayoutInflater.from(this)
                .inflate(R.layout.item_step_row, binding.stepContainer, false);
        TextView tvNum  = row.findViewById(R.id.tvStepNum);
        TextView tvText = row.findViewById(R.id.tvStepText);

        tvNum.setText(String.valueOf(num));
        tvText.setText(text);

        final boolean[] done = {false};
        row.setOnClickListener(v -> {
            done[0] = !done[0];
            if (done[0]) {
                tvNum.setText("✓");
                tvNum.setBackgroundResource(R.drawable.step_num_done_bg);
                tvNum.setTextColor(Color.WHITE);
                tvText.setAlpha(0.4f);
            } else {
                tvNum.setText(String.valueOf(num));
                tvNum.setBackgroundResource(R.drawable.step_num_bg);
                tvNum.setTextColor(ContextCompat.getColor(this, R.color.colorPrimary));
                tvText.setAlpha(1f);
            }
        });

        return row;
    }

    private View divider() {
        View v = new View(this);
        LinearLayout.LayoutParams lp =
                new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1);
        lp.setMargins(0, 0, 0, 0);
        v.setLayoutParams(lp);
        v.setBackgroundColor(Color.parseColor("#f3f4f6"));
        return v;
    }

    private void toggleSave() {
        executor.execute(() -> {
            AppDatabase db = AppDatabase.getInstance(this);
            if (isSaved) {
                db.savedRecipeDao().deleteById(recipe.id);
                isSaved = false;
            } else {
                db.savedRecipeDao().insert(SavedRecipeEntity.fromRecipe(recipe));
                isSaved = true;
            }
            runOnUiThread(() -> {
                updateSaveButton();
                Toast.makeText(this,
                        isSaved ? "Recipe saved!" : "Removed from saved",
                        Toast.LENGTH_SHORT).show();
            });
        });
    }

    private void updateSaveButton() {
        binding.btnSave.setImageResource(
                isSaved ? R.drawable.ic_heart_filled : R.drawable.ic_heart_outline);
    }

    private int headerColor() {
        int hash = recipe.name == null ? 0 : Math.abs(recipe.name.hashCode());
        return HEADER_COLORS[hash % HEADER_COLORS.length];
    }

    private static String emojiFor(String name) {
        if (name == null) return "🫕";
        String lower = name.toLowerCase();
        if (lower.contains("stir") || lower.contains("fry"))     return "🥘";
        if (lower.contains("soup"))                               return "🍲";
        if (lower.contains("scramble") || lower.contains("egg")) return "🍳";
        if (lower.contains("roast") || lower.contains("bake"))   return "🔥";
        if (lower.contains("pasta") || lower.contains("noodle")) return "🍝";
        if (lower.contains("salad"))                              return "🥗";
        if (lower.contains("sandwich") || lower.contains("wrap")) return "🥙";
        if (lower.contains("curry"))                              return "🍛";
        return "🫕";
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdown();
    }
}
