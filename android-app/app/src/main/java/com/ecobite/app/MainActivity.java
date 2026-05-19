package com.ecobite.app;

import android.content.Intent;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.navigation.NavController;
import androidx.navigation.fragment.NavHostFragment;
import androidx.navigation.ui.NavigationUI;
import com.ecobite.app.auth.LoginActivity;
import com.ecobite.app.databinding.ActivityMainBinding;
import com.ecobite.app.utils.AuthManager;

public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding binding;
    private NavController navController;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        NavHostFragment navHost = (NavHostFragment) getSupportFragmentManager()
                .findFragmentById(R.id.nav_host_fragment);
        assert navHost != null;
        navController = navHost.getNavController();

        NavigationUI.setupWithNavController(binding.bottomNavigation, navController);

        // If user just registered, open profile tab first
        if (getIntent().getBooleanExtra("open_profile", false)) {
            navController.navigate(R.id.profileFragment);
        }
    }

    public void logout() {
        AuthManager.getInstance(this).logout();
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }

    public NavController getNavController() {
        return navController;
    }
}
