package com.ecobite.app.utils;

import android.content.Context;
import android.content.SharedPreferences;

public class AuthManager {
    private static final String PREFS_NAME = "ecobite_prefs";
    private static final String KEY_TOKEN  = "auth_token";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_USER_NAME = "user_name";
    private static final String KEY_USER_EMAIL = "user_email";

    private static AuthManager instance;
    private final SharedPreferences prefs;

    private AuthManager(Context context) {
        prefs = context.getApplicationContext()
                       .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static synchronized AuthManager getInstance(Context context) {
        if (instance == null) instance = new AuthManager(context);
        return instance;
    }

    public void saveToken(String token) {
        prefs.edit().putString(KEY_TOKEN, token).apply();
    }

    public String getToken() {
        return prefs.getString(KEY_TOKEN, null);
    }

    public boolean isLoggedIn() {
        String token = getToken();
        return token != null && !token.isEmpty();
    }

    public void saveUser(int id, String name, String email) {
        prefs.edit()
             .putInt(KEY_USER_ID, id)
             .putString(KEY_USER_NAME, name)
             .putString(KEY_USER_EMAIL, email)
             .apply();
    }

    public String getUserName()  { return prefs.getString(KEY_USER_NAME, ""); }
    public String getUserEmail() { return prefs.getString(KEY_USER_EMAIL, ""); }
    public int    getUserId()    { return prefs.getInt(KEY_USER_ID, -1); }

    public void logout() {
        prefs.edit().clear().apply();
    }
}
