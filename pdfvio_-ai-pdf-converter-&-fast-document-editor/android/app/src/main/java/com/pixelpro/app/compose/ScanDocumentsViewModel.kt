package com.pixelpro.app.compose

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Clean Architecture ViewModel for Scan Documents Screen.
 * 
 * Manages:
 * - Internal project storage: `context.filesDir/projects/{folderName}/`
 * - Picking files (PDF, DOCX, TXT, images) and copying to internal storage
 * - Tracking documents count and grid state
 * - Selection and multi-select deletion
 * - Single PDF export via PdfExportHelper to Downloads folder
 */
class ScanDocumentsViewModel(application: Application) : AndroidViewModel(application) {

    private val TAG = "ScanDocumentsVM"

    data class DocumentItem(
        val id: String = UUID.randomUUID().toString(),
        val name: String,
        val file: File,
        val mimeType: String,
        val dateFormatted: String,
        val sizeFormatted: String,
        val thumbnail: Bitmap? = null
    )

    data class ScanUiState(
        val projectName: String = "Scan_Project_01",
        val documents: List<DocumentItem> = emptyList(),
        val selectedIds: Set<String> = emptySet(),
        val isSelectMode: Boolean = false,
        val isProcessing: Boolean = false,
        val isExporting: Boolean = false,
        val progressMessage: String? = null,
        val lastExportedUri: Uri? = null,
        val snackbarMessage: String? = null,
        val snackbarActionLabel: String? = null
    )

    private val _uiState = MutableStateFlow(ScanUiState())
    val uiState: StateFlow<ScanUiState> = _uiState.asStateFlow()

    init {
        loadProjectDocuments()
    }

    /**
     * Resolves the internal directory for the current project:
     * `context.filesDir/projects/{projectName}/`
     */
    private fun getProjectDir(): File {
        val dir = File(getApplication<Application>().filesDir, "projects/${_uiState.value.projectName}")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    /**
     * Loads existing documents from the project's internal directory.
     */
    fun loadProjectDocuments() {
        viewModelScope.launch(Dispatchers.IO) {
            val projectDir = getProjectDir()
            val files = projectDir.listFiles() ?: emptyArray()

            val items = files.filter { it.isFile && !it.name.startsWith(".") }.map { file ->
                val lower = file.name.lowercase(Locale.ROOT)
                val mime = when {
                    lower.endsWith(".pdf") -> "application/pdf"
                    lower.endsWith(".png") -> "image/png"
                    lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
                    lower.endsWith(".txt") -> "text/plain"
                    lower.endsWith(".docx") -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    else -> "application/octet-stream"
                }

                val dateStr = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(Date(file.lastModified()))
                val sizeStr = "${(file.length() / 1024).coerceAtLeast(1)} KB"

                // Create lightweight thumbnail for images
                val thumb = if (mime.startsWith("image/")) {
                    decodeSampledBitmap(file, 200, 260)
                } else null

                DocumentItem(
                    name = file.name,
                    file = file,
                    mimeType = mime,
                    dateFormatted = dateStr,
                    sizeFormatted = sizeStr,
                    thumbnail = thumb
                )
            }

            _uiState.update { it.copy(documents = items) }
        }
    }

    /**
     * Handles files picked via ActivityResultContracts.OpenMultipleDocuments.
     * Copies each picked file into the app's internal storage under the project folder,
     * updates the Documents list, and updates the DOCUMENTS (n) count.
     */
    fun copyPickedFilesToProject(uris: List<Uri>) {
        if (uris.isEmpty()) return

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isProcessing = true,
                    progressMessage = "Adding ${uris.size} file(s) to project..."
                )
            }

            withContext(Dispatchers.IO) {
                val context = getApplication<Application>()
                val projectDir = getProjectDir()

                uris.forEachIndexed { index, uri ->
                    try {
                        val displayName = getFileNameFromUri(uri) ?: "Doc_${System.currentTimeMillis()}_$index"
                        val destinationFile = File(projectDir, displayName)

                        context.contentResolver.openInputStream(uri)?.use { inStream ->
                            FileOutputStream(destinationFile).use { outStream ->
                                inStream.copyTo(outStream)
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error copying file from URI: $uri", e)
                    }
                }
            }

            // Reload documents from storage and notify UI
            loadProjectDocuments()

            _uiState.update {
                it.copy(
                    isProcessing = false,
                    progressMessage = null,
                    snackbarMessage = "Added ${uris.size} document(s) to project",
                    snackbarActionLabel = null
                )
            }
        }
    }

