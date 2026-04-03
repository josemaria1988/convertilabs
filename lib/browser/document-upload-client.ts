export async function computeFileSha256(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function uploadFileToSignedUrl(input: {
  signedUploadUrl: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", input.file, input.file.name);

  const response = await fetch(input.signedUploadUrl, {
    method: "PUT",
    body: formData,
    headers: {
      "x-upsert": "false",
    },
  });

  if (response.ok) {
    return {
      ok: true as const,
    };
  }

  const responseText = await response.text();

  try {
    const payload = JSON.parse(responseText) as {
      message?: string;
      error?: string | { message?: string };
    };
    const parsedMessage =
      payload.message
      ?? (typeof payload.error === "string"
        ? payload.error
        : payload.error?.message)
      ?? response.statusText;

    return {
      ok: false as const,
      message: parsedMessage || "No se pudo cargar el archivo al bucket privado.",
    };
  } catch {
    return {
      ok: false as const,
      message: responseText.trim() || response.statusText || "No se pudo cargar el archivo al bucket privado.",
    };
  }
}
