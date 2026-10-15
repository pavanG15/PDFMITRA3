# Proguard rules for Aadhar in 1 page (PixelPro)

# Keep all JavascriptInterface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep the JavaScript interface bridge classes
-keep class com.pixelpro.app.AndroidBridge { *; }
-keep class com.pixelpro.app.AndroidDownloader { *; }
-keep class com.pixelpro.app.AndroidScanner { *; }

# Google Play Services AdMob
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

# Google ML Kit Document Scanner
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**
