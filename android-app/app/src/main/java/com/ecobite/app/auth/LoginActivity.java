package com.ecobite.app.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;
import com.ecobite.app.MainActivity;
import com.ecobite.app.api.ApiClient;
import com.ecobite.app.api.models.AuthRequest;
import com.ecobite.app.api.models.AuthResponse;
import com.ecobite.app.databinding.ActivityLoginBinding;
import com.ecobite.app.utils.AuthManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    private ActivityLoginBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Must be called before super.onCreate() to install the splash screen
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // Skip login if already authenticated
        if (AuthManager.getInstance(this).isLoggedIn()) {
            goToMain();
            return;
        }

        binding = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        binding.btnLogin.setOnClickListener(v -> attemptLogin());
        binding.tvGoRegister.setOnClickListener(v ->
            startActivity(new Intent(this, RegisterActivity.class))
        );
    }

    private void attemptLogin() {
        String email    = binding.etEmail.getText().toString().trim();
        String password = binding.etPassword.getText().toString().trim();

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Please fill in all fields", Toast.LENGTH_SHORT).show();
            return;
        }

        setLoading(true);

        ApiClient.getService(this)
                .login(new AuthRequest(email, password))
                .enqueue(new Callback<AuthResponse>() {
                    @Override
                    public void onResponse(Call<AuthResponse> call, Response<AuthResponse> response) {
                        setLoading(false);
                        if (response.isSuccessful() && response.body() != null) {
                            AuthResponse auth = response.body();
                            AuthManager.getInstance(LoginActivity.this)
                                       .saveToken(auth.accessToken);
                            AuthManager.getInstance(LoginActivity.this)
                                       .saveUser(auth.user.id, auth.user.name, auth.user.email);
                            ApiClient.reset(); // rebuild with token
                            goToMain();
                        } else {
                            Toast.makeText(LoginActivity.this,
                                    "Invalid email or password", Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<AuthResponse> call, Throwable t) {
                        setLoading(false);
                        Toast.makeText(LoginActivity.this,
                                "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private void setLoading(boolean loading) {
        binding.btnLogin.setEnabled(!loading);
        binding.progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.btnLogin.setText(loading ? "Signing in…" : "Sign In");
    }

    private void goToMain() {
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }
}
