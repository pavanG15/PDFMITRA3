package com.pixelpro.app.compose

import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel

// Design Tokens matching PixelPro Dark Style
val DarkBackground = Color(0xFF020617)
val CardSurface = Color(0xFF0F172A)
val CardSurfaceLight = Color(0x0DFFFFFF)
val PrimaryTeal = Color(0xFF14B8A6)
val PrimaryTealGlow = Color(0x5914B8A6)
val TextMuted = Color(0x66FFFFFF)
val BorderSubtle = Color(0x1AFFFFFF)

/**
 * Scan Documents Screen (Jetpack Compose Material 3)
 * 
 * Features:
 * - 1. ADD FILE Button: Picks PDF, DOCX, TXT, images using OpenMultipleDocuments,
 *   copies each to internal storage under project folder, updates DOCUMENTS (n) count.
 * - 2. DOWNLOAD SCAN Button: Positioned next to ADD FILE, exports single PDF via MediaStore,
 *   shows Snackbar with "OPEN" action, disabled when count is 0.
 * - 3. FAB Behavior: Teal camera FAB as "Scan", small grey download FAB above it calling
 *   the exact same Download Scan logic.
 * - 4. UI Style: Dark theme (#020617), teal (#14B8A6), 16-20dp rounded corners,
 *   letter-spaced uppercase labels, subtle glow on active buttons.
 * - 5. Empty State & List State: Thumbnail grid, tap to open, long-press to multi-select.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanDocumentsScreen(
    onNavigateBack: () -> Unit = {},
    onLaunchCameraScan: () -> Unit = {},
    viewModel: ScanDocumentsViewModel = viewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var showTopMenu by remember { mutableStateOf(false) }
    var showQuickAddMenu by remember { mutableStateOf(false) }

    // Multi-Document File Picker Launcher (PDF, DOCX, TXT, Images)
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) {
            viewModel.copyPickedFilesToProject(uris)
        }
    }

    // Handle Snackbar with "OPEN" Action
    LaunchedEffect(uiState.snackbarMessage) {
        val message = uiState.snackbarMessage
        if (!message.isNullOrEmpty()) {
            val actionLabel = uiState.snackbarActionLabel
            val result = snackbarHostState.showSnackbar(
                message = message,
                actionLabel = actionLabel,
                duration = SnackbarDuration.Short
            )
            if (result == SnackbarResult.ActionPerformed && uiState.lastExportedUri != null) {
                PdfExportHelper.openPdf(context, uiState.lastExportedUri!!)
            }
            viewModel.clearSnackbar()
        }
    }

    Scaffold(
        containerColor = DarkBackground,
        snackbarHost = {
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.padding(bottom = 76.dp)
            )
        },
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = DarkBackground,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                ),
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White.copy(alpha = 0.8f)
                        )
                    }
                },
                title = {
                    Column {
                        Text(
                            text = uiState.projectName.uppercase(),
                            color = PrimaryTeal,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.2.sp
                        )
                        Text(
                            text = if (uiState.isSelectMode) {
                                "${uiState.selectedIds.size} SELECTED"
                            } else {
                                "DOCUMENTS (${uiState.documents.size})"
                            },
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 0.5.sp
                        )
                    }
                },
                actions = {
                    if (uiState.isSelectMode) {
                        IconButton(onClick = { viewModel.toggleSelectMode(false) }) {
                            Icon(Icons.Default.Close, contentDescription = "Exit Selection", tint = Color.White)
                        }
                    } else {
                        IconButton(onClick = { viewModel.toggleSelectMode(true) }) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = "Select Mode",
                                tint = Color.White.copy(alpha = 0.6f)
                            )
                        }
                        IconButton(onClick = { showTopMenu = true }) {
                            Icon(
                                Icons.Default.MoreVert,
                                contentDescription = "Options",
                                tint = Color.White.copy(alpha = 0.6f)
                            )
                        }
                        DropdownMenu(
                            expanded = showTopMenu,
                            onDismissRequest = { showTopMenu = false },
                            modifier = Modifier.background(CardSurface)
                        ) {
                            DropdownMenuItem(
                                text = { Text("Select All Pages", color = Color.White, fontSize = 12.sp) },
                                onClick = {
                                    showTopMenu = false
                                    viewModel.selectAll()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Export Project to PDF", color = PrimaryTeal, fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                                onClick = {
                                    showTopMenu = false
                                    viewModel.exportAllToPdf()
                                }
                            )
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            if (!uiState.isSelectMode) {
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(bottom = 16.dp, end = 8.dp)
                ) {
                    // Quick Add Menu Dropdown
                    DropdownMenu(
                        expanded = showQuickAddMenu,
                        onDismissRequest = { showQuickAddMenu = false },
                        modifier = Modifier.background(CardSurface)
                    ) {
                        DropdownMenuItem(
                            text = { Text("Scan Page (Camera)", color = Color.White, fontSize = 12.sp) },
                            leadingIcon = { Icon(Icons.Default.PhotoCamera, contentDescription = null, tint = PrimaryTeal) },
                            onClick = {
                                showQuickAddMenu = false
                                onLaunchCameraScan()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Upload Images (Gallery)", color = Color.White, fontSize = 12.sp) },
                            leadingIcon = { Icon(Icons.Default.PhotoLibrary, contentDescription = null, tint = Color.White.copy(alpha = 0.8f)) },
                            onClick = {
                                showQuickAddMenu = false
                                filePickerLauncher.launch(arrayOf("image/*"))
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Add Document (PDF, DOCX, TXT)", color = Color.White, fontSize = 12.sp) },
                            leadingIcon = { Icon(Icons.Default.UploadFile, contentDescription = null, tint = PrimaryTeal) },
                            onClick = {
                                showQuickAddMenu = false
                                filePickerLauncher.launch(
                                    arrayOf(
                                        "application/pdf",
                                        "image/*",
                                        "text/plain",
                                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                        "application/msword"
                                    )
                                )
                            }
                        )
                    }

                    // Simple Plus (+) Icon Floating Action Button: placed above Download and Camera
                    FloatingActionButton(
                        onClick = { showQuickAddMenu = !showQuickAddMenu },
                        shape = CircleShape,
                        containerColor = if (showQuickAddMenu) PrimaryTeal else Color(0xFF1E293B),
                        contentColor = if (showQuickAddMenu) Color(0xFF020617) else PrimaryTeal,
                        elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 6.dp),
                        modifier = Modifier
                            .size(48.dp)
                            .border(1.dp, PrimaryTeal.copy(alpha = 0.4f), CircleShape)
                    ) {
                        Icon(
                            imageVector = if (showQuickAddMenu) Icons.Default.Close else Icons.Default.Add,
                            contentDescription = "Add Document or Image",
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    // Small Grey Download FAB: Calls exact same Download Scan logic
                    FloatingActionButton(
                        onClick = { viewModel.exportAllToPdf() },
                        shape = CircleShape,
                        containerColor = if (uiState.documents.isNotEmpty()) Color(0xFF1E293B) else Color(0xFF0F172A),
                        contentColor = if (uiState.documents.isNotEmpty()) Color.White else Color(0x33FFFFFF),
                        elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 6.dp),
                        modifier = Modifier
                            .size(48.dp)
                            .border(1.dp, BorderSubtle, CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Download,
                            contentDescription = "Download Scan",
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    // Teal Camera FAB: Launches native document scanner
                    FloatingActionButton(
                        onClick = onLaunchCameraScan,
                        shape = RoundedCornerShape(18.dp),
                        containerColor = PrimaryTeal,
                        contentColor = Color(0xFF020617),
                        elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 10.dp),
                        modifier = Modifier
                            .size(60.dp)
                            .shadow(12.dp, RoundedCornerShape(18.dp), ambientColor = PrimaryTeal, spotColor = PrimaryTeal)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PhotoCamera,
                            contentDescription = "Scan Page",
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkBackground)
        ) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                // Top Row: 1. SCAN PAGE card & 2. UPLOAD IMAGES card
                if (!uiState.isSelectMode) {
                    item {
                        ScanPageCard(onClick = onLaunchCameraScan)
                    }
                    item {
                        UploadImagesCard(onClick = {
                            filePickerLauncher.launch(arrayOf("image/*"))
                        })
                    }

                    // FULL-WIDTH ROUNDED BUTTON ROW DIRECTLY BELOW THE TWO CARDS
                    item(span = { GridItemSpan(2) }) {
                        ActionButtonsRow(
                            onAddFileClick = {
                                // Picks PDF, DOCX, TXT, and Images
                                filePickerLauncher.launch(
                                    arrayOf(
                                        "application/pdf",
                                        "image/*",
                                        "text/plain",
                                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                        "application/msword"
                                    )
                                )
                            },
                            onDownloadScanClick = {
                                viewModel.exportAllToPdf()
                            },
                            hasDocuments = uiState.documents.isNotEmpty(),
                            documentCount = uiState.documents.size,
                            isExporting = uiState.isExporting
                        )
                    }
                }

                // EMPTY STATE: Shown when project has 0 documents
                if (uiState.documents.isEmpty()) {
                    item(span = { GridItemSpan(2) }) {
                        EmptyStateCard()
                    }
                } else {
                    // DOCUMENT LIST STATE: Grid of thumbnails with file name
                    items(uiState.documents, key = { it.id }) { doc ->
                        DocumentThumbnailCard(
                            document = doc,
                            isSelected = uiState.selectedIds.contains(doc.id),
                            isSelectMode = uiState.isSelectMode,
                            onTap = {
                                if (uiState.isSelectMode) {
                                    viewModel.toggleItemSelection(doc.id)
                                } else {
                                    // Tap to open / view document
                                    val uri = Uri.fromFile(doc.file)
                                    PdfExportHelper.openPdf(context, uri)
                                }
                            },
                            onLongPress = {
                                viewModel.toggleItemSelection(doc.id)
                            }
                        )
                    }
                }

                // Bottom spacer for FAB clearance
                item(span = { GridItemSpan(2) }) {
                    Spacer(modifier = Modifier.height(84.dp))
                }
            }

            // Multi-Select Floating Footer Bar
            AnimatedVisibility(
                visible = uiState.isSelectMode,
                enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
                modifier = Modifier.align(Alignment.BottomCenter)
            ) {
                MultiSelectFooter(
                    selectedCount = uiState.selectedIds.size,
                    onDelete = { viewModel.deleteSelected() },
                    onExport = { viewModel.exportAllToPdf() },
                    onCancel = { viewModel.toggleSelectMode(false) }
                )
            }

            // Exporting / Processing Overlay
            if (uiState.isProcessing || uiState.isExporting) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.7f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        CircularProgressIndicator(color = PrimaryTeal)
                        Text(
                            text = uiState.progressMessage ?: "Processing...",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

/**
 * 1. "SCAN PAGE" Card (Teal dashed border, camera icon)
 */
