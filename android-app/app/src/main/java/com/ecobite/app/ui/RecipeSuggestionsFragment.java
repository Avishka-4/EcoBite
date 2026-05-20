package com.ecobite.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import com.ecobite.app.adapters.RecipeAdapter;
import com.ecobite.app.api.ClaudeService;
import com.ecobite.app.api.models.Recipe;
import com.ecobite.app.database.AppDatabase;
import com.ecobite.app.database.SavedRecipeEntity;
import com.ecobite.app.databinding.FragmentRecipeSuggestionsBinding;
import com.ecobite.app.utils.AuthManager;
import com.ecobite.app.utils.Constants;
import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class RecipeSuggestionsFragment extends Fragment implements RecipeAdapter.OnRecipeClickListener {

    private FragmentRecipeSuggestionsBinding binding;
    private RecipeAdapter adapter;
    private List<String> lastIngredients;
    private final ClaudeService claudeService = new ClaudeService();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

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

        binding.btnRetry.setOnClickListener(v -> {
            if (lastIngredients != null && !lastIngredients.isEmpty()) {
                loadSavedIds();
                generateRecipes(lastIngredients);
            }
        });

        lastIngredients = getArguments() != null
                ? getArguments().getStringArrayList("ingredients")
                : new ArrayList<>();

        if (lastIngredients == null || lastIngredients.isEmpty()) {
            showError("No ingredients provided.");
            return;
        }

        loadSavedIds();
        generateRecipes(lastIngredients);
    }

    private void generateRecipes(List<String> ingredients) {
        showLoading(true);
        AuthManager am = AuthManager.getInstance(requireContext());

        claudeService.generateRecipes(
                ingredients,
                am.getPreferredCuisine(),
                am.getCookingExperience(),
                new ClaudeService.RecipeCallback() {
                    @Override
                    public void onSuccess(List<Recipe> recipes) {
                        if (binding == null) return;
                        showLoading(false);
                        adapter.setRecipes(recipes);
                        binding.tvSubtitle.setText(recipes.size() + " recipes generated for you");
                        showContent();
                    }

                    @Override
                    public void onError(String message) {
                        if (binding == null) return;
                        showLoading(false);
                        showError(message);
                    }
                });
    }

    private void loadSavedIds() {
        executor.execute(() -> {
            Set<String> ids = new HashSet<>();
            for (SavedRecipeEntity e :
                    AppDatabase.getInstance(requireContext()).savedRecipeDao().getAll()) {
                ids.add(e.id);
            }
            mainHandler.post(() -> {
                if (binding != null) adapter.setSavedIds(ids);
            });
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
        executor.execute(() -> {
            if (isSaved) {
                AppDatabase.getInstance(requireContext()).savedRecipeDao()
                        .insert(SavedRecipeEntity.fromRecipe(recipe));
            } else {
                AppDatabase.getInstance(requireContext()).savedRecipeDao()
                        .deleteById(recipe.id);
            }
        });
    }

    private void showLoading(boolean loading) {
        binding.layoutLoading.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.progressBar.setVisibility(View.GONE);
        if (loading) {
            binding.layoutError.setVisibility(View.GONE);
            binding.recyclerRecipes.setVisibility(View.GONE);
        }
    }

    private void showContent() {
        binding.layoutLoading.setVisibility(View.GONE);
        binding.layoutError.setVisibility(View.GONE);
        binding.recyclerRecipes.setVisibility(View.VISIBLE);
    }

    private void showError(String msg) {
        binding.layoutLoading.setVisibility(View.GONE);
        binding.progressBar.setVisibility(View.GONE);
        binding.recyclerRecipes.setVisibility(View.GONE);
        binding.tvError.setText(msg);
        binding.layoutError.setVisibility(View.VISIBLE);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
