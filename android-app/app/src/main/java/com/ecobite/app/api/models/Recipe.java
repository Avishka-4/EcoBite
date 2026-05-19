package com.ecobite.app.api.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class Recipe {
    @SerializedName("id")                  public String       id;
    @SerializedName("name")                public String       name;
    @SerializedName("description")         public String       description;
    @SerializedName("cookTime")            public String       cookTime;
    @SerializedName("servings")            public int          servings;
    @SerializedName("difficulty")          public String       difficulty;
    @SerializedName("ingredients")         public List<String> ingredients;
    @SerializedName("missingIngredients")  public List<String> missingIngredients;
    @SerializedName("instructions")        public List<String> instructions;
    @SerializedName("imageUrl")            public String       imageUrl;
}
