package com.pixelpro.app.compose

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.pdf.PdfDocument
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import android.util.Log
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Native Android PDF Export & MediaStore Helper.
 * 
 * - Generates high-quality A4 PDF documents from project files (Images, PDFs, Text).
 * - Saves directly to the device's public Downloads/PixelPro_Scans folder via MediaStore
 *   on Android 10+ (Q / API 29+) with zero storage permissions required.
 * - Provides legacy fallback for Android 9 and lower.
 * - Returns the resulting content Uri to support instant "OPEN" actions via Intent.ACTION_VIEW.
 */
object PdfExportHelper {

    private const val TAG = "PdfExportHelper"

    // Standard A4 dimensions in PostScript points (72 points per inch)
    private const val A4_WIDTH_PTS = 595
    private const val A4_HEIGHT_PTS = 842

    data class ExportResult(
        val success: Boolean,
        val uri: Uri?,
        val fileName: String,
        val filePath: String,
        val error: String? = null
    )

    /**
     * Exports a list of project document files as a single consolidated PDF document.
     */
    suspend fun exportProjectToSinglePdf(
        context: Context,
        files: List<File>,
        projectName: String
    ): ExportResult = withContext(Dispatchers.IO) {
        if (files.isEmpty()) {
            return@withContext ExportResult(
                success = false,
                uri = null,
                fileName = "",
                filePath = "",
                error = "No documents provided to export"
            )
        }

        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val sanitizedProject = projectName.replace("\\s+".toRegex(), "_")
        val outputFileName = "${sanitizedProject}_$timeStamp.pdf"

        val pdfDocument = PdfDocument()
        var pageNumber = 1

        try {
            for (file in files) {
                if (!file.exists()) continue

                val lowerName = file.name.lowercase(Locale.ROOT)
                when {
                    // 1. Image Files: Render bitmap scaled to fit A4 page
                    isImageFile(lowerName) -> {
                        val bitmap = BitmapFactory.decodeFile(file.absolutePath)
                        if (bitmap != null) {
                            val pageInfo = PdfDocument.PageInfo.Builder(A4_WIDTH_PTS, A4_HEIGHT_PTS, pageNumber).create()
                            val page = pdfDocument.startPage(pageInfo)
                            drawBitmapFittedToA4(page.canvas, bitmap)
                            pdfDocument.finishPage(page)
                            pageNumber++
                            bitmap.recycle()
                        }
                    }

                    // 2. Existing PDF Files: Extract each page using PdfRenderer and append
                    lowerName.endsWith(".pdf") -> {
                        try {
                            val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                            val renderer = PdfRenderer(pfd)
                            for (pIdx in 0 until renderer.pageCount) {
                                val pdfPage = renderer.openPage(pIdx)
                                val pageInfo = PdfDocument.PageInfo.Builder(A4_WIDTH_PTS, A4_HEIGHT_PTS, pageNumber).create()
                                val page = pdfDocument.startPage(pageInfo)

                                // Render PDF page onto high-res bitmap, then draw to canvas
                                val scale = 2
                                val bmp = Bitmap.createBitmap(A4_WIDTH_PTS * scale, A4_HEIGHT_PTS * scale, Bitmap.Config.ARGB_8888)
                                bmp.eraseColor(Color.WHITE)
                                pdfPage.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
                                page.canvas.drawBitmap(bmp, null, Rect(0, 0, A4_WIDTH_PTS, A4_HEIGHT_PTS), null)

                                pdfDocument.finishPage(page)
                                pageNumber++
                                pdfPage.close()
                                bmp.recycle()
                            }
                            renderer.close()
                            pfd.close()
                        } catch (e: Exception) {
                            Log.w(TAG, "PdfRenderer error for ${file.name}, using text fallback", e)
                            drawDocumentPlaceholderPage(pdfDocument, file, pageNumber++)
                        }
                    }

                    // 3. Plain Text File: Render formatted text document
                    lowerName.endsWith(".txt") -> {
                        val text = file.readText()
                        drawTextPage(pdfDocument, file.name, text, pageNumber++)
                    }

                    // 4. Other Document types (DOCX, etc.): Render document card
                    else -> {
                        drawDocumentPlaceholderPage(pdfDocument, file, pageNumber++)
                    }
                }
            }

            // Write PDF to temporary cache file first
            val tempFile = File(context.cacheDir, outputFileName)
            FileOutputStream(tempFile).use { out ->
                pdfDocument.writeTo(out)
                out.flush()
            }
            pdfDocument.close()

            // Save PDF to device's public Downloads directory
            val savedUri = savePdfToDownloads(context, tempFile, outputFileName)
            val displayPath = "Downloads > PixelPro_Scans / $outputFileName"

            return@withContext ExportResult(
                success = savedUri != null,
                uri = savedUri,
                fileName = outputFileName,
                filePath = displayPath,
                error = if (savedUri == null) "Failed to save PDF to Downloads" else null
            )
        } catch (e: Exception) {
            Log.e(TAG, "Export to PDF failed", e)
            try {
                pdfDocument.close()
            } catch (_: Exception) {}
            return@withContext ExportResult(
                success = false,
                uri = null,
                fileName = outputFileName,
                filePath = "",
                error = e.localizedMessage ?: "Unknown export error"
            )
        }
    }

