package com.ecobite.app.ui;

import android.animation.ObjectAnimator;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import com.ecobite.app.adapters.RecipeAdapter;
import com.ecobite.app.api.ClaudeService;
import com.ecobite.app.api.MockDataService;
import com.ecobite.app.api.models.Recipe;
import com.ecobite.app.database.AppDatabase;
import com.ecobite.app.database.SavedRecipeEntity;
import com.ecobite.app.databinding.FragmentRecipeSuggestionsBinding;
import com.ecobite.app.utils.AuthManager;
import com.ecobite.app.utils.Constants;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class RecipeSuggestionsFragment extends Fragment implements RecipeAdapter.OnRecipeClickListener {

    // Set to false to use the real Claude API instead
    private static final boolean MOCK_MODE = true;

    private FragmentRecipeSuggestionsBinding binding;
    private RecipeAdapter adapter;
    private List<String> lastIngredients;
    private final ClaudeService claudeService = new ClaudeService();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private ObjectAnimator lidAnimator;
    private Runnable dotRunnable;
    private int dotStep = 0;

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
            if (lastIngredients != null) {
                loadSavedIds();
                loadRecipes(lastIngredients);
            }
        });

        if (getArguments() != null) {
            String json = getArguments().getString("ingredients");
            if (json != null && !json.isEmpty()) {
                try {
                    Type type = new TypeToken<List<String>>(){}.getType();
                    lastIngredients = new Gson().fromJson(json, type);
                } catch (Exception e) {
                    lastIngredients = new ArrayList<>();
                }
            }
        }
        if (lastIngredients == null) lastIngredients = new ArrayList<>();

        if (!MOCK_MODE && lastIngredients.isEmpty()) {
            showError("No ingredients provided.");
            return;
        }

        loadSavedIds();
        loadRecipes(lastIngredients);
    }

    private void loadRecipes(List<String> ingredients) {
        if (MOCK_MODE) {
            generateMockRecipes(ingredients);
        } else {
            generateRecipes(ingredients);
        }
    }

    private void generateMockRecipes(List<String> ingredients) {
        showLoading(true);
        mainHandler.postDelayed(() -> {
            if (binding == null) return;
            try {
                List<Recipe> recipes = MockDataService.getMockRecipes(
                        ingredients != null ? ingredients : new ArrayList<>());
                adapter.setRecipes(recipes);
                binding.tvSubtitle.setText(recipes.size() + " recipes generated for you");
                showLoading(false);
                showContent();
            } catch (Exception e) {
                showLoading(false);
                showError("Could not load recipes. Please try again.");
            }
        }, 1200);
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

    private void startLoadingAnimation() {
        binding.rowStep1.setAlpha(0f);
        binding.rowStep2.setAlpha(0f);
        binding.rowStep3.setAlpha(0f);
        binding.rowStep1.animate().alpha(1f).setDuration(400).setStartDelay(300).start();
        binding.rowStep2.animate().alpha(1f).setDuration(400).setStartDelay(700).start();
        binding.rowStep3.animate().alpha(1f).setDuration(400).setStartDelay(1100).start();

        float upPx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 12,
                getResources().getDisplayMetrics());
        lidAnimator = ObjectAnimator.ofFloat(binding.ivPotLid, "translationY", 0f, -upPx);
        lidAnimator.setDuration(600);
        lidAnimator.setRepeatCount(ObjectAnimator.INFINITE);
        lidAnimator.setRepeatMode(ObjectAnimator.REVERSE);
        lidAnimator.setInterpolator(new AccelerateDecelerateInterpolator());
        lidAnimator.start();

        dotStep = 0;
        dotRunnable = new Runnable() {
            @Override public void run() {
                if (binding == null) return;
                String[] dots = {"•", "••", "•••"};
                binding.tvLoadingDots.setText(dots[dotStep % 3]);
                dotStep++;
                mainHandler.postDelayed(this, 500);
            }
        };
        mainHandler.postDelayed(dotRunnable, 500);
    }

    private void stopLoadingAnimation() {
        if (lidAnimator != null) {
            lidAnimator.cancel();
            lidAnimator = null;
        }
        if (dotRunnable != null) {
            mainHandler.removeCallbacks(dotRunnable);
            dotRunnable = null;
        }
    }

    private void showLoading(boolean loading) {
        binding.layoutLoading.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.progressBar.setVisibility(View.GONE);
        if (loading) {
            binding.layoutError.setVisibility(View.GONE);
            binding.recyclerRecipes.setVisibility(View.GONE);
            startLoadingAnimation();
        } else {
            stopLoadingAnimation();
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
