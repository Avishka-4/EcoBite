package com.ecobite.app.utils;

import android.os.Build;

public class Constants {
    // ── Backend URL ───────────────────────────────────────────────────────────
    // 10.0.2.2 routes to your PC's localhost when running on the Android emulator.
    // On a physical device replace PHYSICAL_DEVICE_IP with your PC's LAN IP
    // (find it with `ipconfig` on Windows — look for IPv4 under your Wi-Fi adapter).
    private static final String EMULATOR_URL      = "http://10.0.2.2:8000/api/v1/";
    private static final String PHYSICAL_DEVICE_IP = "192.168.1.100"; // ← change this
    private static final String PHYSICAL_URL       = "http://" + PHYSICAL_DEVICE_IP + ":8000/api/v1/";

    public static final String BASE_URL = isEmulator() ? EMULATOR_URL : PHYSICAL_URL;

    private static boolean isEmulator() {
        return Build.FINGERPRINT.startsWith("generic")
            || Build.FINGERPRINT.startsWith("unknown")
            || Build.MODEL.contains("google_sdk")
            || Build.MODEL.contains("Emulator")
            || Build.MODEL.contains("Android SDK built for x86")
            || Build.MANUFACTURER.contains("Genymotion")
            || (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"))
            || "google_sdk".equals(Build.PRODUCT);
    }

    public static final String EXTRA_RECIPE_JSON = "recipe_json";
    public static final String EXTRA_INGREDIENTS  = "ingredients";
}
