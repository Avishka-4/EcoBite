package com.ecobite.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import com.ecobite.app.api.ApiClient;
import com.ecobite.app.api.models.Recipe;
import com.ecobite.app.api.models.RecipeGenerateRequest;
import com.ecobite.app.api.models.SaveRecipeBody;
import com.ecobite.app.api.models.SavedRecipeResponse;
import com.ecobite.app.adapters.RecipeAdapter;
import com.ecobite.app.databinding.FragmentRecipeSuggestionsBinding;
import com.ecobite.app.utils.AuthManager;
import com.ecobite.app.utils.Constants;
import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.List;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RecipeSuggestionsFragment extends Fragment implements RecipeAdapter.OnRecipeClickListener {

    private FragmentRecipeSuggestionsBinding binding;
    private RecipeAdapter adapter;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        binding = FragmentRecipeSuggestionsBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        adapter = new RecipeAdapter(requireContext(), this);
        binding.recyclerRecipes.setLayoutManager(new LinearLayoutManager(requireContext()));
        binding.recyclerRecipes.setAdapter(adapter);

        binding.btnBack.setOnClickListener(v ->
                requireActivity().getOnBackPressedDispatcher().onBackPressed());

        ArrayList<String> ingredients = getArguments() != null
                ? getArguments().getStringArrayList("ingredients")
                : new ArrayList<>();

        if (ingredients == null || ingredients.isEmpty()) {
            showError("No ingredients provided.");
            return;
        }

        // Load existing saved IDs so hearts render correctly
        loadSavedIds();
        generateRecipes(ingredients);
    }

    private void generateRecipes(List<String> ingredients) {
        showLoading(true);

        // Use profile preferences stored locally
        String cuisine    = "Italian";   // default — overridden by backend using profile
        String experience = "beginner";

        ApiClient.getService(requireContext())
                .generateRecipes(new RecipeGenerateRequest(ingredients, cuisine, experience))
                .enqueue(new Callback<List<Recipe>>() {
                    @Override
                    public void onResponse(Call<List<Recipe>> call, Response<List<Recipe>> resp) {
                        showLoading(false);
                        if (resp.isSuccessful() && resp.body() != null) {
                            adapter.setRecipes(resp.body());
                            binding.tvSubtitle.setText(resp.body().size() + " recipes generated for you");
                        } else {
                            showError("Failed to generate recipes.");
                        }
                    }

                    @Override
                    public void onFailure(Call<List<Recipe>> call, Throwable t) {
                        showLoading(false);
                        showError("Network error: " + t.getMessage());
                    }
                });
    }

    private void loadSavedIds() {
        ApiClient.getService(requireContext())
                .getSavedRecipes()
                .enqueue(new Callback<List<SavedRecipeResponse>>() {
                    @Override
                    public void onResponse(Call<List<SavedRecipeResponse>> call,
                                           Response<List<SavedRecipeResponse>> resp) {
                        if (resp.isSuccessful() && resp.body() != null) {
                            java.util.Set<String> ids = new java.util.HashSet<>();
                            for (SavedRecipeResponse s : resp.body()) ids.add(s.recipe.id);
                            adapter.setSavedIds(ids);
                        }
                    }

                    @Override public void onFailure(Call<List<SavedRecipeResponse>> call, Throwable t) {}
                });
    }

    @Override
    public void onRecipeClick(Recipe recipe) {
        Intent intent = new Intent(requireContext(), RecipeDetailActivity.class);
        intent.putExtra(Constants.EXTRA_RECIPE_JSON, new Gson().toJson(recipe));
        startActivity(intent);
    }

    @Override
    public void onSaveToggle(Recipe recipe, boolean isSaved) {
        if (isSaved) {
            ApiClient.getService(requireContext())
                    .saveRecipe(new SaveRecipeBody(recipe))
                    .enqueue(new Callback<SavedRecipeResponse>() {
                        @Override public void onResponse(Call<SavedRecipeResponse> c, Response<SavedRecipeResponse> r) {}
                        @Override public void onFailure(Call<SavedRecipeResponse> c, Throwable t) {
                            adapter.toggleSaved(recipe.id); // revert
                            Toast.makeText(requireContext(), "Failed to save", Toast.LENGTH_SHORT).show();
                        }
                    });
        } else {
            ApiClient.getService(requireContext())
                    .unsaveRecipe(recipe.id)
                    .enqueue(new Callback<Void>() {
                        @Override public void onResponse(Call<Void> c, Response<Void> r) {}
                        @Override public void onFailure(Call<Void> c, Throwable t) {
                            adapter.toggleSaved(recipe.id);
                            Toast.makeText(requireContext(), "Failed to unsave", Toast.LENGTH_SHORT).show();
                        }
                    });
        }
    }

    private void showLoading(boolean loading) {
        binding.progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.layoutLoading.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.recyclerRecipes.setVisibility(loading ? View.GONE : View.VISIBLE);
    }

    private void showError(String msg) {
        binding.progressBar.setVisibility(View.GONE);
        binding.layoutLoading.setVisibility(View.GONE);
        Toast.makeText(requireContext(), msg, Toast.LENGTH_LONG).show();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
