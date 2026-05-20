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
import com.ecobite.app.databinding.FragmentProfileBinding;
import com.ecobite.app.utils.AuthManager;

public class ProfileFragment extends Fragment {

    private FragmentProfileBinding binding;

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
        AuthManager am = AuthManager.getInstance(requireContext());
        binding.progressBar.setVisibility(View.GONE);
        binding.tvEmail.setText(am.getUserName());
        binding.etName.setText(am.getUserName());

        int age = am.getUserAge();
        binding.etAge.setText(age > 0 ? String.valueOf(age) : "");

        switch (am.getCookingExperience()) {
            case "intermediate": binding.rbIntermediate.setChecked(true); break;
            case "advanced":     binding.rbAdvanced.setChecked(true);     break;
            default:             binding.rbBeginner.setChecked(true);     break;
        }

        String cuisine = am.getPreferredCuisine();
        for (int i = 0; i < binding.chipGroupCuisine.getChildCount(); i++) {
            View chip = binding.chipGroupCuisine.getChildAt(i);
            if (chip instanceof com.google.android.material.chip.Chip) {
                com.google.android.material.chip.Chip c = (com.google.android.material.chip.Chip) chip;
                c.setChecked(cuisine.equals(c.getText().toString()));
            }
        }
    }

    private void saveProfile() {
        String name   = binding.etName.getText().toString().trim();
        String ageStr = binding.etAge.getText().toString().trim();

        if (name.isEmpty()) {
            binding.etName.setError("Name is required");
            return;
        }

        int age = ageStr.isEmpty() ? 0 : Integer.parseInt(ageStr);
        AuthManager.getInstance(requireContext())
                   .saveProfile(name, age, getSelectedExperience(), getSelectedCuisine());

        binding.tvEmail.setText(name);
        Toast.makeText(requireContext(), "Profile saved!", Toast.LENGTH_SHORT).show();
    }

    private String getSelectedExperience() {
        if (binding.rbIntermediate.isChecked()) return "intermediate";
        if (binding.rbAdvanced.isChecked())     return "advanced";
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
