package com.pixelpro.app

import android.app.Application
import com.google.android.gms.ads.MobileAds

class PixelProApp : Application() {
    override fun onCreate() {
        super.onCreate()
        MobileAds.initialize(this) { }
    }
}