    /**
     * Saves generated PDF file into MediaStore Downloads (Android 10+) or legacy storage.
     * Zero storage permissions required on Android 10+.
     */
    private fun savePdfToDownloads(context: Context, sourceFile: File, fileName: String): Uri? {
        val resolver = context.contentResolver

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/PixelPro_Scans")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }

            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
            if (uri != null) {
                resolver.openOutputStream(uri)?.use { outStream ->
                    FileInputStream(sourceFile).use { inStream ->
                        inStream.copyTo(outStream)
                    }
                    outStream.flush()
                }

                // Mark file as complete (IS_PENDING = 0)
                contentValues.clear()
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)
            }
            uri
        } else {
            // Android 9 and lower fallback
            @Suppress("DEPRECATION")
            val downloadsDir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "PixelPro_Scans"
            )
            if (!downloadsDir.exists()) downloadsDir.mkdirs()

            val targetFile = File(downloadsDir, fileName)
            sourceFile.copyTo(targetFile, overwrite = true)

            // Return FileProvider Uri for safe viewing
            FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                targetFile
            )
        }
    }

    /**
     * Centers and scales a bitmap to fit within A4 margins while preserving aspect ratio.
     */
    private fun drawBitmapFittedToA4(canvas: Canvas, bitmap: Bitmap) {
        val margin = 20f
        val availWidth = A4_WIDTH_PTS - (margin * 2)
        val availHeight = A4_HEIGHT_PTS - (margin * 2)

        val scale = Math.min(availWidth / bitmap.width, availHeight / bitmap.height)
        val drawW = bitmap.width * scale
        val drawH = bitmap.height * scale

        val drawX = margin + (availWidth - drawW) / 2f
        val drawY = margin + (availHeight - drawH) / 2f

        val destRect = Rect(
            drawX.toInt(),
            drawY.toInt(),
            (drawX + drawW).toInt(),
            (drawY + drawH).toInt()
        )
        canvas.drawColor(Color.WHITE)
        canvas.drawBitmap(bitmap, null, destRect, null)
    }

    /**
     * Draws formatted text content onto an A4 page.
     */
    private fun drawTextPage(pdfDocument: PdfDocument, fileName: String, text: String, pageNumber: Int) {
        val pageInfo = PdfDocument.PageInfo.Builder(A4_WIDTH_PTS, A4_HEIGHT_PTS, pageNumber).create()
        val page = pdfDocument.startPage(pageInfo)
        val canvas = page.canvas

        canvas.drawColor(Color.WHITE)

        val titlePaint = Paint().apply {
            color = Color.rgb(15, 23, 42)
            textSize = 18f
            isFakeBoldText = true
            isAntiAlias = true
        }

        val textPaint = Paint().apply {
            color = Color.rgb(51, 65, 85)
            textSize = 10f
            isAntiAlias = true
        }

        val linePaint = Paint().apply {
            color = Color.rgb(203, 213, 225)
            strokeWidth = 1f
        }

        canvas.drawText(fileName, 40f, 50f, titlePaint)
        canvas.drawLine(40f, 60f, (A4_WIDTH_PTS - 40).toFloat(), 60f, linePaint)

        var y = 85f
        val lines = text.split("\n")
        for (line in lines) {
            if (y > A4_HEIGHT_PTS - 40f) break
            val truncated = if (line.length > 85) line.substring(0, 85) else line
            canvas.drawText(truncated, 40f, y, textPaint)
            y += 14f
        }

        pdfDocument.finishPage(page)
    }

    /**
     * Draws a placeholder page for attachments or unsupported formats.
     */
    private fun drawDocumentPlaceholderPage(pdfDocument: PdfDocument, file: File, pageNumber: Int) {
        val pageInfo = PdfDocument.PageInfo.Builder(A4_WIDTH_PTS, A4_HEIGHT_PTS, pageNumber).create()
        val page = pdfDocument.startPage(pageInfo)
        val canvas = page.canvas

        canvas.drawColor(Color.rgb(248, 250, 252))

        val titlePaint = Paint().apply {
            color = Color.rgb(20, 184, 166)
            textSize = 22f
            isFakeBoldText = true
            isAntiAlias = true
        }

        val namePaint = Paint().apply {
            color = Color.rgb(15, 23, 42)
            textSize = 14f
            isFakeBoldText = true
            isAntiAlias = true
        }

        val metaPaint = Paint().apply {
            color = Color.rgb(100, 116, 139)
            textSize = 11f
            isAntiAlias = true
        }

        canvas.drawText("DOCUMENT ATTACHMENT", 40f, 100f, titlePaint)
        canvas.drawText(file.name, 40f, 140f, namePaint)
        canvas.drawText("File Size: ${file.length() / 1024} KB", 40f, 165f, metaPaint)

        pdfDocument.finishPage(page)
    }

    private fun isImageFile(name: String): Boolean {
        return name.endsWith(".jpg") || name.endsWith(".jpeg") ||
                name.endsWith(".png") || name.endsWith(".webp")
    }

    /**
     * Opens the saved PDF via native Android Intent with FLAG_GRANT_READ_URI_PERMISSION.
     */
    fun openPdf(context: Context, uri: Uri) {
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/pdf")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(Intent.createChooser(intent, "Open Scanned PDF"))
        } catch (e: Exception) {
            Log.e(TAG, "Cannot open PDF file", e)
        }
    }
}
