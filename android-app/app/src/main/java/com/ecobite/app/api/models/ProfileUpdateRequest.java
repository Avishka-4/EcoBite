package com.ecobite.app.api.models;

import com.google.gson.annotations.SerializedName;

public class ProfileUpdateRequest {
    @SerializedName("name")               public String  name;
    @SerializedName("age")                public Integer age;
    @SerializedName("cooking_experience") public String  cookingExperience;
    @SerializedName("preferred_cuisine")  public String  preferredCuisine;
}