@Composable
fun ScanPageCard(onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = PrimaryTeal.copy(alpha = 0.08f)),
        modifier = Modifier
            .aspectRatio(0.75f)
            .border(2.dp, PrimaryTeal.copy(alpha = 0.4f), RoundedCornerShape(18.dp))
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(PrimaryTeal.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PhotoCamera,
                    contentDescription = null,
                    tint = PrimaryTeal,
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "SCAN PAGE",
                color = PrimaryTeal,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.5.sp
            )
            Text(
                text = "Camera / Scanner",
                color = PrimaryTeal.copy(alpha = 0.6f),
                fontSize = 8.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

/**
 * 2. "UPLOAD IMAGES" Card (Gallery picker)
 */
@Composable
fun UploadImagesCard(onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = CardSurfaceLight),
        modifier = Modifier
            .aspectRatio(0.75f)
            .border(2.dp, BorderSubtle, RoundedCornerShape(18.dp))
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White.copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PhotoLibrary,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.6f),
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "UPLOAD IMAGES",
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.5.sp
            )
            Text(
                text = "From Gallery",
                color = TextMuted,
                fontSize = 8.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

/**
 * Full-width rounded button row directly below the two cards.
 * Contains:
 * - ADD FILE: Multi-document picker for PDF, DOCX, TXT, images.
 * - DOWNLOAD SCAN: Direct PDF export to Downloads with subtle glow, disabled if 0 documents.
 */
@Composable
fun ActionButtonsRow(
    onAddFileClick: () -> Unit,
    onDownloadScanClick: () -> Unit,
    hasDocuments: Boolean,
    documentCount: Int,
    isExporting: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // ADD FILE Button
        Button(
            onClick = onAddFileClick,
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = CardSurface,
                contentColor = PrimaryTeal
            ),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
            modifier = Modifier
                .weight(1f)
                .height(60.dp)
                .border(1.dp, PrimaryTeal.copy(alpha = 0.35f), RoundedCornerShape(18.dp))
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(PrimaryTeal.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.UploadFile,
                        contentDescription = "Add File",
                        tint = PrimaryTeal,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "ADD FILE",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.2.sp
                    )
                    Text(
                        text = "PDF, DOCX, TXT, IMG",
                        color = PrimaryTeal.copy(alpha = 0.8f),
                        fontSize = 7.5.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    )
                }
            }
        }

        // DOWNLOAD SCAN Button
        Button(
            onClick = onDownloadScanClick,
            enabled = hasDocuments && !isExporting,
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (hasDocuments) PrimaryTeal else CardSurfaceLight,
                contentColor = if (hasDocuments) Color(0xFF020617) else TextMuted,
                disabledContainerColor = Color.White.copy(alpha = 0.05f),
                disabledContentColor = Color.White.copy(alpha = 0.25f)
            ),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
            modifier = Modifier
                .weight(1f)
                .height(60.dp)
                .then(
                    if (hasDocuments) {
                        Modifier.shadow(8.dp, RoundedCornerShape(18.dp), spotColor = PrimaryTealGlow)
                    } else {
                        Modifier.border(1.dp, BorderSubtle, RoundedCornerShape(18.dp))
                    }
                )
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            if (hasDocuments) Color.Black.copy(alpha = 0.15f)
                            else Color.White.copy(alpha = 0.05f)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Download,
                        contentDescription = "Download Scan",
                        modifier = Modifier.size(18.dp)
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "DOWNLOAD SCAN",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.2.sp
                    )
                    Text(
                        text = if (hasDocuments) "Export Single PDF ($documentCount)" else "0 Documents",
                        fontSize = 7.5.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    )
                }
            }
        }
    }
}

