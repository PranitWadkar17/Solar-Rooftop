// ============================================
// Canvas-based Client-Side Bill Image Preprocessing
// ============================================

export interface PreprocessingOptions {
  maxDimension?: number;
  minDimension?: number;
  enhanceContrast?: boolean;
  binarize?: boolean;
}

export interface PreprocessingResult {
  grayscaleCanvas: HTMLCanvasElement;
  binarizedCanvas: HTMLCanvasElement;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  skewAngleDeg: number;
  aspectRatioWarning?: string;
}

/**
 * Validates uploaded image file size, dimension, and type
 */
export function validateBillImageFile(file: File): { valid: boolean; error?: string; warning?: string } {
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
  
  if (!validMimeTypes.includes(file.type)) {
    if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      return {
        valid: false,
        error: 'HEIC format detected. Please convert your photo to JPG or PNG before uploading.',
      };
    }
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return {
        valid: false,
        error: 'PDF files are not directly supported. Please capture or export a clear JPG or PNG image of your bill page.',
      };
    }
    return {
      valid: false,
      error: 'Unsupported image format. Please upload a clear JPG, PNG, or WEBP image of your bill.',
    };
  }

  // 10 MB maximum limit
  if (file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: 'File size exceeds 10 MB. Please upload a photo or scan under 10 MB.',
    };
  }

  return { valid: true };
}

/**
 * Estimates skew angle in degrees using horizontal projection profile variance (pure Canvas/JS)
 */
function estimateSkewAngle(imageData: ImageData): number {
  const { width, height, data } = imageData;
  // Sample central 50% region for faster, robust angle estimation
  const startY = Math.floor(height * 0.25);
  const endY = Math.floor(height * 0.75);
  const sampleHeight = endY - startY;
  
  // Test angles from -5 to +5 degrees in steps of 0.5 degrees
  let bestAngle = 0;
  let maxVariance = -1;

  for (let angle = -4; angle <= 4; angle += 0.5) {
    const rad = (angle * Math.PI) / 180;
    const tan = Math.tan(rad);
    const rowSums = new Float32Array(sampleHeight);

    for (let y = startY; y < endY; y++) {
      let sum = 0;
      for (let x = 0; x < width; x += 4) { // stride of 4 for speed
        const shiftedY = Math.floor(y + (x - width / 2) * tan);
        if (shiftedY >= 0 && shiftedY < height) {
          const idx = (shiftedY * width + x) * 4;
          // Inverted luminance (dark text = high value)
          sum += 255 - data[idx];
        }
      }
      rowSums[y - startY] = sum;
    }

    // Compute variance of row projections
    let mean = 0;
    for (let i = 0; i < sampleHeight; i++) mean += rowSums[i];
    mean /= sampleHeight;

    let variance = 0;
    for (let i = 0; i < sampleHeight; i++) {
      const diff = rowSums[i] - mean;
      variance += diff * diff;
    }

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

/**
 * Computes Otsu's optimal threshold for grayscale image data
 */
function computeOtsuThreshold(grayData: Uint8Array): number {
  const histogram = new Int32Array(256);
  const total = grayData.length;

  for (let i = 0; i < total; i++) {
    histogram[grayData[i]]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const varianceBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      threshold = i;
    }
  }

  return threshold;
}

/**
 * Loads image from File into HTMLImageElement
 */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file. The image may be corrupt.'));
    };
    img.src = url;
  });
}

/**
 * Full preprocessing pipeline:
 * 1. Rescale to optimal OCR resolution (width/height bounded to sane range).
 * 2. Grayscale conversion.
 * 3. Contrast stretching (histogram stretch).
 * 4. Deskewing (if minor rotation detected).
 * 5. Otsu adaptive binarization for clean high-contrast text.
 */
