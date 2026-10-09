plugins {
    alias(libs.plugins.android-application)
    alias(libs.plugins.kotlin-android)
}

android {
    namespace = "com.pixelpro.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.pixelpro.app"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug")
        }
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.constraintlayout)
    implementation(libs.androidx.core.splashscreen)

    // Google AdMob
    implementation(libs.play.services.ads)

    // Google ML Kit Document Scanner
    implementation(libs.play.services.mlkit.document.scanner)

    // Kotlin Coroutines
    implementation(libs.kotlinx.coroutines.android)
}
