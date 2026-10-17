package com.pixelpro.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.RESULT_FORMAT_JPEG
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.RESULT_FORMAT_PDF
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.SCANNER_MODE_FULL
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import org.json.JSONArray
import org.json.JSONObject

/**
 * Main Activity hosting the WebView and integrating the native Google Play Services ML Kit Document Scanner.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "PixelProMainActivity"
        private const val MAX_SCAN_PAGES = 5
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var documentScanner: GmsDocumentScanner
    private lateinit var scannerLauncher: ActivityResultLauncher<IntentSenderRequest>

    // File chooser callback for <input type="file"> inside WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val intentData = result.data
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, intentData)
            filePathCallback?.onReceiveValue(uris)
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Handle splash screen API for Android 12+
        installSplashScreen()
        super.onCreate(savedInstanceState)

        // Initialize ML Kit Document Scanner launcher and client
        initDocumentScanner()

        // Setup layout and WebView programmatically for zero XML dependency
        setupContentView()

        // Configure WebView settings and bridge
        setupWebView()

        // Handle Back button to navigate WebView history if possible
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (::webView.isInitialized && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

        // Load the Web Application URL
        val targetUrl = getString(R.string.web_app_url)
        webView.loadUrl(targetUrl)
    }

    /**
     * Initializes the Google Play Services ML Kit Document Scanner client & ActivityResultLauncher.
     */
    private fun initDocumentScanner() {
        // Register the launcher for the IntentSender flow
        scannerLauncher = registerForActivityResult(
            ActivityResultContracts.StartIntentSenderForResult()
        ) { result: ActivityResult ->
            when (result.resultCode) {
                Activity.RESULT_OK -> {
                    val scanResult = GmsDocumentScanningResult.fromActivityResultIntent(result.data)
                    handleScanSuccess(scanResult)
                }
                Activity.RESULT_CANCELED -> {
                    Log.d(TAG, "Document scanning was cancelled by the user")
                }
                else -> {
                    Log.e(TAG, "Document scan failed with code: ${result.resultCode}")
                    Toast.makeText(this, "Document scanning failed", Toast.LENGTH_SHORT).show()
                }
            }
        }

        // Configure ML Kit Document Scanner: 5-page limit, PDF + JPEG, full scanner mode
        val options = GmsDocumentScannerOptions.Builder()
            .setPageLimit(MAX_SCAN_PAGES)
            .setResultFormats(RESULT_FORMAT_JPEG, RESULT_FORMAT_PDF)
            .setScannerMode(SCANNER_MODE_FULL)
            .setGalleryImportAllowed(true)
            .build()

        documentScanner = GmsDocumentScanning.getClient(options)
    }

    /**
     * Launches the official Google Play Services ML Kit Document Scanner UI.
     * Called directly by WebAppInterface.startDocumentScan() when the user clicks "Scan to PDF",
     * "/scan", or the camera FAB in the Web App.
     */
    fun startDocumentScan() {
        documentScanner.getStartScanIntent(this)
            .addOnSuccessListener { intentSender ->
                val request = IntentSenderRequest.Builder(intentSender).build()
                scannerLauncher.launch(request)
            }
            .addOnFailureListener { exception ->
                Log.e(TAG, "Failed to start Google ML Kit Document Scanner", exception)
                Toast.makeText(
                    this,
                    "Error launching scanner: ${exception.localizedMessage}",
                    Toast.LENGTH_SHORT
                ).show()
            }
    }

    /**
     * Handles the successful scan result from ML Kit and sends the scanned PDF or Image Uri
     * back to the WebView via window.onScanComplete('${pdfUri}').
     */
    private fun handleScanSuccess(scanResult: GmsDocumentScanningResult?) {
        if (scanResult == null) {
            Log.w(TAG, "GmsDocumentScanningResult was null")
            return
        }

        // 1. Extract compiled PDF Uri if available
        val pdfUri: Uri? = scanResult.pdf?.uri

        // 2. Extract individual page JPEG image URIs
        val pages = scanResult.pages
        val jpegUris: List<Uri> = pages?.map { it.imageUri } ?: emptyList()

        Log.d(TAG, "ML Kit scan completed! Pages: ${jpegUris.size}, PDF: $pdfUri")

        // 3. Send back to WebView:
        // Prioritize PDF Uri if generated, or fallback to first page image URI
        val primaryUri = pdfUri?.toString() ?: jpegUris.firstOrNull()?.toString()

        if (primaryUri != null) {
            // Also prepare full JSON payload for batch/multi-page scanning
            val payloadObj = JSONObject()
            payloadObj.put("pdfUri", pdfUri?.toString())
            val imagesArray = JSONArray()
            jpegUris.forEach { imagesArray.put(it.toString()) }
            payloadObj.put("pages", imagesArray)

            val jsonString = payloadObj.toString().replace("'", "\\'")

            runOnUiThread {
                // Send primary scanned PDF or Image Uri back to the WebView:
                webView.evaluateJavascript("window.onScanComplete('${primaryUri}');", null)

                // Also notify batch listener if multiple pages were scanned
                if (jpegUris.size > 1) {
                    webView.evaluateJavascript("window.onScanBatchComplete('${jsonString}');", null)
                }
            }
        }
    }

    /**
     * Sets up the root layout containing WebView and indeterminate ProgressBar.
     */
    private fun setupContentView() {
        val rootLayout = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                8
            ).apply {
                visibility = View.GONE
            }
            isIndeterminate = false
            max = 100
        }

        rootLayout.addView(webView)
        rootLayout.addView(progressBar)
        setContentView(rootLayout)
    }

    /**
     * Configures the WebView settings, clients, and registers WebAppInterface.
     */
    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

        // Register JavaScript interfaces for Document Scanning
        // Register as "AndroidBridge" (as requested) and "AndroidScanner" for dual compatibility
        val bridge = WebAppInterface(this)
        webView.addJavascriptInterface(bridge, "AndroidBridge")
        webView.addJavascriptInterface(bridge, "AndroidScanner")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    progressBar.visibility = View.GONE
                    Log.e(TAG, "WebView error loading ${request.url}: ${error?.description}")
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                try {
                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    fileChooserLauncher.launch(intent)
                    return true
                } catch (e: Exception) {
                    Log.e(TAG, "Cannot launch file chooser", e)
                    this@MainActivity.filePathCallback = null
                    return false
                }
            }
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("AndroidBridge")
            webView.removeJavascriptInterface("AndroidScanner")
            webView.destroy()
        }
        super.onDestroy()
    }
}
