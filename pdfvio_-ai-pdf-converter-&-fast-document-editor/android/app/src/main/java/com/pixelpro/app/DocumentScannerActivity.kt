package com.pixelpro.app

import android.app.Activity
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.RESULT_FORMAT_JPEG
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.RESULT_FORMAT_PDF
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.SCANNER_MODE_FULL
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult

/**
 * Complete Android Activity implementation for Google Play Services ML Kit Document Scanner API.
 *
 * Highlights:
 * 1. Zero Camera permissions required (Google Play Services manages the camera UI).
 * 2. Produces both individual page JPEG URIs and a unified compiled PDF URI.
 * 3. Enforces a 5-page scan limit.
 * 4. Uses ActivityResultContracts.StartIntentSenderForResult.
 */
class DocumentScannerActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MLKitDocScanner"
        private const val MAX_PAGE_LIMIT = 5
    }

    // 1. Scanner client instance
    private lateinit var documentScanner: GmsDocumentScanner

    // 2. ActivityResultLauncher registered for the scanner flow
    private lateinit var scannerLauncher: ActivityResultLauncher<IntentSenderRequest>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Register the ActivityResultLauncher BEFORE starting the scanner
        registerDocumentScannerLauncher()

        // Configure scanner options: PDF + JPEG results, max 5 pages, full editing mode
        setupDocumentScanner()
    }

    /**
     * Registers the launcher using ActivityResultContracts.StartIntentSenderForResult()
     */
    private fun registerDocumentScannerLauncher() {
        scannerLauncher = registerForActivityResult(
            ActivityResultContracts.StartIntentSenderForResult()
        ) { result: ActivityResult ->
            when (result.resultCode) {
                Activity.RESULT_OK -> {
                    // Extract results from intent data
                    val scanResult = GmsDocumentScanningResult.fromActivityResultIntent(result.data)
                    handleScanSuccess(scanResult)
                }
                Activity.RESULT_CANCELED -> {
                    Log.d(TAG, "Document scanning was cancelled by the user.")
                    Toast.makeText(this, "Scan cancelled", Toast.LENGTH_SHORT).show()
                }
                else -> {
                    Log.e(TAG, "Document scanning failed with resultCode: ${result.resultCode}")
                    Toast.makeText(this, "Scanning failed", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    /**
     * Configures the ML Kit Document Scanner options
     */
    private fun setupDocumentScanner() {
        val options = GmsDocumentScannerOptions.Builder()
            // Page limit: maximum 5 pages
            .setPageLimit(MAX_PAGE_LIMIT)
            // Enable both JPEG images and compiled PDF output
            .setResultFormats(RESULT_FORMAT_JPEG, RESULT_FORMAT_PDF)
            // Full mode provides auto-detection, manual corner adjustments, and filters
            .setScannerMode(SCANNER_MODE_FULL)
            // Allow user to import photos from gallery
            .setGalleryImportAllowed(true)
            .build()

        documentScanner = GmsDocumentScanning.getClient(options)
    }

    /**
     * Launches the official out-of-the-box Google Play Services Document Scanner UI
     */
    fun startDocumentScan() {
        documentScanner.getStartScanIntent(this)
            .addOnSuccessListener { intentSender ->
                val request = IntentSenderRequest.Builder(intentSender).build()
                scannerLauncher.launch(request)
            }
            .addOnFailureListener { exception ->
                Log.e(TAG, "Failed to initiate document scan intent", exception)
                Toast.makeText(this, "Error starting scanner: ${exception.localizedMessage}", Toast.LENGTH_LONG).show()
            }
    }

    /**
     * Extracts JPEG URIs and PDF URI from the successful scan result
     */
    private fun handleScanSuccess(result: GmsDocumentScanningResult?) {
        if (result == null) {
            Log.w(TAG, "Scan result was null")
            return
        }

        // 1. Extract JPEG image URIs for each individual scanned page
        val pages = result.pages
        val jpegUris: List<Uri> = pages?.map { it.imageUri } ?: emptyList()

        Log.d(TAG, "Total pages scanned: ${jpegUris.size}")
        jpegUris.forEachIndexed { index, uri ->
            Log.d(TAG, "Page ${index + 1} JPEG URI: $uri")
        }

        // 2. Extract final compiled PDF URI and metadata
        val pdfResult = result.pdf
        val pdfUri: Uri? = pdfResult?.uri
        val pageCount: Int = pdfResult?.pageCount ?: 0

        if (pdfUri != null) {
            Log.d(TAG, "Final Compiled PDF URI: $pdfUri (Page count: $pageCount)")
        }

        // Callback / UI update
        onScanResultsReady(jpegUris, pdfUri)
    }

    /**
     * Use the extracted URIs in your app (display in WebView, upload, or save)
     */
    private fun onScanResultsReady(jpegUris: List<Uri>, pdfUri: Uri?) {
        Toast.makeText(
            this,
            "Scanned ${jpegUris.size} page(s). PDF ready: ${pdfUri != null}",
            Toast.LENGTH_SHORT
        ).show()

        // Example: Pass the URIs to your repository, WebView, or open the PDF
    }
}
