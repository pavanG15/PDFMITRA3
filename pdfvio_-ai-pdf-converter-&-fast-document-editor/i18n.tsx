import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'hi' | 'mr';

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', flag: '🚩' },
];

export const translations = {
  en: {
    // Brand & Header
    brandName: 'Aadhaar in One Page',
    brandTagline: 'PDF Tools & Suite',
    home: 'Home',
    tools: 'Tools',
    blog: 'Blog',
    legal: 'Legal',
    support: 'Support',
    darkMode: 'Dark Mode',
    lightMode: 'Day Mode',
    dayMode: 'Day Mode',
    language: 'Language',
    selectLanguage: 'Select Language',

    // Home
    searchPlaceholder: 'What do you need to do? (e.g. Aadhaar merge, split, compress)',
    catAll: 'All',
    catConvert: 'Convert',
    catOrganize: 'Organize',
    catSecurity: 'Security',
    catEdit: 'Edit',
    catOptimize: 'Optimize',
    hotTool: 'Popular',
    newTool: 'New',
    proInsights: 'Pro Insights & Guides',
    seeAll: 'See All',
    readArticle: 'Read Guide',

    // Aadhaar in One Page Tool
    aadhaarBadge: 'Aadhaar • PAN • Voter ID • Any ID Card',
    aadhaarTitle: 'Aadhaar or Any ID Card in One Page',
    aadhaarSubtitle: 'Combine Front & Back of Aadhaar, PAN, Voter ID, Driving License, or Any ID Card onto a single A4 page ready for Xerox & Print.',
    aadhaarDesc: 'Combine both sides of Aadhaar or any government/official ID card onto a single standard A4 page. 100% secure in your browser, perfect for Bank KYC, UIDAI verification, government exams, and xerox printing.',
    cardSupportPills: 'Aadhaar • PAN Card • Voter ID • Driving License • College/Office ID',
    printSize: 'Print Size:',
    standardId: 'Standard ID (100mm)',
    fullWidth: 'Full Width (160mm)',
    dashedCuttingLines: 'Dashed Cutting Lines',
    highPrintRes: 'High Print Res (300 DPI)',
    frontCardGovt: 'भारत सरकार • GOI',
    frontSideBadge: 'Front',
    frontPhotoLabel: 'PHOTO',
    frontSampleNumber: 'XXXX XXXX 1234',
    frontAadhaarWord: 'आधार',
    uploadFrontBtn: 'Upload Front Side',
    frontFormatHint: 'Photo & Name • JPG, PNG',
    backCardAddress: 'पत्ता / Address',
    backSideBadge: 'Back',
    backHelpline: 'हेल्पलाइन: 1947',
    uploadBackBtn: 'Upload Back Side',
    backFormatHint: 'Address & QR Code • JPG, PNG',
    replaceFront: 'Change Front',
    replaceBack: 'Change Back',
    mergeActionBtn: 'Merge into Single A4 PDF',
    generatingPdf: 'Generating A4 PDF...',
    successTitle: 'Aadhaar Card Merged Successfully!',
    successDesc: 'Your front and back Aadhaar card images have been merged into a single page A4 PDF ready for print, KYC, and xerox.',
    downloadPdf: 'Download A4 PDF',
    mergeAnother: 'Merge Another Card',
    privacyNotice: '100% Private: Photos stay securely on your device, never uploaded to any server.',
    swapSides: 'Swap Front & Back',
    frontSide: 'Front Side',
    backSide: 'Back Side',
    frontCardSummary: 'Photo, Name, Aadhaar No.',
    backCardSummary: 'Address & QR Code',

    // Camera & Upload Actions
    cameraBtn: 'Camera',
    uploadBtn: 'Upload File',
    takePhotoWithCamera: 'Take Photo with Camera',
    chooseFromGallery: 'Choose from Files/Gallery',
    rotatePhoto: 'Rotate 90°',
    removePhoto: 'Remove',
    capturePhotoModal: 'Capture Aadhaar Photo',
    capturePhotoBtn: 'Click Photo',
    switchCameraBtn: 'Flip Camera',
    closeCamera: 'Cancel',

    // Live A4 Preview
    livePreviewTitle: 'Live A4 PDF Preview',
    livePreviewSubtitle: 'Shows exactly how your printout will look on standard A4 sheet',
    a4PageHint: 'A4 Page (210 × 297 mm)',
    readyToPrint: 'Xerox & Print Ready',
    frontSideLabel: 'FRONT SIDE (समोरची बाजू)',
    backSideLabel: 'BACK SIDE (मागील बाजू)',

    // Hero Section on Home
    heroBadge: '★ Hero Feature • मुख्य साधन',
    heroTitle: 'Aadhaar or Any ID Card in One Page',
    heroTagline: 'Merge Front & Back of Aadhaar, PAN Card, Voter ID, Driving License, or Any ID Card onto a single A4 page in 1 Click.',
    heroCta: 'Start Merging Now',
    heroFeatCamera: 'Camera & Gallery Upload',
    heroFeatA4: 'Standard A4 Xerox Ready',
    heroFeatPrivate: '100% Private in Browser',

    // How-to steps
    howToTitle: 'How to Merge Aadhaar or Any ID Card Front and Back to One PDF',
    step1Title: '1. Upload Front Side',
    step1Desc: 'Upload a clear photo or scan of your card front showing photo, name, and identity details.',
    step2Title: '2. Upload Back Side',
    step2Desc: 'Upload the reverse side containing address, details, and barcode/QR code.',
    step3Title: '3. Get Merged A4 PDF',
    step3Desc: 'Click Merge to generate an officially formatted single-page A4 document with cut guides, ready for printing.',

    // Common Tool Names
    toolAadhaarName: 'Aadhaar / Any ID Card',
    toolAadhaarDesc: 'Merge front & back of Aadhaar, PAN, or Any ID Card into a single page A4 PDF for print & KYC.',
    toolMergeName: 'Merge PDF',
    toolMergeDesc: 'Combine multiple PDFs into one unified document instantly.',
    toolSplitName: 'Split PDF',
    toolSplitDesc: 'Separate pages or extract specific sections from your PDF file.',
    toolCompressName: 'Compress PDF',
    toolCompressDesc: 'Reduce PDF file size while maintaining optimum visual quality.',
    toolJpgToPdfName: 'JPG to PDF',
    toolJpgToPdfDesc: 'Convert pictures and images into a single clean PDF file.',
    toolPdfToJpgName: 'PDF to JPG',
    toolPdfToJpgDesc: 'Convert PDF pages into high-resolution JPG images.',
    toolScanName: 'Scan Documents',
    toolScanDesc: 'Scan documents, ID cards, and receipts using your camera.',

    // Footer
    footerTagline: 'Fast, secure, and private PDF utility suite. 100% client-side document processing directly in your browser.',
    quickLinks: 'Quick Links',
    popularTools: 'Popular Tools',
    legalPrivacy: 'Legal & Privacy',
    aboutUs: 'About Us',
    contactUs: 'Contact',
    disclaimer: 'Disclaimer',
    allRightsReserved: 'All rights reserved. Secure offline browser processing.',
  },

  hi: {
    // Brand & Header
    brandName: 'Aadhaar in One Page',
    brandTagline: 'पीडीएफ टूल्स और सुइट',
    home: 'होम',
    tools: 'टूल्स',
    blog: 'ब्लॉग',
    legal: 'कानूनी',
    support: 'सपोर्ट',
    darkMode: 'डार्क मोड',
    lightMode: 'डे मोड',
    dayMode: 'डे मोड',
    language: 'भाषा',
    selectLanguage: 'भाषा चुनें',

    // Home
    searchPlaceholder: 'आपको क्या करना है? (जैसे: आधार मर्ज, स्प्लिट, कंप्रेस)',
    catAll: 'सभी',
    catConvert: 'कन्वर्ट',
    catOrganize: 'ऑर्गेनाइज',
    catSecurity: 'सुरक्षा',
    catEdit: 'एडिट',
    catOptimize: 'ऑप्टिमाइज़',
    hotTool: 'लोकप्रिय',
    newTool: 'नया',
    proInsights: 'महत्वपूर्ण गाइड्स और टिप्स',
    seeAll: 'सभी देखें',
    readArticle: 'गाइड पढ़ें',

    // Aadhaar in One Page Tool
    aadhaarBadge: 'आधार • पैन • वोटर आईडी • कोई भी ID कार्ड',
    aadhaarTitle: 'एक पेज पर आधार या कोई भी ID कार्ड करें',
    aadhaarSubtitle: 'आधार, पैन, वोटर कार्ड, ड्राइविंग लाइसेंस या किसी भी आईडी कार्ड के दोनों हिस्से एक ही A4 पेज पर ज़ेरॉक्स व प्रिंट के लिए जोड़ें।',
    aadhaarDesc: 'अपने आधार कार्ड, पैन कार्ड, वोटर कार्ड या किसी भी आईडी कार्ड के दोनों हिस्सों (आगे और पीछे का भाग) को एक ही मानक A4 पेज पर जोड़ें। 100% सुरक्षित, बैंक केवाईसी, सरकारी नौकरियों और ज़ेरॉक्स प्रिंटिंग के लिए बिल्कुल सही।',
    cardSupportPills: 'आधार • पैन कार्ड • वोटर आईडी • ड्राइविंग लाइसेंस • कॉलेज/ऑफिस ID',
    printSize: 'प्रिंट साइज:',
    standardId: 'स्टैंडर्ड आईडी (100mm)',
    fullWidth: 'फुल साइज (160mm)',
    dashedCuttingLines: 'काटने के लिए डैश लाइन्स',
    highPrintRes: 'हाई प्रिंट रेजोल्यूशन (300 DPI)',
    frontCardGovt: 'भारत सरकार • GOI',
    frontSideBadge: 'आगे का भाग',
    frontPhotoLabel: 'फोटो',
    frontSampleNumber: 'XXXX XXXX 1234',
    frontAadhaarWord: 'आधार',
    uploadFrontBtn: 'आगे का भाग अपलोड करें',
    frontFormatHint: 'फोटो और नाम • JPG, PNG',
    backCardAddress: 'पता / Address',
    backSideBadge: 'पीछे का भाग',
    backHelpline: 'हेल्पलाइन: 1947',
    uploadBackBtn: 'पीछे का भाग अपलोड करें',
    backFormatHint: 'पता और क्यूआर कोड • JPG, PNG',
    replaceFront: 'आगे का फोटो बदलें',
    replaceBack: 'पीछे का फोटो बदलें',
    mergeActionBtn: 'एक पेज A4 पीडीएफ बनाएं',
    generatingPdf: 'A4 पीडीएफ तैयार हो रही है...',
    successTitle: 'आधार कार्ड पीडीएफ सफलतापूर्वक तैयार हो गया!',
    successDesc: 'आपके आधार कार्ड के दोनों हिस्से एक ही A4 पीडीएफ पर जुड़ गए हैं, जो प्रिंट, केवाईसी और ज़ेरॉक्स के लिए तैयार हैं।',
    downloadPdf: 'A4 पीडीएफ डाउनलोड करें',
    mergeAnother: 'दूसरा कार्ड जोड़ें',
    privacyNotice: '100% सुरक्षित: आपकी फोटो सर्वर पर कभी नहीं जाती, सीधे आपके फोन में प्रोसेस होती है।',
    swapSides: 'आगे-पीछे बदलें',
    frontSide: 'आगे का भाग',
    backSide: 'पीछे का भाग',
    frontCardSummary: 'फोटो, नाम, आधार नंबर',
    backCardSummary: 'पता व क्यूआर कोड',

    // Camera & Upload Actions
    cameraBtn: 'कैमरा',
    uploadBtn: 'फ़ाइल अपलोड',
    takePhotoWithCamera: 'कैमरे से फोटो खींचें',
    chooseFromGallery: 'गैलरी/फ़ाइल से चुनें',
    rotatePhoto: '90° घुमाएं',
    removePhoto: 'हटाएं',
    capturePhotoModal: 'आधार कार्ड फोटो खींचें',
    capturePhotoBtn: 'फोटो लें',
    switchCameraBtn: 'कैमरा बदलें',
    closeCamera: 'रद्द करें',

    // Live A4 Preview
    livePreviewTitle: 'A4 प्रिंट पूर्वावलोकन',
    livePreviewSubtitle: 'प्रिंट करने पर आपका A4 पेज बिल्कुल ऐसा दिखेगा',
    a4PageHint: 'A4 पेज (210 × 297 mm)',
    readyToPrint: 'ज़ेरॉक्स व प्रिंट तैयार',
    frontSideLabel: 'FRONT SIDE (सामने का भाग)',
    backSideLabel: 'BACK SIDE (पीछे का भाग)',

    // Hero Section on Home
    heroBadge: '★ मुख्य टूल • विशेष',
    heroTitle: 'एक पेज पर आधार या कोई भी ID कार्ड करें',
    heroTagline: 'आधार कार्ड, पैन कार्ड, वोटर आईडी, ड्राइविंग लाइसेंस या कोई भी आईडी कार्ड 1 क्लिक में एक ही A4 पेज पर लाएं (ज़ेरॉक्स व प्रिंट हेतु)।',
    heroCta: 'अभी शुरू करें',
    heroFeatCamera: 'कैमरा व फ़ाइल अपलोड',
    heroFeatA4: 'मानक A4 ज़ेरॉक्स रेडी',
    heroFeatPrivate: '100% सुरक्षित फोन में ही',

    // How-to steps
    howToTitle: 'आधार या किसी भी ID कार्ड के दोनों हिस्से एक पेज पर कैसे जोड़ें?',
    step1Title: '1. सामने का भाग अपलोड करें',
    step1Desc: 'कार्ड के सामने का स्पष्ट फोटो या स्कैन अपलोड करें जिसमें फोटो, नाम और विवरण साफ दिखे।',
    step2Title: '2. पीछे का भाग अपलोड करें',
    step2Desc: 'कार्ड के पीछे का फोटो अपलोड करें जिसमें पता, विवरण और बारकोड/क्यूआर कोड दिखे।',
    step3Title: '3. एक पेज A4 पीडीएफ पाएं',
    step3Desc: 'मर्ज बटन पर क्लिक करके कटिंग गाइड के साथ एक पेज का A4 दस्तावेज तुरंत प्राप्त करें, प्रिंटिंग के लिए तैयार।',

    // Common Tool Names
    toolAadhaarName: 'आधार / कोई भी ID कार्ड',
    toolAadhaarDesc: 'आधार, पैन, वोटर या किसी भी आईडी कार्ड को एक ही A4 पेज पर प्रिंट और केवाईसी के लिए जोड़ें।',
    toolMergeName: 'पीडीएफ मर्ज करें',
    toolMergeDesc: 'कई पीडीएफ फाइलों को तुरंत एक ही दस्तावेज में जोड़ें।',
    toolSplitName: 'पीडीएफ विभाजित करें',
    toolSplitDesc: 'पीडीएफ से पेज अलग करें या विशिष्ट हिस्से निकालें।',
    toolCompressName: 'पीडीएफ कंप्रेस करें',
    toolCompressDesc: 'अच्छी गुणवत्ता बनाए रखते हुए पीडीएफ फाइल का साइज कम करें।',
    toolJpgToPdfName: 'फोटो से पीडीएफ',
    toolJpgToPdfDesc: 'फोटो और छवियों को तुरंत एक साफ पीडीएफ फाइल में बदलें।',
    toolPdfToJpgName: 'पीडीएफ से फोटो',
    toolPdfToJpgDesc: 'पीडीएफ पेजों को हाई रेजोल्यूशन फोटो में बदलें।',
    toolScanName: 'दस्तावेज़ स्कैन',
    toolScanDesc: 'कैमरे से दस्तावेज़ और आईडी कार्ड तुरंत स्कैन करें।',

    // Footer
    footerTagline: 'तेज, सुरक्षित और निजी पीडीएफ टूल्स सुइट। सीधे आपके ब्राउज़र में 100% क्लाइंट-साइड प्रोसेसिंग।',
    quickLinks: 'महत्वपूर्ण लिंक्स',
    popularTools: 'लोकप्रिय टूल्स',
    legalPrivacy: 'नियम और गोपनीयता',
    aboutUs: 'हमारे बारे में',
    contactUs: 'संपर्क करें',
    disclaimer: 'अस्वीकरण',
    allRightsReserved: 'सर्वाधिकार सुरक्षित। सुरक्षित ऑफलाइन ब्राउज़र प्रोसेसिंग।',
  },

  mr: {
    // Brand & Header
    brandName: 'Aadhaar in One Page',
    brandTagline: 'पीडीएफ टूल्स आणि सुट',
    home: 'होम',
    tools: 'टूल्स',
    blog: 'ब्लॉग',
    legal: 'कायदेशीर',
    support: 'सपोर्ट',
    darkMode: 'डार्क मोड',
    lightMode: 'डे मोड',
    dayMode: 'डे मोड',
    language: 'भाषा',
    selectLanguage: 'भाषा निवडा',

    // Home
    searchPlaceholder: 'तुम्हाला काय करायचे आहे? (उदा. आधार कार्ड जोडणे, स्प्लिट, कॉम्प्रेस)',
    catAll: 'सर्व',
    catConvert: 'कन्व्हर्ट',
    catOrganize: 'ऑर्गनाइझ',
    catSecurity: 'सुरक्षा',
    catEdit: 'एडिट',
    catOptimize: 'ऑप्टिमाइझ',
    hotTool: 'लोकप्रिय',
    newTool: 'नवीन',
    proInsights: 'महत्त्वाच्या टिप्स आणि माहिती',
    seeAll: 'सर्व पहा',
    readArticle: 'माहिती वाचा',

    // Aadhaar in One Page Tool
    aadhaarBadge: 'आधार • पॅन • मतदान कार्ड • कोणतेही ID कार्ड',
    aadhaarTitle: 'एका पानावर आधार किंवा कोणतेही ID कार्ड',
    aadhaarSubtitle: 'आधार, पॅन, मतदान कार्ड, ड्रायव्हिंग लायसन्स किंवा कोणत्याही ओळखपत्राची दोन्ही बाजू एकाच A4 पानावर झेरॉक्ससाठी तयार करा.',
    aadhaarDesc: 'तुमच्या आधार कार्ड, पॅन कार्ड, मतदान ओळखपत्र किंवा कोणत्याही ID कार्डच्या दोन्ही बाजू एकाच मानक A4 पानावर एकत्र करा. १००% सुरक्षित, बँक केवायसी, सरकारी कामे आणि झेरॉक्स प्रिंटिंगसाठी अत्यंत उपयुक्त.',
    cardSupportPills: 'आधार • पॅन कार्ड • मतदान कार्ड • ड्रायव्हिंग लायसन्स • कॉलेज/ऑफिस ID',
    printSize: 'प्रिंट साईझ:',
    standardId: 'स्टँडर्ड आयडी (100mm)',
    fullWidth: 'मोठी साईझ (160mm)',
    dashedCuttingLines: 'कापण्यासाठी डॅश लाईन्स',
    highPrintRes: 'हाय प्रिंट रिझोल्यूशन (300 DPI)',
    frontCardGovt: 'भारत सरकार • GOI',
    frontSideBadge: 'समोरची बाजू',
    frontPhotoLabel: 'फोटो',
    frontSampleNumber: 'XXXX XXXX 1234',
    frontAadhaarWord: 'आधार',
    uploadFrontBtn: 'समोरची बाजू अपलोड करा',
    frontFormatHint: 'फोटो आणि नाव • JPG, PNG',
    backCardAddress: 'पत्ता / Address',
    backSideBadge: 'मागील बाजू',
    backHelpline: 'हेल्पलाइन: १९४७',
    uploadBackBtn: 'मागील बाजू अपलोड करा',
    backFormatHint: 'पत्ता आणि क्यूआर कोड • JPG, PNG',
    replaceFront: 'समोरचा फोटो बदला',
    replaceBack: 'मागचा फोटो बदला',
    mergeActionBtn: 'एक पान A4 पीडीएफ बनवा',
    generatingPdf: 'A4 पीडीएफ तयार होत आहे...',
    successTitle: 'आधार कार्ड पीडीएफ यशस्वीरीत्या तयार झाले!',
    successDesc: 'तुमच्या आधार कार्डची समोरची आणि मागील बाजू एकाच A4 पीडीएफवर तयार झाली असून प्रिंट, केवायसी व झेरॉक्ससाठी तयार आहे.',
    downloadPdf: 'A4 पीडीएफ डाउनलोड करा',
    mergeAnother: 'दुसरे कार्ड जोडा',
    privacyNotice: '१००% सुरक्षित: तुमचे फोटो थेट फोनमध्येच राहतात, सर्व्हरवर कधीही जात नाहीत.',
    swapSides: 'समोरची-मागील बाजू बदला',
    frontSide: 'समोरची बाजू',
    backSide: 'मागील बाजू',
    frontCardSummary: 'फोटो, नाव, आधार क्र.',
    backCardSummary: 'पत्ता व क्यूआर कोड',

    // Camera & Upload Actions
    cameraBtn: 'कॅमेरा',
    uploadBtn: 'फाईल अपलोड',
    takePhotoWithCamera: 'कॅमेऱ्याने फोटो काढा',
    chooseFromGallery: 'गॅलरी/फाईल निवडा',
    rotatePhoto: '९०° फिरवा',
    removePhoto: 'हटवा',
    capturePhotoModal: 'आधार कार्ड फोटो काढा',
    capturePhotoBtn: 'फोटो क्लिक करा',
    switchCameraBtn: 'कॅमेरा बदला',
    closeCamera: 'रद्द करा',

    // Live A4 Preview
    livePreviewTitle: 'A4 प्रिंट पूर्वावलोकन',
    livePreviewSubtitle: 'प्रिंट केल्यावर तुमचे A4 पान नक्की कसे दिसेल ते येथे पहा',
    a4PageHint: 'A4 पान (210 × 297 mm)',
    readyToPrint: 'झेरॉक्स व प्रिंटसाठी तयार',
    frontSideLabel: 'FRONT SIDE (समोरची बाजू)',
    backSideLabel: 'BACK SIDE (मागील बाजू)',

    // Hero Section on Home
    heroBadge: '★ मुख्य साधन • विशेष',
    heroTitle: 'एका पानावर आधार किंवा कोणतेही ID कार्ड करा',
    heroTagline: 'आधार कार्ड, पॅन कार्ड, मतदान ओळखपत्र, ड्रायव्हिंग लायसन्स किंवा कोणतेही ID कार्ड एका क्लिकमध्ये A4 पानावर आणा (झेरॉक्स व प्रिंटसाठी).',
    heroCta: 'आता लगेच सुरू करा',
    heroFeatCamera: 'कॅमेरा व फाईल अपलोड',
    heroFeatA4: 'मानक A4 झेरॉक्स तयार',
    heroFeatPrivate: '१००% सुरक्षित फोनमध्येच',

    // How-to steps
    howToTitle: 'आधार किंवा कोणतेही ID कार्ड एकाच पीडीएफ पानावर कसे जोडावे?',
    step1Title: '१. समोरची बाजू अपलोड करा',
    step1Desc: 'कार्डच्या समोरच्या बाजूचा स्पष्ट फोटो किंवा स्कॅन अपलोड करा ज्यावर फोटो, नाव आणि माहिती स्पष्ट दिसेल.',
    step2Title: '२. मागील बाजू अपलोड करा',
    step2Desc: 'कार्डच्या मागच्या बाजूचा फोटो अपलोड करा ज्यावर पत्ता, तपशील किंवा क्यूआर कोड दिसेल.',
    step3Title: '३. एकत्र A4 पीडीएफ मिळवा',
    step3Desc: 'मर्ज बटणावर क्लिक करून कटिंग गाईड्ससह सुटसुटीत A4 डॉक्युमेंट झटपट मिळवा, जे प्रिंटिंग व ऑनलाइन कामासाठी तयार आहे.',

    // Common Tool Names
    toolAadhaarName: 'आधार / कोणतेही ID कार्ड',
    toolAadhaarDesc: 'आधार, पॅन, मतदान किंवा कोणत्याही ओळखपत्राची दोन्ही बाजू एकाच A4 पानावर जोडा.',
    toolMergeName: 'पीडीएफ एकत्र करा',
    toolMergeDesc: 'अनेक पीडीएफ फाइल्स एका फाईलमध्ये झटपट एकत्र करा.',
    toolSplitName: 'पीडीएफ वेगळे करा',
    toolSplitDesc: 'पीडीएफमधील पाने वेगळी करा किंवा हवे ते पान काढा.',
    toolCompressName: 'पीडीएफ कॉम्प्रेस करा',
    toolCompressDesc: 'दर्जा उत्तम ठेवून पीडीएफ फाईलचा आकार कमी करा.',
    toolJpgToPdfName: 'फोटो ते पीडीएफ',
    toolJpgToPdfDesc: 'फोटोचे रूपांतर एका स्वच्छ पीडीएफ फाईलमध्ये करा.',
    toolPdfToJpgName: 'पीडीएफ ते फोटो',
    toolPdfToJpgDesc: 'पीडीएफ पानांचे हाय क्वालिटी फोटो काढा.',
    toolScanName: 'डॉक्युमेंट स्कॅन',
    toolScanDesc: 'कॅमेऱ्याने कागदपत्रे व आयडी कार्ड झटपट स्कॅन करा.',

    // Footer
    footerTagline: 'जलद, सुरक्षित आणि खाजगी पीडीएफ टूल्स. थेट तुमच्या ब्राउझरमध्ये १००% सुरक्षित प्रक्रिया.',
    quickLinks: 'महत्त्वाच्या लिंक्स',
    popularTools: 'लोकप्रिय टूल्स',
    legalPrivacy: 'नियम व गोपनीयता',
    aboutUs: 'आमच्याबद्दल',
    contactUs: 'संपर्क',
    disclaimer: 'अस्वीकरण',
    allRightsReserved: 'सर्व हक्क राखीव. सुरक्षित ऑफलाइन ब्राउझर प्रोसेसिंग.',
  },
};

export type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => translations.en[key] || key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('app_language') as Language;
      if (saved && (saved === 'en' || saved === 'hi' || saved === 'mr')) {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('app_language', lang);
    } catch {
      // ignore
    }
  };

  const t = (key: TranslationKey): string => {
    const currentDict = translations[language] || translations.en;
    return currentDict[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
