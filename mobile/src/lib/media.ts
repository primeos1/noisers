import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { apiFetch } from "./api";

// Photo uploads for the committee screens, the mobile twin of
// frontend/src/lib/media.ts. Resizes on the phone first so a 12MP camera
// shot doesn't hit the API's 5MB limit, then POSTs to /media, which stores
// it on the configured disk and returns a public URL.

export interface UploadedMedia {
  id: number;
  url: string;
}

/** A resized JPEG on the phone, ready to go into a FormData. */
export interface PickedImage {
  uri: string;
  name: string;
}

/**
 * Opens the photo library and resizes the chosen image. Resolves null if the
 * person cancels.
 */
export async function pickImage(maxDim = 1600): Promise<PickedImage | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 1 });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];

  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > maxDim) {
    context.resize(asset.width >= asset.height ? { width: maxDim } : { height: maxDim });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });

  return { uri: saved.uri, name: `${(asset.fileName ?? "photo").replace(/\.[^.]+$/, "")}.jpg` };
}

export async function appendImage(form: FormData, field: string, image: PickedImage) {
  if (Platform.OS === "web") {
    form.append(field, await (await fetch(image.uri)).blob(), image.name);
  } else {
    // React Native's FormData takes a { uri, name, type } file descriptor.
    form.append(field, { uri: image.uri, name: image.name, type: "image/jpeg" } as unknown as Blob);
  }
}

/**
 * Opens the photo library, and uploads the chosen image. Resolves null if the
 * person cancels.
 */
export async function pickAndUploadImage(maxDim = 1600): Promise<UploadedMedia | null> {
  const image = await pickImage(maxDim);
  if (!image) return null;

  const form = new FormData();
  await appendImage(form, "file", image);

  const res = await apiFetch<{ data: UploadedMedia }>("/media", { method: "POST", form, timeoutMs: 60000 });
  return res.data;
}
