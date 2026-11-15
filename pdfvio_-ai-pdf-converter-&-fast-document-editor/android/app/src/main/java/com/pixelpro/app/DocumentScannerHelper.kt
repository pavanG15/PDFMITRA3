package com.pixelpro.app

import android.app.Activity
import android.net.Uri
import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultCaller
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.RESULT_FORMAT_JPEG
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.RESULT_FORMAT_PDF
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions.SCANNER_MODE_FULL
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult

/**
 * Result data class containing both individual JPEG URIs and the compiled PDF URI.
 */
data class DocumentScanOutput(
    val jpegImageUris: List<Uri>,
    val compiledPdfUri: Uri?,
    val pageCount: Int
)

/**
 * Reusable helper for Activities and Fragments to launch Google Play Services Document Scanner.
 */
class DocumentScannerHelper(
    private val caller: ActivityResultCaller,
    private val pageLimit: Int = 5,
    private val onScanSuccess: (DocumentScanOutput) -> Unit,
    private val onScanCanceled: () -> Unit = {},
    private val onScanError: (Throwable?) -> Unit = {}
) {
    private val scannerLauncher: ActivityResultLauncher<IntentSenderRequest>
    private val scannerClient: GmsDocumentScanner

    init {
        // Register the launcher
        scannerLauncher = caller.registerForActivityResult(
            ActivityResultContracts.StartIntentSenderForResult()
        ) { result: ActivityResult ->
            when (result.resultCode) {
                Activity.RESULT_OK -> {
                    val scanResult = GmsDocumentScanningResult.fromActivityResultIntent(result.data)
                    if (scanResult != null) {
                        val jpegUris = scanResult.pages?.map { it.imageUri } ?: emptyList()
                        val pdfUri = scanResult.pdf?.uri
                        val totalPages = scanResult.pdf?.pageCount ?: jpegUris.size

                        val output = DocumentScanOutput(
                            jpegImageUris = jpegUris,
                            compiledPdfUri = pdfUri,
                            pageCount = totalPages
                        )
                        onScanSuccess(output)
                    } else {
                        onScanError(IllegalStateException("Scan result intent data was null"))
                    }
                }
                Activity.RESULT_CANCELED -> {
                    onScanCanceled()
                }
                else -> {
                    onScanError(RuntimeException("Document scanning failed with code: ${result.resultCode}"))
                }
            }
        }

        // Configure options with 5-page limit and PDF + JPEG formats
        val options = GmsDocumentScannerOptions.Builder()
            .setPageLimit(pageLimit)
            .setResultFormats(RESULT_FORMAT_JPEG, RESULT_FORMAT_PDF)
            .setScannerMode(SCANNER_MODE_FULL)
            .setGalleryImportAllowed(true)
            .build()

        scannerClient = GmsDocumentScanning.getClient(options)
    }

    /**
     * Call this method from button click or trigger in Activity/Fragment
     */
    fun startScan(activity: Activity) {
        scannerClient.getStartScanIntent(activity)
            .addOnSuccessListener { intentSender ->
                val request = IntentSenderRequest.Builder(intentSender).build()
                scannerLauncher.launch(request)
            }
            .addOnFailureListener { exception ->
                Log.e("DocumentScannerHelper", "Failed to start document scan", exception)
                onScanError(exception)
            }
    }
}
