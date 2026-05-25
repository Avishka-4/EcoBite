package com.ecobite.app.ui;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;
import com.ecobite.app.R;
import com.ecobite.app.databinding.FragmentHomeBinding;
import com.ecobite.app.utils.AuthManager;
import com.google.android.material.chip.Chip;
import com.google.gson.Gson;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class HomeFragment extends Fragment {

    private static final int STATE_CHOICE      = 0;
    private static final int STATE_INGREDIENTS = 1;

    private FragmentHomeBinding binding;
    private final List<String> ingredients = new ArrayList<>();
    private int currentState = STATE_CHOICE;

    private final ActivityResultLauncher<Intent> galleryLauncher =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (result.getResultCode() == Activity.RESULT_OK) {
                // No backend detection — just switch to manual input
                showIngredientsState();
                Toast.makeText(requireContext(),
                        "AI detection not available offline — add ingredients manually",
                        Toast.LENGTH_LONG).show();
            }
        });

    private final ActivityResultLauncher<Intent> cameraLauncher =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (result.getResultCode() == Activity.RESULT_OK) {
                showIngredientsState();
                Toast.makeText(requireContext(),
                        "AI detection not available offline — add ingredients manually",
                        Toast.LENGTH_LONG).show();
            }
        });

    private final ActivityResultLauncher<String> permissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            if (granted) launchCamera();
            else openGallery();
        });

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        binding = FragmentHomeBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        String name = AuthManager.getInstance(requireContext()).getUserName();
        binding.tvGreeting.setText("Hi " + (name.isEmpty() ? "there" : name) + "! 👋");

        binding.cardPhoto.setOnClickListener(v -> handlePhotoOption());
        binding.cardManual.setOnClickListener(v -> showIngredientsState());

        binding.btnAddIngredient.setOnClickListener(v -> addIngredientFromInput());
        binding.btnGenerate.setOnClickListener(v -> navigateToRecipes());

        showState(STATE_CHOICE);
    }

    private void showState(int state) {
        currentState = state;
        binding.layoutChoice.setVisibility(state == STATE_CHOICE ? View.VISIBLE : View.GONE);
        binding.layoutIngredients.setVisibility(state == STATE_INGREDIENTS ? View.VISIBLE : View.GONE);
    }

    private void showIngredientsState() {
        showState(STATE_INGREDIENTS);
        updateChips();
    }

    private void handlePhotoOption() {
        boolean hasCameraPermission = ContextCompat.checkSelfPermission(
                requireContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        if (hasCameraPermission) launchCamera();
        else permissionLauncher.launch(Manifest.permission.CAMERA);
    }

    private void launchCamera() {
        try {
            File photoFile = createImageFile();
            Uri uri = FileProvider.getUriForFile(
                    requireContext(),
                    requireContext().getPackageName() + ".fileprovider",
                    photoFile);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            cameraLauncher.launch(intent);
        } catch (IOException e) {
            openGallery();
        }
    }

    private void openGallery() {
        Intent intent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
        galleryLauncher.launch(intent);
    }

    private File createImageFile() throws IOException {
        String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        return File.createTempFile("IMG_" + stamp + "_", ".jpg", requireContext().getCacheDir());
    }

    private void addIngredientFromInput() {
        String name = binding.etIngredient.getText().toString().trim();
        if (name.isEmpty()) return;

        String quantity = binding.etQuantity.getText().toString().trim();
        String condition = getSelectedCondition();

        StringBuilder formatted = new StringBuilder();
        if (!quantity.isEmpty()) formatted.append(quantity).append(" ");
        formatted.append(name);
        if (condition != null) formatted.append(" (").append(condition).append(")");

        ingredients.add(formatted.toString());

        binding.etIngredient.setText("");
        binding.etQuantity.setText("");
        binding.chipGroupCondition.clearCheck();
        updateChips();
    }

    private String getSelectedCondition() {
        for (int i = 0; i < binding.chipGroupCondition.getChildCount(); i++) {
            View child = binding.chipGroupCondition.getChildAt(i);
            if (child instanceof Chip && ((Chip) child).isChecked()) {
                return ((Chip) child).getText().toString();
            }
        }
        return null;
    }

    private void updateChips() {
        binding.chipGroupIngredients.removeAllViews();
        for (int i = 0; i < ingredients.size(); i++) {
            final int idx = i;
            Chip chip = new Chip(requireContext());
            chip.setText(ingredients.get(i));
            chip.setCloseIconVisible(true);
            chip.setCheckable(false);
            chip.setChipBackgroundColorResource(R.color.colorChipBg);
            chip.setOnCloseIconClickListener(v -> {
                ingredients.remove(idx);
                updateChips();
            });
            binding.chipGroupIngredients.addView(chip);
        }
        binding.btnGenerate.setVisibility(ingredients.isEmpty() ? View.GONE : View.VISIBLE);
    }

    private void navigateToRecipes() {
        if (ingredients.isEmpty()) return;
        Bundle args = new Bundle();
        args.putString("ingredients", new Gson().toJson(ingredients));
        Navigation.findNavController(requireView())
                  .navigate(R.id.action_home_to_suggestions, args);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
