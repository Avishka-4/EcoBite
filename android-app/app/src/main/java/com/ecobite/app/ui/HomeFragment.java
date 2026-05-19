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
import com.ecobite.app.api.ApiClient;
import com.ecobite.app.api.models.IngredientDetectResponse;
import com.ecobite.app.databinding.FragmentHomeBinding;
import com.ecobite.app.utils.AuthManager;
import com.google.android.material.chip.Chip;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class HomeFragment extends Fragment {

    private static final int STATE_CHOICE      = 0;
    private static final int STATE_INGREDIENTS = 1;

    private FragmentHomeBinding binding;
    private final List<String> ingredients = new ArrayList<>();
    private int currentState = STATE_CHOICE;
    private Uri cameraImageUri;

    // ── Launchers ─────────────────────────────────────────────────────────────
    private final ActivityResultLauncher<Intent> galleryLauncher =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                Uri uri = result.getData().getData();
                if (uri != null) uploadImageForDetection(uri);
            }
        });

    private final ActivityResultLauncher<Intent> cameraLauncher =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (result.getResultCode() == Activity.RESULT_OK && cameraImageUri != null) {
                uploadImageForDetection(cameraImageUri);
            }
        });

    private final ActivityResultLauncher<String> permissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            if (granted) launchCamera();
            else openGallery();
        });

    // ── Lifecycle ─────────────────────────────────────────────────────────────
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

    // ── State management ──────────────────────────────────────────────────────
    private void showState(int state) {
        currentState = state;
        binding.layoutChoice.setVisibility(state == STATE_CHOICE ? View.VISIBLE : View.GONE);
        binding.layoutIngredients.setVisibility(state == STATE_INGREDIENTS ? View.VISIBLE : View.GONE);
    }

    private void showIngredientsState() {
        showState(STATE_INGREDIENTS);
        updateChips();
    }

    // ── Photo flow ────────────────────────────────────────────────────────────
    private void handlePhotoOption() {
        boolean hasCameraPermission = ContextCompat.checkSelfPermission(
                requireContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        if (hasCameraPermission) launchCamera();
        else permissionLauncher.launch(Manifest.permission.CAMERA);
    }

    private void launchCamera() {
        try {
            File photoFile = createImageFile();
            cameraImageUri = FileProvider.getUriForFile(
                    requireContext(),
                    requireContext().getPackageName() + ".fileprovider",
                    photoFile);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
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
        String stamp    = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        File   cacheDir = requireContext().getCacheDir();
        return File.createTempFile("IMG_" + stamp + "_", ".jpg", cacheDir);
    }

    /**
     * Uploads the captured image to the backend for YOLO ingredient detection.
     *
     * YOLO STUB: the backend currently returns random ingredients.
     * Once your YOLO model is trained and deployed on the backend, this call
     * will automatically use real predictions — no changes needed here.
     *
     * Future on-device option (TFLite):
     *   Bitmap bmp = BitmapFactory.decodeStream(getContentResolver().openInputStream(uri));
     *   List<String> detected = YoloTFLiteHelper.detect(requireContext(), bmp);
     *   setDetectedIngredients(detected, false);
     */
    private void uploadImageForDetection(Uri uri) {
        binding.progressDetect.setVisibility(View.VISIBLE);
        showState(STATE_INGREDIENTS);

        try {
            File file = createTempFileFromUri(uri);
            RequestBody  reqBody  = RequestBody.create(file, MediaType.parse("image/*"));
            MultipartBody.Part part = MultipartBody.Part.createFormData("file", file.getName(), reqBody);

            ApiClient.getService(requireContext())
                     .detectIngredients(part)
                     .enqueue(new Callback<IngredientDetectResponse>() {
                         @Override
                         public void onResponse(Call<IngredientDetectResponse> call,
                                                Response<IngredientDetectResponse> response) {
                             binding.progressDetect.setVisibility(View.GONE);
                             if (response.isSuccessful() && response.body() != null) {
                                 setDetectedIngredients(response.body().ingredients,
                                                        !response.body().modelAvailable);
                             } else {
                                 Toast.makeText(requireContext(),
                                         "Detection failed — add ingredients manually",
                                         Toast.LENGTH_SHORT).show();
                             }
                         }

                         @Override
                         public void onFailure(Call<IngredientDetectResponse> call, Throwable t) {
                             binding.progressDetect.setVisibility(View.GONE);
                             Toast.makeText(requireContext(),
                                     "Network error — add ingredients manually",
                                     Toast.LENGTH_SHORT).show();
                         }
                     });
        } catch (IOException e) {
            binding.progressDetect.setVisibility(View.GONE);
            Toast.makeText(requireContext(), "Could not read image", Toast.LENGTH_SHORT).show();
        }
    }

    private File createTempFileFromUri(Uri uri) throws IOException {
        File temp = File.createTempFile("upload_", ".jpg", requireContext().getCacheDir());
        try (var in  = requireContext().getContentResolver().openInputStream(uri);
             var out = new java.io.FileOutputStream(temp)) {
            if (in == null) throw new IOException("Cannot open URI stream");
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        }
        return temp;
    }

    private void setDetectedIngredients(List<String> detected, boolean isStub) {
        ingredients.clear();
        if (detected != null) ingredients.addAll(detected);
        updateChips();
        if (isStub) {
            Toast.makeText(requireContext(),
                    "YOLO model not trained yet — showing sample ingredients. Edit as needed.",
                    Toast.LENGTH_LONG).show();
        }
    }

    // ── Manual input ──────────────────────────────────────────────────────────
    private void addIngredientFromInput() {
        String val = binding.etIngredient.getText().toString().trim();
        if (!val.isEmpty()) {
            ingredients.add(val);
            binding.etIngredient.setText("");
            updateChips();
        }
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

    // ── Navigate ──────────────────────────────────────────────────────────────
    private void navigateToRecipes() {
        if (ingredients.isEmpty()) return;
        Bundle args = new Bundle();
        args.putStringArrayList("ingredients", new ArrayList<>(ingredients));
        Navigation.findNavController(requireView())
                  .navigate(R.id.action_home_to_suggestions, args);
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
