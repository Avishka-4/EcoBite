package com.ecobite.app.api.models;

import com.google.gson.annotations.SerializedName;

public class AuthResponse {
    @SerializedName("access_token") public String   accessToken;
    @SerializedName("token_type")   public String   tokenType;
    @SerializedName("user")         public UserData user;
}
