# Keep Retrofit & Gson model classes
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.ecobite.app.api.models.** { *; }
-keep class retrofit2.** { *; }
-keep class okhttp3.** { *; }
-dontwarn retrofit2.**
-dontwarn okhttp3.**
