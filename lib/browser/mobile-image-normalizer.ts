type NormalizeMobileCaptureFileOptions = {
  maxBytes?: number;
  maxDimension?: number;
  quality?: number;
};

function renameFileWithJpegExtension(fileName: string) {
  if (fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg")) {
    return fileName;
  }

  const sanitizedBaseName = fileName.replace(/\.[^.]+$/, "") || "capture";
  return `${sanitizedBaseName}.jpg`;
}

async function loadImageElement(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    const ready = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No se pudo leer la imagen de la camara."));
    });

    image.src = objectUrl;

    return await ready;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function normalizeMobileCaptureFile(
  file: File,
  options: NormalizeMobileCaptureFileOptions = {},
) {
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  const maxDimension = options.maxDimension ?? 2200;
  const quality = options.quality ?? 0.84;

  if (!file.type.startsWith("image/")) {
    return file;
  }

  if (typeof window === "undefined") {
    return file;
  }

  const image = await loadImageElement(file);
  const needsResize = Math.max(image.width, image.height) > maxDimension;
  const needsCompression = file.size > maxBytes;

  if (!needsResize && !needsCompression) {
    return file;
  }

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  if (!blob) {
    return file;
  }

  return new File(
    [blob],
    renameFileWithJpegExtension(file.name),
    {
      type: "image/jpeg",
      lastModified: file.lastModified,
    },
  );
}
