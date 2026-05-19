package com.ecobite.app.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.ecobite.app.MainActivity;
import com.ecobite.app.api.ApiClient;
import com.ecobite.app.api.models.AuthResponse;
import com.ecobite.app.api.models.RegisterRequest;
import com.ecobite.app.databinding.ActivityRegisterBinding;
import com.ecobite.app.utils.AuthManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {

    private ActivityRegisterBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityRegisterBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        binding.btnRegister.setOnClickListener(v -> attemptRegister());
        binding.tvGoLogin.setOnClickListener(v -> finish());
    }

    private void attemptRegister() {
        String name     = binding.etName.getText().toString().trim();
        String email    = binding.etEmail.getText().toString().trim();
        String password = binding.etPassword.getText().toString().trim();

        if (name.isEmpty() || email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Please fill in all fields", Toast.LENGTH_SHORT).show();
            return;
        }
        if (password.length() < 8) {
            Toast.makeText(this, "Password must be at least 8 characters", Toast.LENGTH_SHORT).show();
            return;
        }

        setLoading(true);

        ApiClient.getService(this)
                .register(new RegisterRequest(email, password, name))
                .enqueue(new Callback<AuthResponse>() {
                    @Override
                    public void onResponse(Call<AuthResponse> call, Response<AuthResponse> response) {
                        setLoading(false);
                        if (response.isSuccessful() && response.body() != null) {
                            AuthResponse auth = response.body();
                            AuthManager.getInstance(RegisterActivity.this)
                                       .saveToken(auth.accessToken);
                            AuthManager.getInstance(RegisterActivity.this)
                                       .saveUser(auth.user.id, auth.user.name, auth.user.email);
                            ApiClient.reset();
                            Intent intent = new Intent(RegisterActivity.this, MainActivity.class);
                            intent.putExtra("open_profile", true);
                            startActivity(intent);
                            finish();
                        } else {
                            String msg = response.code() == 400
                                    ? "Email already registered" : "Registration failed";
                            Toast.makeText(RegisterActivity.this, msg, Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<AuthResponse> call, Throwable t) {
                        setLoading(false);
                        Toast.makeText(RegisterActivity.this,
                                "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private void setLoading(boolean loading) {
        binding.btnRegister.setEnabled(!loading);
        binding.progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.btnRegister.setText(loading ? "Creating account…" : "Create Account");
    }
}
