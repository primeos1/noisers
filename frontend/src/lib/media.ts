import { apiFetchForm } from "./api";

// Resizes an uploaded image client-side before it goes over the wire —
// same idea as the old fileToResizedDataUrl in lib/image.ts, but produces
// a Blob ready to upload instead of a data URL to store locally.
function resizeToBlob(file: File, maxDim: number, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That doesn't look like an image."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Couldn't process that image."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))),
          "image/jpeg",
          quality,
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export interface UploadedMedia {
  id: number;
  url: string;
  altText: string | null;
}

export async function uploadMedia(
  file: File,
  options: { altText?: string; maxDim?: number } = {},
): Promise<UploadedMedia> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  const blob = await resizeToBlob(file, options.maxDim ?? 1600);
  const formData = new FormData();
  formData.append("file", blob, file.name);
  if (options.altText) formData.append("alt_text", options.altText);

  const res = await apiFetchForm<{ data: UploadedMedia }>("/media", formData);
  return res.data;
}
