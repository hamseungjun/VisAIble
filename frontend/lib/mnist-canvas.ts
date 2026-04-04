export function extractMnistPixels(canvas: HTMLCanvasElement) {
  const sourceContext = canvas.getContext('2d');
  if (!sourceContext) {
    return [];
  }

  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;
  const sourceImage = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight);
  const threshold = 16;

  let minX = sourceWidth;
  let minY = sourceHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      const offset = (y * sourceWidth + x) * 4;
      const intensity = sourceImage.data[offset];
      if (intensity <= threshold) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return [];
  }

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const workingCanvas = document.createElement('canvas');
  workingCanvas.width = 28;
  workingCanvas.height = 28;
  const workingContext = workingCanvas.getContext('2d');
  if (!workingContext) {
    return [];
  }

  workingContext.fillStyle = '#000000';
  workingContext.fillRect(0, 0, 28, 28);
  workingContext.imageSmoothingEnabled = true;

  const normalizedDigitSize = 20;
  const scale = Math.min(normalizedDigitSize / cropWidth, normalizedDigitSize / cropHeight);
  const scaledWidth = Math.max(1, Math.round(cropWidth * scale));
  const scaledHeight = Math.max(1, Math.round(cropHeight * scale));
  const offsetX = Math.floor((28 - scaledWidth) / 2);
  const offsetY = Math.floor((28 - scaledHeight) / 2);

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedContext = croppedCanvas.getContext('2d');
  if (!croppedContext) {
    return [];
  }

  croppedContext.putImageData(sourceImage, -minX, -minY);
  workingContext.drawImage(
    croppedCanvas,
    0,
    0,
    cropWidth,
    cropHeight,
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight,
  );

  const centeredImage = workingContext.getImageData(0, 0, 28, 28);
  let totalMass = 0;
  let massX = 0;
  let massY = 0;

  for (let y = 0; y < 28; y += 1) {
    for (let x = 0; x < 28; x += 1) {
      const offset = (y * 28 + x) * 4;
      const intensity = centeredImage.data[offset] / 255;
      totalMass += intensity;
      massX += x * intensity;
      massY += y * intensity;
    }
  }

  if (totalMass > 0) {
    const centroidX = massX / totalMass;
    const centroidY = massY / totalMass;
    const shiftX = Math.round(13.5 - centroidX);
    const shiftY = Math.round(13.5 - centroidY);

    if (shiftX !== 0 || shiftY !== 0) {
      const recenteredCanvas = document.createElement('canvas');
      recenteredCanvas.width = 28;
      recenteredCanvas.height = 28;
      const recenteredContext = recenteredCanvas.getContext('2d');
      if (!recenteredContext) {
        return [];
      }

      recenteredContext.fillStyle = '#000000';
      recenteredContext.fillRect(0, 0, 28, 28);
      recenteredContext.putImageData(centeredImage, shiftX, shiftY);
      const recenteredImage = recenteredContext.getImageData(0, 0, 28, 28).data;

      return Array.from({ length: 28 * 28 }, (_, index) => recenteredImage[index * 4] / 255);
    }
  }

  return Array.from({ length: 28 * 28 }, (_, index) => centeredImage.data[index * 4] / 255);
}
