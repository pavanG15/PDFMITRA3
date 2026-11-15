package com.pixelpro.app

import android.webkit.JavascriptInterface

/**
 * JavaScript interface exposed to the WebView under the name "AndroidBridge" (and "AndroidScanner").
 * 
 * Bridges JavaScript calls directly to the native Google Play Services ML Kit Document Scanner API
 * and native file downloading / sharing capabilities.
 */
class WebAppInterface(private val activity: MainActivity) {

    /**
     * Called from Web App when user clicks "Scan Page" or Camera FAB.
     * Launches the native Google ML Kit Document Scanner flow without opening HTML5 camera.
     */
    @JavascriptInterface
    fun openDocumentScanner() {
        activity.runOnUiThread {
            activity.startDocumentScan() // Calls GmsDocumentScanning intent
        }
    }

    /**
     * Backward-compatible alias for starting native Google ML Kit Document Scanner.
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
     * Dedicated native camera capture method for Aadhaar / ID Card.
     * Launches the native camera directly and returns Base64 data URL via window.onIdCardPhotoCaptured(side, dataUrl).
     * This is strictly separated from the Google ML Kit Document Scanner flow.
     */
    @JavascriptInterface
    fun openIdCardCamera(side: String) {
        activity.runOnUiThread {
            activity.openIdCardCamera(side)
        }
    }

    /**
     * Allows Web App to check if native document scanner capability is available.
     */
    @JavascriptInterface
    fun isNativeScannerAvailable(): Boolean {
        return true
    }

    /**
     * Called by Download FAB / Export System to save compiled document directly to device Downloads folder.
     */
    @JavascriptInterface
    fun downloadFile(base64Data: String, fileName: String) {
        activity.runOnUiThread {
            activity.saveFileToDownloads(base64Data, fileName, null)
        }
    }

    /**
     * 3-argument overload called by Web App when MIME type is explicitly provided.
     */
    @JavascriptInterface
    fun downloadFile(base64Data: String, fileName: String, mimeType: String) {
        activity.runOnUiThread {
            activity.saveFileToDownloads(base64Data, fileName, mimeType)
        }
    }

    /**
     * Called to share file via native Android sharing sheet.
     */
    @JavascriptInterface
    fun shareFile(base64Data: String, fileName: String) {
        activity.runOnUiThread {
            activity.saveAndShareFile(base64Data, fileName)
        }
    }

    /**
     * Opens the saved file from storage using default viewer app.
     */
    @JavascriptInterface
    fun openSavedFile(savedPath: String, mimeType: String) {
        activity.runOnUiThread {
            activity.openSavedFile(savedPath, mimeType)
        }
    }

    /**
     * Re-shares a previously saved file from storage.
     */
    @JavascriptInterface
    fun shareSavedFile(savedPath: String, mimeType: String) {
        activity.runOnUiThread {
            activity.shareSavedFile(savedPath, mimeType)
        }
    }
}
