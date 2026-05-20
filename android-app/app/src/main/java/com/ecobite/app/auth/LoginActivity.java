package com.ecobite.app.auth;

import android.content.Intent;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;
import com.ecobite.app.MainActivity;
import com.ecobite.app.databinding.ActivityLoginBinding;
import com.ecobite.app.utils.AuthManager;

public class LoginActivity extends AppCompatActivity {

    private ActivityLoginBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        if (AuthManager.getInstance(this).isLoggedIn()) {
            goToMain();
            return;
        }

        binding = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        binding.btnLogin.setOnClickListener(v -> {
            String name = binding.etName.getText().toString().trim();
            if (name.isEmpty()) {
                binding.etName.setError("Please enter your name");
                return;
            }
            AuthManager.getInstance(this).saveProfile(name, 0, "beginner", "Italian");
            goToMain();
        });
    }

    private void goToMain() {
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }
}
