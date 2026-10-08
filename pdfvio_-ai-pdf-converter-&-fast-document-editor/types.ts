
export enum ToolCategory {
  CONVERT = 'convert',
  ORGANIZE = 'organize',
  SECURITY = 'security',
  OPTIMIZE = 'optimize',
  EDIT = 'edit'
}

export interface PDFTool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;
  path: string;
  color: string;
  isNew?: boolean;
  isPopular?: boolean;
  hidden?: boolean;
}

export interface ProcessingState {
  status: 'idle' | 'loading' | 'processing' | 'success' | 'error';
  progress: number;
  message?: string;
  resultUrl?: string;
  resultFileName?: string;
}

export interface AndroidBridgeInterface {
  shareFile?: (base64Data: string, fileName: string) => void;
  showInterstitialAd?: () => void;
  showInterstitialAdForDownload?: () => void;
  showAd?: () => void;
  showInterstitial?: () => void;
  showBannerAd?: (page?: string) => void;
  refreshBannerAd?: (page?: string) => void;
  hideBannerAd?: () => void;
  [key: string]: unknown;
}
