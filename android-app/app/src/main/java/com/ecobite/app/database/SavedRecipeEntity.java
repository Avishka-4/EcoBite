package com.ecobite.app.database;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;
import com.ecobite.app.api.models.Recipe;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.util.List;

@Entity(tableName = "saved_recipes")
public class SavedRecipeEntity {

    @PrimaryKey
    @NonNull
    public String id = "";
    public String name;
    public String description;
    public String cookTime;
    public int    servings;
    public String difficulty;
    public String ingredientsJson;
    public String instructionsJson;
    public long   savedAt;

    public static SavedRecipeEntity fromRecipe(Recipe recipe) {
        Gson gson = new Gson();
        SavedRecipeEntity e = new SavedRecipeEntity();
        e.id              = recipe.id != null ? recipe.id : String.valueOf(System.currentTimeMillis());
        e.name            = recipe.name;
        e.description     = recipe.description;
        e.cookTime        = recipe.cookTime;
        e.servings        = recipe.servings;
        e.difficulty      = recipe.difficulty;
        e.ingredientsJson  = gson.toJson(recipe.ingredients);
        e.instructionsJson = gson.toJson(recipe.instructions);
        e.savedAt         = System.currentTimeMillis();
        return e;
    }

    public Recipe toRecipe() {
        Gson gson = new Gson();
        Recipe r        = new Recipe();
        r.id            = this.id;
        r.name          = this.name;
        r.description   = this.description;
        r.cookTime      = this.cookTime;
        r.servings      = this.servings;
        r.difficulty    = this.difficulty;
        r.ingredients   = gson.fromJson(ingredientsJson,  new TypeToken<List<String>>(){}.getType());
        r.instructions  = gson.fromJson(instructionsJson, new TypeToken<List<String>>(){}.getType());
        return r;
    }
}
