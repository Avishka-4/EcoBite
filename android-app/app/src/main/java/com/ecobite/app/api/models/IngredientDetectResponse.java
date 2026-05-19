package com.ecobite.app.api.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class IngredientDetectResponse {
    @SerializedName("ingredients")     public List<String> ingredients;
    @SerializedName("confidence")      public float        confidence;
    @SerializedName("model_available") public boolean      modelAvailable;
}
