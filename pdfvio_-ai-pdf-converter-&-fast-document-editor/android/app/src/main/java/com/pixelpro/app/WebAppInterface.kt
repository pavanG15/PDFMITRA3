package com.pixelpro.app

import android.webkit.JavascriptInterface

/**
 * JavaScript interface exposed to the WebView under the name "AndroidBridge" (and "AndroidScanner").
 * 
 * Bridges JavaScript calls directly to the native Google Play Services ML Kit Document Scanner API.
 */
class WebAppInterface(private val activity: MainActivity) {

    /**
     * Called from Web App when user clicks "Scan to PDF", "/scan", or the camera FAB.
     * Launches the native Google ML Kit Document Scanner flow without opening HTML5 camera.
     */
    @JavascriptInterface
    fun startDocumentScan() {
        activity.runOnUiThread {
            activity.startDocumentScan() // Calls GmsDocumentScanning intent
        }
    }

    /**
     * Backward-compatible alias for window.AndroidScanner.startScan()
     */
    @JavascriptInterface
    fun startScan() {
        activity.runOnUiThread {
            activity.startDocumentScan()
        }
    }

    /**
     * Allows Web App to check if native document scanner capability is available.
     */
    @JavascriptInterface
    fun isNativeScannerAvailable(): Boolean {
        return true
    }
}