/**
 * Empty State Card (Displayed when document count is 0)
 */
@Composable
fun EmptyStateCard() {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = CardSurfaceLight),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp)
            .border(1.dp, BorderSubtle, RoundedCornerShape(20.dp))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(PrimaryTeal.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.UploadFile,
                    contentDescription = null,
                    tint = PrimaryTeal,
                    modifier = Modifier.size(28.dp)
                )
            }
            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = "NO DOCUMENTS IN THIS PROJECT",
                color = Color.White.copy(alpha = 0.9f),
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.2.sp
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Use Scan Page, Upload Images, or Add File to import PDF, DOCX, TXT or photo scans to this project.",
                color = TextMuted,
                fontSize = 10.sp,
                textAlign = TextAlign.Center,
                lineHeight = 14.sp
            )
        }
    }
}

/**
 * Document Thumbnail Card in Grid
 * Supports:
 * - Tap to open / view document
 * - Long-press to trigger multi-selection
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun DocumentThumbnailCard(
    document: ScanDocumentsViewModel.DocumentItem,
    isSelected: Boolean,
    isSelectMode: Boolean,
    onTap: () -> Unit,
    onLongPress: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = CardSurface),
        modifier = Modifier
            .aspectRatio(0.75f)
            .border(
                width = if (isSelected) 2.5.dp else 1.dp,
                color = if (isSelected) PrimaryTeal else BorderSubtle,
                shape = RoundedCornerShape(18.dp)
            )
            .combinedClickable(
                onClick = onTap,
                onLongClick = onLongPress
            )
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            if (document.thumbnail != null) {
                Image(
                    bitmap = document.thumbnail.asImageBitmap(),
                    contentDescription = document.name,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                // Generic file thumbnail with file extension badge
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF1E293B)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.UploadFile,
                            contentDescription = null,
                            tint = PrimaryTeal,
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = document.file.extension.uppercase(),
                            color = PrimaryTeal,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                }
            }

            // Selection Checkmark Overlay
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(PrimaryTeal.copy(alpha = 0.25f)),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(PrimaryTeal),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Selected",
                            tint = Color(0xFF020617),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }

            // Bottom Name Banner
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .background(Color.Black.copy(alpha = 0.75f))
                    .padding(horizontal = 8.dp, vertical = 6.dp)
            ) {
                Column {
                    Text(
                        text = document.name,
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "${document.dateFormatted} • ${document.sizeFormatted}",
                        color = Color.White.copy(alpha = 0.5f),
                        fontSize = 8.sp
                    )
                }
            }
        }
    }
}

/**
 * Multi-Select Action Footer
 */
@Composable
fun MultiSelectFooter(
    selectedCount: Int,
    onDelete: () -> Unit,
    onExport: () -> Unit,
    onCancel: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        colors = CardDefaults.cardColors(containerColor = CardSurface),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, BorderSubtle, RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Button(
                onClick = onDelete,
                enabled = selectedCount > 0,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0x33F43F5E),
                    contentColor = Color(0xFFFB7185)
                ),
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Delete ($selectedCount)", fontSize = 11.sp, fontWeight = FontWeight.Black)
            }

            Button(
                onClick = onExport,
                enabled = selectedCount > 0,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = PrimaryTeal,
                    contentColor = Color(0xFF020617)
                ),
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Export ($selectedCount)", fontSize = 11.sp, fontWeight = FontWeight.Black)
            }

            Button(
                onClick = onCancel,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.1f),
                    contentColor = Color.White
                )
            ) {
                Text("Cancel", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
