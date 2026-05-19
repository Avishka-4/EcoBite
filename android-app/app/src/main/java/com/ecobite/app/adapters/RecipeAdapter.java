package com.ecobite.app.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.bumptech.glide.Glide;
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

        h.tvName.setText(recipe.name);
        h.tvDesc.setText(recipe.description);
        h.tvTime.setText(recipe.cookTime);
        h.tvDifficulty.setText(recipe.difficulty);
        h.btnSave.setImageResource(isSaved
                ? R.drawable.ic_heart_filled
                : R.drawable.ic_heart_outline);

        // Missing ingredients badge
        if (recipe.missingIngredients != null && !recipe.missingIngredients.isEmpty()) {
            h.tvMissing.setVisibility(View.VISIBLE);
            h.tvMissing.setText("Need " + recipe.missingIngredients.size() + " more item(s)");
        } else {
            h.tvMissing.setVisibility(View.GONE);
        }

        Glide.with(context)
             .load(recipe.imageUrl)
             .centerCrop()
             .placeholder(R.drawable.placeholder_food)
             .into(h.ivImage);

        h.itemView.setOnClickListener(v -> listener.onRecipeClick(recipe));
        h.btnSave.setOnClickListener(v -> {
            toggleSaved(recipe.id);
            listener.onSaveToggle(recipe, savedIds.contains(recipe.id));
        });
    }

    @Override
    public int getItemCount() { return recipes.size(); }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivImage, btnSave;
        TextView  tvName, tvDesc, tvTime, tvDifficulty, tvMissing;

        ViewHolder(View v) {
            super(v);
            ivImage      = v.findViewById(R.id.ivRecipeImage);
            tvName       = v.findViewById(R.id.tvRecipeName);
            tvDesc       = v.findViewById(R.id.tvRecipeDesc);
            tvTime       = v.findViewById(R.id.tvCookTime);
            tvDifficulty = v.findViewById(R.id.tvDifficulty);
            tvMissing    = v.findViewById(R.id.tvMissing);
            btnSave      = v.findViewById(R.id.btnSave);
        }
    }
}
