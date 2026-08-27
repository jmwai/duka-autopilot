export const MAX_MEDIA_BYTES = 6_000_000;
export const MAX_MESSAGE_CHARACTERS = 4_000;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AUDIO_MIME_TYPES = [
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/mpeg",
  "audio/mp4",
] as const;

export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];
export type AudioMime = (typeof AUDIO_MIME_TYPES)[number];
export type AcceptedMedia =
  | { kind: "photo"; mime: ImageMime }
  | { kind: "voice"; mime: AudioMime };

export function normalizeMime(value: string) {
  return value.toLowerCase().split(";", 1)[0].trim();
}

export function acceptedMedia(mimeValue: string): AcceptedMedia | null {
  const mime = normalizeMime(mimeValue);
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
    return { kind: "photo", mime: mime as ImageMime };
  }
  if ((AUDIO_MIME_TYPES as readonly string[]).includes(mime)) {
    return { kind: "voice", mime: mime as AudioMime };
  }
  return null;
}

export function validateMedia(mime: string, size: number): string | null {
  if (!acceptedMedia(mime)) return "Use a JPEG, PNG, WebP, OGG, WebM, WAV, MP3 or MP4 file.";
  if (!Number.isFinite(size) || size <= 0) return "The selected file is empty.";
  if (size > MAX_MEDIA_BYTES) return "Media must be 6 MB or smaller.";
  return null;
}

export function base64FromDataUrl(dataUrl: string) {
  const marker = dataUrl.indexOf(",");
  if (marker < 0 || !dataUrl.slice(0, marker).includes(";base64")) {
    throw new Error("Media could not be encoded safely");
  }
  return dataUrl.slice(marker + 1);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Media could not be read"));
    reader.onload = () => {
      try {
        resolve(base64FromDataUrl(String(reader.result ?? "")));
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsDataURL(blob);
  });
}

export function formatMediaBytes(bytes: number) {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function preferredRecorderMime(): AudioMime | null {
  if (typeof MediaRecorder === "undefined") return null;
  return AUDIO_MIME_TYPES.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? null;
}
