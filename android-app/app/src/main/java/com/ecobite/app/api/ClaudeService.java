package com.ecobite.app.api;

import android.os.Handler;
import android.os.Looper;
import com.ecobite.app.BuildConfig;
import com.ecobite.app.api.models.Recipe;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.reflect.TypeToken;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class ClaudeService {

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL   = "claude-haiku-4-5-20251001";
    private static final MediaType JSON  = MediaType.parse("application/json; charset=utf-8");

    private final OkHttpClient client;
    private final Gson         gson;
    private final Handler      mainHandler = new Handler(Looper.getMainLooper());

    public interface RecipeCallback {
        void onSuccess(List<Recipe> recipes);
        void onError(String message);
    }

    public ClaudeService() {
        client = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .build();
        gson = new Gson();
    }

    public void generateRecipes(List<String> ingredients, String cuisine,
                                String experience, RecipeCallback callback) {
        String ingredientList = String.join(", ", ingredients);

        String prompt = "You are a recipe assistant. Generate exactly 3 recipes using these ingredients: "
                + ingredientList + ".\n\n"
                + "User prefers " + cuisine + " cuisine. Cooking experience: " + experience + ".\n\n"
                + "Return ONLY a valid JSON array (no markdown, no extra text). Each item must have:\n"
                + "{\n"
                + "  \"id\": \"r1\",\n"
                + "  \"name\": \"Recipe Name\",\n"
                + "  \"description\": \"One sentence description\",\n"
                + "  \"cookTime\": \"25 minutes\",\n"
                + "  \"servings\": 2,\n"
                + "  \"difficulty\": \"Easy\",\n"
                + "  \"ingredients\": [\"200g flour\", \"2 eggs\"],\n"
                + "  \"missingIngredients\": [],\n"
                + "  \"instructions\": [\"Step 1: ...\", \"Step 2: ...\"],\n"
                + "  \"imageUrl\": null\n"
                + "}\n"
                + "Use ids r1, r2, r3.";

        JsonObject message = new JsonObject();
        message.addProperty("role", "user");
        message.addProperty("content", prompt);

        JsonArray messages = new JsonArray();
        messages.add(message);

        JsonObject body = new JsonObject();
        body.addProperty("model", MODEL);
        body.addProperty("max_tokens", 2048);
        body.add("messages", messages);

        Request request = new Request.Builder()
                .url(API_URL)
                .addHeader("x-api-key", BuildConfig.CLAUDE_API_KEY)
                .addHeader("anthropic-version", "2023-06-01")
                .post(RequestBody.create(body.toString(), JSON))
                .build();

        client.newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(okhttp3.Call call, IOException e) {
                mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
            }

            @Override
            public void onResponse(okhttp3.Call call, Response response) throws IOException {
                try {
                    String responseBody = response.body() != null ? response.body().string() : "";
                    if (!response.isSuccessful()) {
                        mainHandler.post(() -> callback.onError("API error " + response.code()
                                + ". Check your API key in local.properties."));
                        return;
                    }
                    JsonObject json = JsonParser.parseString(responseBody).getAsJsonObject();
                    String text = json.getAsJsonArray("content")
                            .get(0).getAsJsonObject()
                            .get("text").getAsString().trim();

                    // Strip accidental markdown fences
                    if (text.startsWith("```")) {
                        text = text.replaceAll("(?s)```[a-z]*\\n?", "").replace("```", "").trim();
                    }

                    List<Recipe> recipes = gson.fromJson(text,
                            new TypeToken<List<Recipe>>(){}.getType());
                    mainHandler.post(() -> callback.onSuccess(recipes));
                } catch (Exception e) {
                    mainHandler.post(() -> callback.onError("Could not parse recipes. Please try again."));
                }
            }
        });
    }
}
