export const documentsStorageBucket = "documents-private";
export const maxDocumentUploadBytes = 20 * 1024 * 1024;
export const allowedDocumentUploadMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedDocumentUploadMimeType =
  (typeof allowedDocumentUploadMimeTypes)[number];

export type DocumentUploadCandidate = {
  name: string;
  type: string;
  size: number;
};

export type DocumentUploadBatchValidationResult = {
  accepted: DocumentUploadCandidate[];
  rejected: Array<DocumentUploadCandidate & {
    message: string;
  }>;
};

export type DocumentUploadValidationResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

export function validateDocumentUploadCandidate(
  candidate: DocumentUploadCandidate,
): DocumentUploadValidationResult {
  if (!candidate.name.trim()) {
    return {
      success: false,
      message: "Selecciona un archivo antes de continuar.",
    };
  }

  if (!allowedDocumentUploadMimeTypes.includes(candidate.type as AllowedDocumentUploadMimeType)) {
    return {
      success: false,
      message: "Solo se aceptan archivos PDF, JPG o PNG.",
    };
  }

  if (candidate.size <= 0) {
    return {
      success: false,
      message: "El archivo no puede estar vacio.",
    };
  }

  if (candidate.size > maxDocumentUploadBytes) {
    return {
      success: false,
      message: "El archivo supera el limite de 20 MB.",
    };
  }

  return {
    success: true,
  };
}

export function validateDocumentUploadCandidates(
  candidates: DocumentUploadCandidate[],
): DocumentUploadBatchValidationResult {
  return candidates.reduce<DocumentUploadBatchValidationResult>((result, candidate) => {
    const validation = validateDocumentUploadCandidate(candidate);

    if (validation.success) {
      result.accepted.push(candidate);
    } else {
      result.rejected.push({
        ...candidate,
        message: validation.message,
      });
    }

    return result;
  }, {
    accepted: [],
    rejected: [],
  });
}

export function formatUploadSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}
