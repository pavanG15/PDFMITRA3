package com.pixelpro.app

import android.app.Application
import com.google.android.gms.ads.MobileAds

/**
 * Custom Application class for PixelPro App.
 */
class PixelProApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize Mobile Ads SDK asynchronously
        try {
            MobileAds.initialize(this) {}
        } catch (_: Exception) {
            // Safe fallback if ads not yet configured
        }
    }
}
