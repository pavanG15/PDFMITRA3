# Proguard / R8 rules for Aadhar in 1 page (PixelPro)

# -----------------------------------------------------------------------------
# 1. Room Database & Generated Impl Classes
# -----------------------------------------------------------------------------
# Fixes "Failed to create an instance of androidx.work.impl.WorkDatabase"
-keep class * extends androidx.room.RoomDatabase {
    <init>();
    *;
}

# Keep all generated Room implementation classes and their constructors
-keep class **_Impl {
    <init>();
    *;
}

-keep class * extends androidx.room.RoomDatabase
-keepclassmembers class * extends androidx.room.RoomDatabase {
    void <init>();
    <methods>;
}

-keep class * extends androidx.room.EntityInsertionAdapter { *; }
-keep class * extends androidx.room.EntityDeletionOrUpdateAdapter { *; }
-keep class * extends androidx.room.SharedSQLiteStatement { *; }

-keep class androidx.room.** { *; }
-dontwarn androidx.room.**

# -----------------------------------------------------------------------------
# 2. AndroidX Startup & WorkManager
# -----------------------------------------------------------------------------
# Fixes "Unable to get provider androidx.startup.InitializationProvider"
-keep class androidx.startup.** { *; }
-keep class * extends androidx.startup.Initializer {
    <init>();
    *;
}
-keepclassmembers class androidx.startup.InitializationProvider { *; }
-dontwarn androidx.startup.**

# AndroidX WorkManager classes & initializers
-keep class androidx.work.** { *; }
-keep class androidx.work.impl.** { *; }
-keep class androidx.work.impl.WorkDatabase { *; }
-keep class androidx.work.impl.WorkDatabase_Impl {
    <init>();
    *;
}
-keep class androidx.work.impl.WorkManagerInitializer {
    <init>();
    *;
}
-keep class * extends androidx.work.Worker {
    <init>(android.content.Context, androidx.work.WorkerParameters);
    *;
}
-keep class * extends androidx.work.ListenableWorker {
    <init>(android.content.Context, androidx.work.WorkerParameters);
    *;
}
-dontwarn androidx.work.**
-dontwarn androidx.work.impl.**

# -----------------------------------------------------------------------------
# 3. WebView JavaScript Interface & Android Bridge Classes
# -----------------------------------------------------------------------------
-keepattributes JavascriptInterface

# Keep all methods annotated with @JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep AndroidBridge and its public methods
-keep class com.pixelpro.app.AndroidBridge {
    <init>(...);
    *;
}
-keepclassmembers class com.pixelpro.app.AndroidBridge {
    public *;
}

# Keep AndroidScanner and its public methods
-keep class com.pixelpro.app.AndroidScanner {
    <init>(...);
    *;
}
-keepclassmembers class com.pixelpro.app.AndroidScanner {
    public *;
}

# Keep AndroidDownloader and its public methods
-keep class com.pixelpro.app.AndroidDownloader {
    <init>(...);
    *;
}
-keepclassmembers class com.pixelpro.app.AndroidDownloader {
    public *;
}

# Keep any additional helper classes in application package
-keep class com.pixelpro.app.** { *; }

# -----------------------------------------------------------------------------
# 4. Google Play Services AdMob & ML Kit
# -----------------------------------------------------------------------------
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

-keep class com.google.android.gms.common.** { *; }
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Reflection & annotation attributes
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
