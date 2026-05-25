package com.ecobite.app.adapters;

import android.content.Context;
import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.ecobite.app.R;
import com.ecobite.app.api.models.Recipe;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class RecipeAdapter extends RecyclerView.Adapter<RecipeAdapter.ViewHolder> {

    public interface OnRecipeClickListener {
        void onRecipeClick(Recipe recipe);
        void onSaveToggle(Recipe recipe, boolean isSaved);
    }

    private static final int[] HEADER_COLORS = {
        Color.parseColor("#10b981"),
        Color.parseColor("#0891b2"),
        Color.parseColor("#f59e0b"),
        Color.parseColor("#8b5cf6"),
        Color.parseColor("#ef4444"),
    };

    private final List<Recipe> recipes = new ArrayList<>();
    private final Set<String>  savedIds = new HashSet<>();
    private final OnRecipeClickListener listener;
    private final Context context;

    public RecipeAdapter(Context context, OnRecipeClickListener listener) {
        this.context  = context;
        this.listener = listener;
    }

    public void setRecipes(List<Recipe> data) {
        recipes.clear();
        recipes.addAll(data);
        notifyDataSetChanged();
    }

    public void setSavedIds(Set<String> ids) {
        savedIds.clear();
        savedIds.addAll(ids);
        notifyDataSetChanged();
    }

    public void toggleSaved(String recipeId) {
        if (savedIds.contains(recipeId)) savedIds.remove(recipeId);
        else savedIds.add(recipeId);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View v = LayoutInflater.from(context).inflate(R.layout.item_recipe, parent, false);
        return new ViewHolder(v);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder h, int position) {
        Recipe recipe = recipes.get(position);
        boolean isSaved = savedIds.contains(recipe.id);

        h.headerBand.setBackgroundColor(HEADER_COLORS[position % HEADER_COLORS.length]);
        h.tvEmoji.setText(emojiFor(recipe.name));
        h.tvName.setText(recipe.name);
        h.tvDesc.setText(recipe.description);
        h.tvTime.setText(recipe.cookTime);
        h.tvServings.setText(recipe.servings + " servings");
        h.tvDifficulty.setText(recipe.difficulty);
        h.btnSave.setImageResource(isSaved
                ? R.drawable.ic_heart_filled
                : R.drawable.ic_heart_outline);

        if (recipe.missingIngredients != null && !recipe.missingIngredients.isEmpty()) {
            h.layoutMissing.setVisibility(View.VISIBLE);
            h.tvMissing.setText("Need " + recipe.missingIngredients.size()
                    + " more item(s): " + String.join(", ", recipe.missingIngredients));
        } else {
            h.layoutMissing.setVisibility(View.GONE);
        }

        h.itemView.setOnClickListener(v -> listener.onRecipeClick(recipe));
        h.btnSave.setOnClickListener(v -> {
            toggleSaved(recipe.id);
            listener.onSaveToggle(recipe, savedIds.contains(recipe.id));
        });
    }

    @Override
    public int getItemCount() { return recipes.size(); }

    private static String emojiFor(String name) {
        if (name == null) return "🫕";
        String lower = name.toLowerCase();
        if (lower.contains("stir") || lower.contains("fry"))  return "🥘";
        if (lower.contains("soup"))                            return "🍲";
        if (lower.contains("scramble") || lower.contains("egg")) return "🍳";
        if (lower.contains("roast") || lower.contains("bake")) return "🔥";
        if (lower.contains("pasta") || lower.contains("noodle")) return "🍝";
        if (lower.contains("salad"))                           return "🥗";
        if (lower.contains("sandwich") || lower.contains("wrap")) return "🥙";
        if (lower.contains("curry"))                           return "🍛";
        return "🫕";
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        View        headerBand;
        ImageButton btnSave;
        TextView    tvEmoji, tvName, tvDesc, tvTime, tvServings, tvDifficulty, tvMissing;
        LinearLayout layoutMissing;

        ViewHolder(View v) {
            super(v);
            headerBand    = v.findViewById(R.id.headerBand);
            tvEmoji       = v.findViewById(R.id.tvEmoji);
            btnSave       = v.findViewById(R.id.btnSave);
            tvName        = v.findViewById(R.id.tvRecipeName);
            tvDesc        = v.findViewById(R.id.tvRecipeDesc);
            tvTime        = v.findViewById(R.id.tvCookTime);
            tvServings    = v.findViewById(R.id.tvServings);
            tvDifficulty  = v.findViewById(R.id.tvDifficulty);
            layoutMissing = v.findViewById(R.id.layoutMissing);
            tvMissing     = v.findViewById(R.id.tvMissing);
        }
    }
}
