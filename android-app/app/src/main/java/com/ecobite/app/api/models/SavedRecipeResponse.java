package com.ecobite.app.api.models;

import com.google.gson.annotations.SerializedName;

public class SavedRecipeResponse {
    @SerializedName("id")     public int    id;
    @SerializedName("recipe") public Recipe recipe;
}
