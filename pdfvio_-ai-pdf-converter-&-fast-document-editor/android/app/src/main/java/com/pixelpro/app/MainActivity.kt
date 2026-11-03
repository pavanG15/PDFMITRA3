package com.pixelpro.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
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
import androidx.core.content.FileProvider
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
import java.io.File

/**
 * Main Activity hosting the WebView and integrating the native Google Play Services ML Kit Document Scanner
 * as well as direct PDF file saving and sharing handlers.
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
     * Called directly by WebAppInterface.startDocumentScan() when the user clicks the Camera FAB.
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

        val pdfUri: Uri? = scanResult.pdf?.uri
        val pages = scanResult.pages
        val jpegUris: List<Uri> = pages?.map { it.imageUri } ?: emptyList()

        Log.d(TAG, "ML Kit scan completed! Pages: ${jpegUris.size}, PDF: $pdfUri")

        val primaryUri = pdfUri?.toString() ?: jpegUris.firstOrNull()?.toString()

        if (primaryUri != null) {
            val payloadObj = JSONObject()
            payloadObj.put("pdfUri", pdfUri?.toString())
            val imagesArray = JSONArray()
            jpegUris.forEach { imagesArray.put(it.toString()) }
            payloadObj.put("pages", imagesArray)

            val jsonString = payloadObj.toString().replace("'", "\\'")

            runOnUiThread {
                webView.evaluateJavascript("window.onScanComplete('${primaryUri}');", null)

                if (jpegUris.size > 1) {
                    webView.evaluateJavascript("window.onScanBatchComplete('${jsonString}');", null)
                }
            }
        }
    }

    /**
     * Saves the base64-encoded PDF or image file into Android Downloads folder.
     * Called when user clicks the Download FAB in the Web App.
     */
    fun saveFileToDownloads(base64Data: String, fileName: String) {
        try {
            val cleanBase64 = if (base64Data.contains(",")) {
                base64Data.substringAfter(",")
            } else {
                base64Data
            }
            val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
            val isPdf = fileName.endsWith(".pdf", ignoreCase = true)
            val isZip = fileName.endsWith(".zip", ignoreCase = true)
            val isPng = fileName.endsWith(".png", ignoreCase = true)
            val mimeType = when {
                isPdf -> "application/pdf"
                isZip -> "application/zip"
                isPng -> "image/png"
                else -> "image/jpeg"
            }

            // Also save a copy in cache directory for instant opening and sharing via FileProvider
            try {
                val cacheFile = File(cacheDir, fileName)
                cacheFile.writeBytes(bytes)
            } catch (ce: Exception) {
                Log.w(TAG, "Cache file copy warning", ce)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/PixelPro_Scans")
                }
                val resolver = contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { stream ->
                        stream.write(bytes)
                        stream.flush()
                    }
                }
            } else {
                @Suppress("DEPRECATION")
                val downloadsDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "PixelPro_Scans")
                if (!downloadsDir.exists()) downloadsDir.mkdirs()
                val targetFile = File(downloadsDir, fileName)
                targetFile.writeBytes(bytes)
            }

            val displayPath = "Internal Storage > Downloads > PixelPro_Scans / $fileName"
            val sanitizedPath = displayPath.replace("'", "\\'")
            val sanitizedName = fileName.replace("'", "\\'")

            runOnUiThread {
                Toast.makeText(this, "Saved to Downloads: $fileName", Toast.LENGTH_LONG).show()
                webView.evaluateJavascript("if (typeof window.onFileSaved === 'function') { window.onFileSaved('$sanitizedPath', '$sanitizedName', '$mimeType'); }", null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error saving file to downloads", e)
            Toast.makeText(this, "Save error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Saves file to cache and launches native Android share sheet.
     */
    fun saveAndShareFile(base64Data: String, fileName: String) {
        try {
            val cleanBase64 = if (base64Data.contains(",")) {
                base64Data.substringAfter(",")
            } else {
                base64Data
            }
            val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)

            val cacheFile = File(cacheDir, fileName)
            cacheFile.writeBytes(bytes)

            val fileUri: Uri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                cacheFile
            )

            val isPdf = fileName.endsWith(".pdf", ignoreCase = true)
            val isZip = fileName.endsWith(".zip", ignoreCase = true)
            val isPng = fileName.endsWith(".png", ignoreCase = true)
            val mimeType = when {
                isPdf -> "application/pdf"
                isZip -> "application/zip"
                isPng -> "image/png"
                else -> "image/jpeg"
            }

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, fileUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(shareIntent, "Share Document"))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to share file", e)
            saveFileToDownloads(base64Data, fileName)
        }
    }

    /**
     * Opens the saved file from cache/storage using default viewer app.
     */
    fun openSavedFile(savedPath: String, mimeType: String) {
        try {
            val cleanFileName = savedPath.substringAfterLast("/").substringAfterLast(">").trim()
            val cacheFile = File(cacheDir, cleanFileName)
            if (cacheFile.exists()) {
                val fileUri = FileProvider.getUriForFile(this, "${applicationContext.packageName}.fileprovider", cacheFile)
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(fileUri, mimeType)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(Intent.createChooser(intent, "Open $cleanFileName"))
            } else {
                val intent = Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(intent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error opening saved file", e)
            Toast.makeText(this, "Unable to open file: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Shares a previously saved file from cache/storage.
     */
    fun shareSavedFile(savedPath: String, mimeType: String) {
        try {
            val cleanFileName = savedPath.substringAfterLast("/").substringAfterLast(">").trim()
            val cacheFile = File(cacheDir, cleanFileName)
            if (cacheFile.exists()) {
                val fileUri = FileProvider.getUriForFile(this, "${applicationContext.packageName}.fileprovider", cacheFile)
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = mimeType
                    putExtra(Intent.EXTRA_STREAM, fileUri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(Intent.createChooser(shareIntent, "Share $cleanFileName"))
            } else {
                Toast.makeText(this, "File available in Downloads: $cleanFileName", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error sharing saved file", e)
            Toast.makeText(this, "Unable to share file: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
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

        // Register JavaScript interfaces for Document Scanning and File Operations
        val bridge = WebAppInterface(this)
        webView.addJavascriptInterface(bridge, "AndroidBridge")
        webView.addJavascriptInterface(bridge, "AndroidScanner")

        // Handle downloads triggered via standard browser link
        webView.setDownloadListener { url, _, contentDisposition, mimetype, _ ->
            try {
                if (url.startsWith("blob:") || url.startsWith("data:")) {
                    Toast.makeText(this, "Downloading file...", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Download listener error", e)
            }
        }

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
