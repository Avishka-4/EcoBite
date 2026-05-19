package com.ecobite.app.api;

import com.ecobite.app.api.models.*;
import java.util.List;
import okhttp3.MultipartBody;
import retrofit2.Call;
import retrofit2.http.*;

public interface ApiService {

    // ── Auth ──────────────────────────────────────────────────────────────────
    @POST("auth/register")
    Call<AuthResponse> register(@Body RegisterRequest body);

    @POST("auth/login")
    Call<AuthResponse> login(@Body AuthRequest body);

    // ── Users ─────────────────────────────────────────────────────────────────
    @GET("users/me")
    Call<UserData> getMe();

    @PUT("users/me")
    Call<UserData> updateMe(@Body ProfileUpdateRequest body);

    // ── Ingredients ───────────────────────────────────────────────────────────
    /**
     * Sends an image to the backend for ingredient detection.
     *
     * YOLO STUB: the backend currently returns random sample ingredients.
     * When the YOLO model is trained, the backend service will perform real inference.
     *
     * Future on-device option (after converting model to TFLite):
     *   Place yolo_ingredients.tflite in assets/
     *   Call YoloTFLiteHelper.detect(context, bitmap) locally
     *   and skip this API call entirely.
     */
    @Multipart
    @POST("ingredients/detect")
    Call<IngredientDetectResponse> detectIngredients(@Part MultipartBody.Part file);

    // ── Recipes ───────────────────────────────────────────────────────────────
    @POST("recipes/generate")
    Call<List<Recipe>> generateRecipes(@Body RecipeGenerateRequest body);

    @GET("recipes/saved")
    Call<List<SavedRecipeResponse>> getSavedRecipes();

    @POST("recipes/saved")
    Call<SavedRecipeResponse> saveRecipe(@Body SaveRecipeBody body);

    @DELETE("recipes/saved/{recipeId}")
    Call<Void> unsaveRecipe(@Path("recipeId") String recipeId);
}
