/**
 * Google AI Document & Image Scanner Utility
 * Uses Google Gemini Free API (server-side proxy /api/scan-image)
 * for high-accuracy OCR, document identification, and data extraction.
 */

export interface GoogleScanFields {
  name?: string | null;
  idNumber?: string | null;
  dobOrYob?: string | null;
  gender?: string | null;
  fatherOrHusbandName?: string | null;
  address?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
}

export interface GoogleScanResult {
  success: boolean;
  extractedText: string;
  documentType: string;
  language: string;
  summary: string;
  scanQuality: 'excellent' | 'good' | 'fair' | 'poor' | string;
  qualityTips?: string;
  fields?: GoogleScanFields;
  error?: string;
}

export interface BatchScanResultItem {
  id: string;
  name: string;
  text: string;
  success: boolean;
}

/**
 * Scan a single image using the free Google Gemini API
 */
export async function scanImageWithGoogleAI(
  imageData: string,
  options: {
    mode?: 'ocr' | 'aadhaar_extract' | 'full_analysis';
    prompt?: string;
    mimeType?: string;
  } = {}
): Promise<GoogleScanResult> {
  const { mode = 'ocr', prompt, mimeType = 'image/jpeg' } = options;

  try {
    const res = await fetch('/api/scan-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageData,
        mimeType,
        mode,
        prompt,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error || `Server responded with ${res.status}`);
    }

    const data: GoogleScanResult = await res.json();
    return data;
  } catch (error: any) {
    console.error('[Google AI Scanner] Error:', error);
    return {
      success: false,
      extractedText: '',
      documentType: 'Unknown',
      language: '',
      summary: '',
      scanQuality: 'fair',
      error: error.message || 'Unable to scan image with Google AI',
    };
  }
}

/**
 * Batch scan multiple pages in a document
 */
export async function batchScanPagesWithGoogleAI(
  pages: Array<{ id: string; name: string; image: string; mimeType?: string }>
): Promise<BatchScanResultItem[]> {
  try {
    const res = await fetch('/api/scan-document-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pages }),
    });

    if (!res.ok) {
      throw new Error(`Batch scan failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.results || [];
  } catch (error: any) {
    console.error('[Google AI Batch Scanner] Error:', error);
    return pages.map((p) => ({
      id: p.id,
      name: p.name,
      text: `[Google AI Scan failed: ${error.message}]`,
      success: false,
    }));
  }
}
