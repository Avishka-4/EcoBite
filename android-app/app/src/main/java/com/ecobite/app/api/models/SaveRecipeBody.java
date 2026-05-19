package com.ecobite.app.api.models;

import com.google.gson.annotations.SerializedName;

public class SaveRecipeBody {
    @SerializedName("recipe") public Recipe recipe;
    public SaveRecipeBody(Recipe recipe) { this.recipe = recipe; }
}
