package com.pixelpro.app

import android.app.Application
import com.google.android.gms.ads.MobileAds

/**
 * Application class referenced by AndroidManifest.xml (android:name=".PixelProApp").
 * Initializes the Google Mobile Ads SDK once, at app startup, so banner and
 * interstitial ads requested later from MainActivity are ready to load.
 */
class PixelProApp : Application() {
    override fun onCreate() {
        super.onCreate()
        MobileAds.initialize(this) { /* init complete, nothing else needed here */ }
    }
}