export async function preprocessBillImage(
  file: File,
  options: PreprocessingOptions = {}
): Promise<PreprocessingResult> {
  const img = await loadImageFromFile(file);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  let warning: string | undefined;
  if (Math.min(origW, origH) < 800) {
    warning = 'Low resolution image. For best accuracy, capture a closer, sharper photo of the bill.';
  }

  // Target maximum dimension: 2400px (fast, sharp, does not exceed canvas memory)
  const maxDim = options.maxDimension || 2400;
  const minDim = options.minDimension || 1200;

  let targetW = origW;
  let targetH = origH;

  const longSide = Math.max(origW, origH);
  const shortSide = Math.min(origW, origH);

  if (longSide > maxDim) {
    const scale = maxDim / longSide;
    targetW = Math.round(origW * scale);
    targetH = Math.round(origH * scale);
  } else if (shortSide < minDim) {
    // Upscale small scans slightly for OCR clarity
    const scale = Math.min(2.0, minDim / shortSide);
    targetW = Math.round(origW * scale);
    targetH = Math.round(origH * scale);
  }

  // Draw scaled image to base canvas
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = targetW;
  baseCanvas.height = targetH;
  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  if (!baseCtx) throw new Error('Could not initialize HTML5 Canvas 2D context.');

  baseCtx.drawImage(img, 0, 0, targetW, targetH);
  const imgData = baseCtx.getImageData(0, 0, targetW, targetH);
  const { data } = imgData;
  const pixelCount = targetW * targetH;

  // Convert to Grayscale & compute min/max for contrast stretch
  const grayBuffer = new Uint8Array(pixelCount);
  let minLum = 255;
  let maxLum = 0;

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Standard perceptual luminance
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    grayBuffer[i] = lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  // Contrast stretch: stretch [minLum, maxLum] to [0, 255]
  const lumRange = Math.max(1, maxLum - minLum);
  const stretchedGray = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const stretched = Math.round(((grayBuffer[i] - minLum) / lumRange) * 255);
    stretchedGray[i] = Math.min(255, Math.max(0, stretched));
  }

  // Write stretched grayscale to a grayscale canvas
  const grayCanvas = document.createElement('canvas');
  grayCanvas.width = targetW;
  grayCanvas.height = targetH;
  const grayCtx = grayCanvas.getContext('2d', { willReadFrequently: true });
  if (!grayCtx) throw new Error('Could not initialize Canvas context.');

  const grayImgData = grayCtx.createImageData(targetW, targetH);
  for (let i = 0; i < pixelCount; i++) {
    const val = stretchedGray[i];
    grayImgData.data[i * 4] = val;
    grayImgData.data[i * 4 + 1] = val;
    grayImgData.data[i * 4 + 2] = val;
    grayImgData.data[i * 4 + 3] = 255;
  }
  grayCtx.putImageData(grayImgData, 0, 0);

  // Estimate skew
  const skewAngle = estimateSkewAngle(grayImgData);

  // If skew is noticeable (|angle| > 0.5 deg), rotate canvas
  let deskewedGrayCanvas = grayCanvas;
  if (Math.abs(skewAngle) >= 0.5) {
    deskewedGrayCanvas = document.createElement('canvas');
    deskewedGrayCanvas.width = targetW;
    deskewedGrayCanvas.height = targetH;
    const deskewCtx = deskewedGrayCanvas.getContext('2d');
    if (deskewCtx) {
      deskewCtx.fillStyle = '#ffffff';
      deskewCtx.fillRect(0, 0, targetW, targetH);
      deskewCtx.save();
      deskewCtx.translate(targetW / 2, targetH / 2);
      deskewCtx.rotate((-skewAngle * Math.PI) / 180);
      deskewCtx.drawImage(grayCanvas, -targetW / 2, -targetH / 2);
      deskewCtx.restore();
    }
  }

  // Compute Otsu Binarization for the high-contrast variant
  const binarizedCanvas = document.createElement('canvas');
  binarizedCanvas.width = targetW;
  binarizedCanvas.height = targetH;
  const binCtx = binarizedCanvas.getContext('2d', { willReadFrequently: true });
  if (!binCtx) throw new Error('Could not initialize Binarized canvas context.');

  const deskewedCtx = deskewedGrayCanvas.getContext('2d', { willReadFrequently: true });
  const deskewedData = deskewedCtx?.getImageData(0, 0, targetW, targetH) || grayImgData;
  const deskewedGray = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    deskewedGray[i] = deskewedData.data[i * 4];
  }

  const threshold = computeOtsuThreshold(deskewedGray);
  const binImgData = binCtx.createImageData(targetW, targetH);

  for (let i = 0; i < pixelCount; i++) {
    const binVal = deskewedGray[i] >= threshold ? 255 : 0;
    binImgData.data[i * 4] = binVal;
    binImgData.data[i * 4 + 1] = binVal;
    binImgData.data[i * 4 + 2] = binVal;
    binImgData.data[i * 4 + 3] = 255;
  }
  binCtx.putImageData(binImgData, 0, 0);

  // Create preview data URL
  const previewUrl = deskewedGrayCanvas.toDataURL('image/jpeg', 0.85);

  return {
    grayscaleCanvas: deskewedGrayCanvas,
    binarizedCanvas,
    previewUrl,
    originalWidth: origW,
    originalHeight: origH,
    processedWidth: targetW,
    processedHeight: targetH,
    skewAngleDeg: Math.round(skewAngle * 10) / 10,
    aspectRatioWarning: warning,
  };
}
