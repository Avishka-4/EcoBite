package com.ecobite.app.ui;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.ecobite.app.MainActivity;
import com.ecobite.app.api.ApiClient;
import com.ecobite.app.api.models.ProfileUpdateRequest;
import com.ecobite.app.api.models.UserData;
import com.ecobite.app.databinding.FragmentProfileBinding;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProfileFragment extends Fragment {

    private FragmentProfileBinding binding;

    private static final String[] CUISINES = {
        "Italian","Chinese","Mexican","Indian","Japanese",
        "Mediterranean","American","Thai","French","Korean"
    };

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        binding = FragmentProfileBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        binding.btnSave.setOnClickListener(v -> saveProfile());
        binding.btnLogout.setOnClickListener(v -> {
            if (requireActivity() instanceof MainActivity)
                ((MainActivity) requireActivity()).logout();
        });

        loadProfile();
    }

    private void loadProfile() {
        binding.progressBar.setVisibility(View.VISIBLE);

        ApiClient.getService(requireContext())
                .getMe()
                .enqueue(new Callback<UserData>() {
                    @Override
                    public void onResponse(Call<UserData> call, Response<UserData> resp) {
                        binding.progressBar.setVisibility(View.GONE);
                        if (resp.isSuccessful() && resp.body() != null) {
                            populateForm(resp.body());
                        }
                    }

                    @Override
                    public void onFailure(Call<UserData> call, Throwable t) {
                        binding.progressBar.setVisibility(View.GONE);
                        Toast.makeText(requireContext(), "Failed to load profile", Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private void populateForm(UserData user) {
        binding.etName.setText(user.name != null ? user.name : "");
        binding.etAge.setText(user.age != null ? String.valueOf(user.age) : "");
        binding.tvEmail.setText(user.email);

        // Experience radio
        if ("intermediate".equals(user.cookingExperience)) binding.rbIntermediate.setChecked(true);
        else if ("advanced".equals(user.cookingExperience)) binding.rbAdvanced.setChecked(true);
        else binding.rbBeginner.setChecked(true);

        // Cuisine chips
        if (user.preferredCuisine != null) {
            for (int i = 0; i < binding.chipGroupCuisine.getChildCount(); i++) {
                View chip = binding.chipGroupCuisine.getChildAt(i);
                if (chip instanceof com.google.android.material.chip.Chip) {
                    com.google.android.material.chip.Chip c = (com.google.android.material.chip.Chip) chip;
                    c.setChecked(user.preferredCuisine.equals(c.getText().toString()));
                }
            }
        }
    }

    private void saveProfile() {
        String name = binding.etName.getText().toString().trim();
        String ageStr = binding.etAge.getText().toString().trim();

        if (name.isEmpty()) {
            binding.etName.setError("Name is required");
            return;
        }

        ProfileUpdateRequest req = new ProfileUpdateRequest();
        req.name = name;
        req.age  = ageStr.isEmpty() ? null : Integer.parseInt(ageStr);
        req.cookingExperience = getSelectedExperience();
        req.preferredCuisine  = getSelectedCuisine();

        binding.btnSave.setEnabled(false);

        ApiClient.getService(requireContext())
                .updateMe(req)
                .enqueue(new Callback<UserData>() {
                    @Override
                    public void onResponse(Call<UserData> call, Response<UserData> resp) {
                        binding.btnSave.setEnabled(true);
                        if (resp.isSuccessful()) {
                            Toast.makeText(requireContext(), "Profile saved!", Toast.LENGTH_SHORT).show();
                        } else {
                            Toast.makeText(requireContext(), "Failed to save", Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<UserData> call, Throwable t) {
                        binding.btnSave.setEnabled(true);
                        Toast.makeText(requireContext(), "Network error", Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private String getSelectedExperience() {
        if (binding.rbIntermediate.isChecked()) return "intermediate";
        if (binding.rbAdvanced.isChecked()) return "advanced";
        return "beginner";
    }

    private String getSelectedCuisine() {
        for (int i = 0; i < binding.chipGroupCuisine.getChildCount(); i++) {
            View chip = binding.chipGroupCuisine.getChildAt(i);
            if (chip instanceof com.google.android.material.chip.Chip) {
                com.google.android.material.chip.Chip c = (com.google.android.material.chip.Chip) chip;
                if (c.isChecked()) return c.getText().toString();
            }
        }
        return "Italian";
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}
