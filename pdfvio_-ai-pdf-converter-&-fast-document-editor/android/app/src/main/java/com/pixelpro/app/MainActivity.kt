package com.pixelpro.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Hosts the PDFVio web app in a WebView and bridges it to native Android
 * features the JS side already expects:
 *
 *  - window.AndroidScanner.startScan()  -> launches Google's real ML Kit
 *    Document Scanner (the same auto-crop/enhance tech Google Drive's scan
 *    feature uses), then delivers each scanned page back to the page via
 *    window.onScanComplete(base64Image) — exactly the bridge Scan.tsx
 *    already listens for.
 *
 *  - window.AndroidBridge.shareFile(base64, fileName) -> saves the file to
 *    a cache folder and opens the Android share sheet via FileProvider.
 *
 *  - window.AndroidBridge.showBannerAd / hideBannerAd /
 *    showInterstitialAd / showInterstitialAdForDownload -> real AdMob ads.
 *
 * NOTE: the manifest's AdMob APPLICATION_ID is currently Google's public
 * *test* app ID. Ad units requested here use the real unit IDs from
 * utils/shareHelper.ts. Before a production release, replace the
 * APPLICATION_ID meta-data in AndroidManifest.xml with your own AdMob
 * App ID (from the AdMob console), or ads will fail/behave inconsistently.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var adContainer: FrameLayout
    private var bannerAdView: AdView? = null
    private var interstitialAd: InterstitialAd? = null

    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // --- Activity Result launchers (modern replacement for onActivityResult) ---

    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private lateinit var scannerLauncher: ActivityResultLauncher<IntentSenderRequest>
    private lateinit var cameraPermissionLauncher: ActivityResultLauncher<String>

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        adContainer = findViewById(R.id.adContainer)

        registerLaunchers()
        setupWebView()

        webView.loadUrl(getString(R.string.web_app_url))
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        bannerAdView?.destroy()
        super.onDestroy()
    }

    // ---------------------------------------------------------------------
    // Result launchers
    // ---------------------------------------------------------------------

    private fun registerLaunchers() {
        fileChooserLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val callback = filePathCallback
            filePathCallback = null
            if (callback == null) return@registerForActivityResult

            if (result.resultCode != Activity.RESULT_OK || result.data == null) {
                callback.onReceiveValue(null)
                return@registerForActivityResult
            }

            val data = result.data!!
            val uris: Array<Uri> = when {
                data.clipData != null -> {
                    val clip = data.clipData!!
                    Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                }
                data.data != null -> arrayOf(data.data!!)
                else -> emptyArray()
            }
            callback.onReceiveValue(if (uris.isEmpty()) null else uris)
        }

        scannerLauncher = registerForActivityResult(
            ActivityResultContracts.StartIntentSenderForResult()
        ) { result ->
            if (result.resultCode != Activity.RESULT_OK) return@registerForActivityResult
            val scanResult = GmsDocumentScanningResult.fromActivityResultIntent(result.data)
            val pages = scanResult?.pages
            if (pages.isNullOrEmpty()) {
                Toast.makeText(this, "No pages captured.", Toast.LENGTH_SHORT).show()
                return@registerForActivityResult
            }
            // Send each scanned page back to the web app, one at a time, with a
            // small stagger so the WebView isn't asked to process several
            // large images in the same JS tick.
            pages.forEachIndexed { index, page ->
                Handler(Looper.getMainLooper()).postDelayed({
                    sendPageToWebApp(page.imageUri)
                }, index * 250L)
            }
        }

        cameraPermissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->
            if (granted) {
                launchDocumentScanner()
            } else {
                Toast.makeText(
                    this,
                    getString(R.string.camera_permission_required),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    // ---------------------------------------------------------------------
    // WebView setup
    // ---------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT

        webView.addJavascriptInterface(AndroidScannerBridge(), "AndroidScanner")
        webView.addJavascriptInterface(AndroidBridgeImpl(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                // Keep normal navigation inside the app's own WebView.
                return false
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    Toast.makeText(
                        this@MainActivity,
                        getString(R.string.error_network_message),
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            // Lets the in-app camera (getUserMedia, used by the web-based
            // fallback scanner) actually receive camera frames.
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { request.grant(request.resources) }
            }

            // Wires up <input type="file" accept="image/*" multiple> (the
            // "Upload Images" tile in the gallery) to the native file picker.
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback

                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                return try {
                    fileChooserLauncher.launch(
                        Intent.createChooser(intent, "Select Images")
                    )
                    true
                } catch (e: Exception) {
                    filePathCallback = null
                    false
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // ML Kit Document Scanner (the actual fix for scan quality)
    // ---------------------------------------------------------------------

    private fun startDocumentScan() {
        val hasCameraPermission = ContextCompat.checkSelfPermission(
            this, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        if (hasCameraPermission) {
            launchDocumentScanner()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun launchDocumentScanner() {
        val options = GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(false) // the web app has its own "Upload Images" flow
            .setPageLimit(20)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build()

        val scanner = GmsDocumentScanning.getClient(options)

        scanner.getStartScanIntent(this)
            .addOnSuccessListener { intentSender ->
                scannerLauncher.launch(
                    IntentSenderRequest.Builder(intentSender).build()
                )
            }
            .addOnFailureListener {
                Toast.makeText(
                    this,
                    "Scanner unavailable right now. Please try again, or use Upload Images.",
                    Toast.LENGTH_LONG
                ).show()
            }
    }

    private fun sendPageToWebApp(pageUri: Uri) {
        try {
            val bytes = contentResolver.openInputStream(pageUri)?.use { it.readBytes() }
                ?: return
            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            // JSONObject.quote() safely escapes the string for inlining into JS.
            val jsSafeString = JSONObject.quote(base64)
            webView.post {
                webView.evaluateJavascript(
                    "window.onScanComplete && window.onScanComplete($jsSafeString);",
                    null
                )
            }
        } catch (e: Exception) {
            runOnUiThread {
                Toast.makeText(this, "Could not load a scanned page.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ---------------------------------------------------------------------
    // window.AndroidScanner JS interface
    // ---------------------------------------------------------------------

    private inner class AndroidScannerBridge {
        @JavascriptInterface
        fun startScan() {
            runOnUiThread { startDocumentScan() }
        }
    }

    // ---------------------------------------------------------------------
    // window.AndroidBridge JS interface (sharing + ads)
    // ---------------------------------------------------------------------

    private inner class AndroidBridgeImpl {

        @JavascriptInterface
        fun shareFile(base64Data: String, fileName: String) {
            runOnUiThread {
                try {
                    val commaIndex = base64Data.indexOf(',')
                    val pureBase64 = if (base64Data.startsWith("data:") && commaIndex != -1) {
                        base64Data.substring(commaIndex + 1)
                    } else {
                        base64Data
                    }
                    val bytes = Base64.decode(pureBase64, Base64.DEFAULT)

                    val shareDir = File(cacheDir, "shared").apply { mkdirs() }
                    val outFile = File(shareDir, fileName)
                    FileOutputStream(outFile).use { it.write(bytes) }

                    val uri = FileProvider.getUriForFile(
                        this@MainActivity,
                        "$packageName.fileprovider",
                        outFile
                    )

                    val mimeType = when {
                        fileName.endsWith(".pdf", true) -> "application/pdf"
                        fileName.endsWith(".zip", true) -> "application/zip"
                        fileName.endsWith(".jpg", true) || fileName.endsWith(".jpeg", true) ->
                            "image/jpeg"
                        else -> "application/octet-stream"
                    }

                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                        type = mimeType
                        putExtra(Intent.EXTRA_STREAM, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startActivity(Intent.createChooser(shareIntent, getString(R.string.share_file)))
                } catch (e: Exception) {
                    Toast.makeText(
                        this@MainActivity,
                        String.format(getString(R.string.download_failed), fileName),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }

        @JavascriptInterface
        fun showBannerAd(adUnitId: String?, page: String?) {
            runOnUiThread { displayBannerAd(adUnitId) }
        }

        @JavascriptInterface
        fun refreshBannerAd(adUnitId: String?, page: String?) {
            runOnUiThread { displayBannerAd(adUnitId) }
        }

        @JavascriptInterface
        fun hideBannerAd() {
            runOnUiThread {
                bannerAdView?.visibility = View.GONE
            }
        }

        @JavascriptInterface
        fun showInterstitialAd(adUnitId: String?) {
            runOnUiThread { loadAndShowInterstitial(adUnitId) }
        }

        @JavascriptInterface
        fun showInterstitialAdForDownload(adUnitId: String?) {
            runOnUiThread { loadAndShowInterstitial(adUnitId) }
        }
    }

    // ---------------------------------------------------------------------
    // AdMob helpers
    // ---------------------------------------------------------------------

    private fun displayBannerAd(adUnitId: String?) {
        if (adUnitId.isNullOrBlank()) return

        if (bannerAdView == null || bannerAdView?.adUnitId != adUnitId) {
            bannerAdView?.let { adContainer.removeView(it) }
            val newBanner = AdView(this).apply {
                this.adUnitId = adUnitId
                setAdSize(AdSize.BANNER)
                adListener = object : AdListener() {
                    override fun onAdFailedToLoad(error: LoadAdError) {
                        visibility = View.GONE
                    }
                    override fun onAdLoaded() {
                        visibility = View.VISIBLE
                    }
                }
            }
            adContainer.addView(newBanner)
            bannerAdView = newBanner
        }

        bannerAdView?.visibility = View.VISIBLE
        bannerAdView?.loadAd(AdRequest.Builder().build())
    }

    private fun loadAndShowInterstitial(adUnitId: String?) {
        if (adUnitId.isNullOrBlank()) return

        InterstitialAd.load(
            this,
            adUnitId,
            AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdDismissedFullScreenContent() {
                            interstitialAd = null
                        }
                        override fun onAdFailedToShowFullScreenContent(error: AdError) {
                            interstitialAd = null
                        }
                    }
                    ad.show(this@MainActivity)
                }
                override fun onAdFailedToLoad(error: LoadAdError) {
                    interstitialAd = null
                    // Fail silently — the user's download/share must not be blocked by an ad.
                }
            }
        )
    }
}
