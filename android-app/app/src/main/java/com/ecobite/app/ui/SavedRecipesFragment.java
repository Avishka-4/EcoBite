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
import com.ecobite.app.adapters.RecipeAdapter;
import com.ecobite.app.api.ApiClient;
import com.ecobite.app.api.models.Recipe;
import com.ecobite.app.api.models.SavedRecipeResponse;
import com.ecobite.app.databinding.FragmentSavedRecipesBinding;
import com.ecobite.app.utils.Constants;
import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.List;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class SavedRecipesFragment extends Fragment implements RecipeAdapter.OnRecipeClickListener {

    private FragmentSavedRecipesBinding binding;
    private RecipeAdapter adapter;
    private final List<Recipe> savedRecipes = new ArrayList<>();

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        binding = FragmentSavedRecipesBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        adapter = new RecipeAdapter(requireContext(), this);
        binding.recyclerSaved.setLayoutManager(new LinearLayoutManager(requireContext()));
        binding.recyclerSaved.setAdapter(adapter);

        binding.swipeRefresh.setOnRefreshListener(this::loadSaved);
        loadSaved();
    }

    @Override
    public void onResume() {
        super.onResume();
        loadSaved();
    }

    private void loadSaved() {
        binding.progressBar.setVisibility(View.VISIBLE);

        ApiClient.getService(requireContext())
                .getSavedRecipes()
                .enqueue(new Callback<List<SavedRecipeResponse>>() {
                    @Override
                    public void onResponse(Call<List<SavedRecipeResponse>> call,
                                           Response<List<SavedRecipeResponse>> resp) {
                        binding.progressBar.setVisibility(View.GONE);
                        binding.swipeRefresh.setRefreshing(false);
                        if (resp.isSuccessful() && resp.body() != null) {
                            savedRecipes.clear();
                            for (SavedRecipeResponse s : resp.body()) savedRecipes.add(s.recipe);
                            adapter.setRecipes(savedRecipes);
                            java.util.Set<String> ids = new java.util.HashSet<>();
                            for (Recipe r : savedRecipes) ids.add(r.id);
                            adapter.setSavedIds(ids);
                            binding.tvCount.setText(savedRecipes.size() + " saved " +
                                    (savedRecipes.size() == 1 ? "recipe" : "recipes"));
                            binding.tvEmpty.setVisibility(savedRecipes.isEmpty() ? View.VISIBLE : View.GONE);
                        }
                    }

                    @Override
                    public void onFailure(Call<List<SavedRecipeResponse>> call, Throwable t) {
                        binding.progressBar.setVisibility(View.GONE);
                        binding.swipeRefresh.setRefreshing(false);
                        Toast.makeText(requireContext(), "Failed to load saved recipes", Toast.LENGTH_SHORT).show();
                    }
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
        // In the saved list, toggling always means unsave
        ApiClient.getService(requireContext())
                .unsaveRecipe(recipe.id)
                .enqueue(new Callback<Void>() {
                    @Override
                    public void onResponse(Call<Void> call, Response<Void> resp) {
                        savedRecipes.removeIf(r -> r.id.equals(recipe.id));
                        adapter.setRecipes(savedRecipes);
                        binding.tvEmpty.setVisibility(savedRecipes.isEmpty() ? View.VISIBLE : View.GONE);
                        binding.tvCount.setText(savedRecipes.size() + " saved recipes");
                    }

                    @Override
                    public void onFailure(Call<Void> call, Throwable t) {
                        adapter.toggleSaved(recipe.id);
                        Toast.makeText(requireContext(), "Failed to remove", Toast.LENGTH_SHORT).show();
                    }
                });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
