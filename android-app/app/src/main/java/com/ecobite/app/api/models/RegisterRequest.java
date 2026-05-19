package com.ecobite.app.api.models;

import com.google.gson.annotations.SerializedName;

public class RegisterRequest {
    @SerializedName("email")    private String email;
    @SerializedName("password") private String password;
    @SerializedName("name")     private String name;

    public RegisterRequest(String email, String password, String name) {
        this.email = email;
        this.password = password;
        this.name = name;
    }
}
