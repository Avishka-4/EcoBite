package com.ecobite.app.api.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class RecipeGenerateRequest {
    @SerializedName("ingredients")      public List<String> ingredients;
    @SerializedName("cuisine")          public String       cuisine;
    @SerializedName("experience_level") public String       experienceLevel;
    @SerializedName("count")            public int          count;

    public RecipeGenerateRequest(List<String> ingredients, String cuisine, String experienceLevel) {
        this.ingredients     = ingredients;
        this.cuisine         = cuisine;
        this.experienceLevel = experienceLevel;
        this.count           = 3;
    }
}