    /**
     * Triggers export of all project documents as a single consolidated PDF.
     * Saves to device Downloads folder and prepares Snackbar with OPEN action.
     */
    fun exportAllToPdf() {
        val docs = _uiState.value.documents
        if (docs.isEmpty()) return

        val filesToExport = if (_uiState.value.isSelectMode && _uiState.value.selectedIds.isNotEmpty()) {
            docs.filter { _uiState.value.selectedIds.contains(it.id) }.map { it.file }
        } else {
            docs.map { it.file }
        }

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isExporting = true,
                    progressMessage = "Compiling single PDF (${filesToExport.size} docs)..."
                )
            }

            val context = getApplication<Application>()
            val result = PdfExportHelper.exportProjectToSinglePdf(
                context = context,
                files = filesToExport,
                projectName = _uiState.value.projectName
            )

            _uiState.update {
                it.copy(
                    isExporting = false,
                    progressMessage = null,
                    lastExportedUri = result.uri,
                    snackbarMessage = if (result.success) "Saved to Downloads: ${result.fileName}" else "Export failed: ${result.error}",
                    snackbarActionLabel = if (result.success && result.uri != null) "OPEN" else null
                )
            }
        }
    }

    /**
     * Toggles selection mode and selected items.
     */
    fun toggleSelectMode(enabled: Boolean) {
        _uiState.update {
            it.copy(
                isSelectMode = enabled,
                selectedIds = if (!enabled) emptySet() else it.selectedIds
            )
        }
    }

    fun toggleItemSelection(id: String) {
        _uiState.update { state ->
            val set = state.selectedIds.toMutableSet()
            if (set.contains(id)) {
                set.remove(id)
            } else {
                set.add(id)
            }
            state.copy(
                selectedIds = set,
                isSelectMode = set.isNotEmpty() || state.isSelectMode
            )
        }
    }

    fun selectAll() {
        _uiState.update { state ->
            state.copy(
                isSelectMode = true,
                selectedIds = state.documents.map { it.id }.toSet()
            )
        }
    }

    fun deleteSelected() {
        viewModelScope.launch(Dispatchers.IO) {
            val toDelete = _uiState.value.documents.filter { _uiState.value.selectedIds.contains(it.id) }
            toDelete.forEach { item ->
                try {
                    item.file.delete()
                } catch (e: Exception) {
                    Log.w(TAG, "Cannot delete file: ${item.file.name}", e)
                }
            }
            loadProjectDocuments()
            _uiState.update { it.copy(selectedIds = emptySet(), isSelectMode = false) }
        }
    }

    fun clearSnackbar() {
        _uiState.update { it.copy(snackbarMessage = null, snackbarActionLabel = null) }
    }

    fun renameProject(newName: String) {
        val trimmed = newName.trim()
        if (trimmed.isNotEmpty()) {
            _uiState.update { it.copy(projectName = trimmed) }
        }
    }

    private fun getFileNameFromUri(uri: Uri): String? {
        val resolver = getApplication<Application>().contentResolver
        var name: String? = null
        try {
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) {
                        name = cursor.getString(idx)
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Cannot resolve file name from Uri", e)
        }
        return name ?: uri.lastPathSegment
    }

    private fun decodeSampledBitmap(file: File, reqWidth: Int, reqHeight: Int): Bitmap? {
        return try {
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, options)
            options.inSampleSize = calculateInSampleSize(options, reqWidth, reqHeight)
            options.inJustDecodeBounds = false
            BitmapFactory.decodeFile(file.absolutePath, options)
        } catch (e: Exception) {
            null
        }
    }

    private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
        val (height: Int, width: Int) = options.run { outHeight to outWidth }
        var inSampleSize = 1
        if (height > reqHeight || width > reqWidth) {
            val halfHeight: Int = height / 2
            val halfWidth: Int = width / 2
            while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }
}
