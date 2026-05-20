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
import com.ecobite.app.api.models.Recipe;
import com.ecobite.app.database.AppDatabase;
import com.ecobite.app.database.SavedRecipeEntity;
import com.ecobite.app.databinding.FragmentSavedRecipesBinding;
import com.ecobite.app.utils.Constants;
import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SavedRecipesFragment extends Fragment implements RecipeAdapter.OnRecipeClickListener {

    private FragmentSavedRecipesBinding binding;
    private RecipeAdapter adapter;
    private final List<Recipe> savedRecipes = new ArrayList<>();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

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
        if (binding == null) return;
        binding.progressBar.setVisibility(View.VISIBLE);

        executor.execute(() -> {
            List<SavedRecipeEntity> entities =
                    AppDatabase.getInstance(requireContext()).savedRecipeDao().getAll();

            List<Recipe> recipes = new ArrayList<>();
            for (SavedRecipeEntity e : entities) recipes.add(e.toRecipe());

            mainHandler.post(() -> {
                if (binding == null) return;
                binding.progressBar.setVisibility(View.GONE);
                binding.swipeRefresh.setRefreshing(false);

                savedRecipes.clear();
                savedRecipes.addAll(recipes);
                adapter.setRecipes(savedRecipes);

                Set<String> ids = new HashSet<>();
                for (Recipe r : savedRecipes) ids.add(r.id);
                adapter.setSavedIds(ids);

                binding.tvCount.setText(savedRecipes.size() + " saved "
                        + (savedRecipes.size() == 1 ? "recipe" : "recipes"));
                binding.tvEmpty.setVisibility(savedRecipes.isEmpty() ? View.VISIBLE : View.GONE);
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
        // In saved list, toggling always means unsave
        executor.execute(() -> {
            AppDatabase.getInstance(requireContext()).savedRecipeDao().deleteById(recipe.id);
            mainHandler.post(() -> {
                if (binding == null) return;
                savedRecipes.removeIf(r -> r.id.equals(recipe.id));
                adapter.setRecipes(savedRecipes);
                binding.tvEmpty.setVisibility(savedRecipes.isEmpty() ? View.VISIBLE : View.GONE);
                binding.tvCount.setText(savedRecipes.size() + " saved recipes");
            });
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
