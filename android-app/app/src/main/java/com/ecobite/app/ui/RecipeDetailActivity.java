package com.ecobite.app.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.bumptech.glide.Glide;
import com.ecobite.app.api.ApiClient;
import com.ecobite.app.api.models.Recipe;
import com.ecobite.app.api.models.SaveRecipeBody;
import com.ecobite.app.api.models.SavedRecipeResponse;
import com.ecobite.app.databinding.ActivityRecipeDetailBinding;
import com.ecobite.app.utils.Constants;
import com.google.gson.Gson;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RecipeDetailActivity extends AppCompatActivity {

    private ActivityRecipeDetailBinding binding;
    private Recipe recipe;
    private boolean isSaved = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityRecipeDetailBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        String json = getIntent().getStringExtra(Constants.EXTRA_RECIPE_JSON);
        if (json == null) { finish(); return; }

        recipe = new Gson().fromJson(json, Recipe.class);
        bindRecipe();

        binding.btnBack.setOnClickListener(v -> finish());
        binding.btnSave.setOnClickListener(v -> toggleSave());
    }

    private void bindRecipe() {
        binding.tvName.setText(recipe.name);
        binding.tvDescription.setText(recipe.description);
        binding.tvCookTime.setText(recipe.cookTime);
        binding.tvServings.setText(recipe.servings + " servings");
        binding.tvDifficulty.setText(recipe.difficulty);

        Glide.with(this)
             .load(recipe.imageUrl)
             .centerCrop()
             .placeholder(com.ecobite.app.R.drawable.placeholder_food)
             .into(binding.ivRecipeImage);

        // Ingredients
        StringBuilder ingBuilder = new StringBuilder();
        if (recipe.ingredients != null)
            for (String ing : recipe.ingredients) ingBuilder.append("• ").append(ing).append("\n");
        binding.tvIngredients.setText(ingBuilder.toString().trim());

        // Missing ingredients
        if (recipe.missingIngredients != null && !recipe.missingIngredients.isEmpty()) {
            binding.cardMissing.setVisibility(View.VISIBLE);
            StringBuilder miss = new StringBuilder();
            for (String m : recipe.missingIngredients) miss.append("• ").append(m).append("\n");
            binding.tvMissingList.setText(miss.toString().trim());
        } else {
            binding.cardMissing.setVisibility(View.GONE);
        }

        // Instructions
        StringBuilder steps = new StringBuilder();
        if (recipe.instructions != null) {
            for (int i = 0; i < recipe.instructions.size(); i++) {
                steps.append(i + 1).append(". ").append(recipe.instructions.get(i)).append("\n\n");
            }
        }
        binding.tvInstructions.setText(steps.toString().trim());
    }

    private void toggleSave() {
        if (!isSaved) {
            ApiClient.getService(this)
                    .saveRecipe(new SaveRecipeBody(recipe))
                    .enqueue(new Callback<SavedRecipeResponse>() {
                        @Override
                        public void onResponse(Call<SavedRecipeResponse> call, Response<SavedRecipeResponse> resp) {
                            if (resp.isSuccessful()) {
                                isSaved = true;
                                binding.btnSave.setImageResource(com.ecobite.app.R.drawable.ic_heart_filled);
                                Toast.makeText(RecipeDetailActivity.this, "Recipe saved!", Toast.LENGTH_SHORT).show();
                            }
                        }

                        @Override
                        public void onFailure(Call<SavedRecipeResponse> call, Throwable t) {
                            Toast.makeText(RecipeDetailActivity.this, "Failed to save", Toast.LENGTH_SHORT).show();
                        }
                    });
        } else {
            ApiClient.getService(this)
                    .unsaveRecipe(recipe.id)
                    .enqueue(new Callback<Void>() {
                        @Override
                        public void onResponse(Call<Void> call, Response<Void> resp) {
                            isSaved = false;
                            binding.btnSave.setImageResource(com.ecobite.app.R.drawable.ic_heart_outline);
                            Toast.makeText(RecipeDetailActivity.this, "Removed from saved", Toast.LENGTH_SHORT).show();
                        }

                        @Override
                        public void onFailure(Call<Void> call, Throwable t) {
                            Toast.makeText(RecipeDetailActivity.this, "Failed to unsave", Toast.LENGTH_SHORT).show();
                        }
                    });
        }
    }
}
