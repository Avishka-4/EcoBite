package com.ecobite.app.utils;

import android.content.Context;
import android.content.SharedPreferences;

public class AuthManager {

    private static final String PREFS_NAME     = "ecobite_prefs";
    private static final String KEY_NAME       = "user_name";
    private static final String KEY_AGE        = "user_age";
    private static final String KEY_EXPERIENCE = "cooking_experience";
    private static final String KEY_CUISINE    = "preferred_cuisine";
    private static final String KEY_TOKEN      = "auth_token";
    private static final String KEY_USER_ID    = "user_id";
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

    /** True if the user has completed the name-setup screen. */
    public boolean isLoggedIn() {
        String name = prefs.getString(KEY_NAME, "");
        return name != null && !name.trim().isEmpty();
    }

    public void saveProfile(String name, int age, String experience, String cuisine) {
        prefs.edit()
             .putString(KEY_NAME, name)
             .putInt(KEY_AGE, age)
             .putString(KEY_EXPERIENCE, experience)
             .putString(KEY_CUISINE, cuisine)
             .apply();
    }

    public String getUserName()          { return prefs.getString(KEY_NAME, ""); }
    public int    getUserAge()           { return prefs.getInt(KEY_AGE, 0); }
    public String getCookingExperience() { return prefs.getString(KEY_EXPERIENCE, "beginner"); }
    public String getPreferredCuisine()  { return prefs.getString(KEY_CUISINE, "Italian"); }

    public void saveToken(String token) {
        prefs.edit().putString(KEY_TOKEN, token).apply();
    }

    public String getToken() {
        return prefs.getString(KEY_TOKEN, null);
    }

    public void saveUser(int id, String name, String email) {
        prefs.edit()
             .putInt(KEY_USER_ID, id)
             .putString(KEY_NAME, name)
             .putString(KEY_USER_EMAIL, email)
             .apply();
    }

    public int    getUserId()    { return prefs.getInt(KEY_USER_ID, -1); }
    public String getUserEmail() { return prefs.getString(KEY_USER_EMAIL, ""); }

    public void logout() {
        prefs.edit().clear().apply();
    }
}
