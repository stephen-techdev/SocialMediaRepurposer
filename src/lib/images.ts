/**
 * Optional image attachments.
 *
 * Images are NOT uploaded anywhere. They are read in the browser, downscaled to
 * a thumbnail, and kept in memory + localStorage (small, capped) so the user
 * can see exactly which visual goes with which post. The AI never receives the
 * pixels - it receives the filename and dimensions as context for alt text and
 * caption planning. That keeps the tool private and avoids sending people's
 * photos to a third party.
 */
import type { AttachedImage } from '../types';

export const MAX_IMAGES = 6;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const THUMB_MAX_EDGE = 320;
export const PERSIST_MAX_BYTES = 1_500_000;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED.includes(file.type) || /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name);
}

export function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : 'jpg';
}

async function loadBitmap(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Could not decode ${file.name}`));
      el.src = objectUrl;
    });
    return image;
  } finally {
    // Revoke only after decode; the caller still needs the element, not the URL.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

export async function readImage(file: File): Promise<AttachedImage> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
  }

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(bitmap.naturalWidth, bitmap.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(bitmap.naturalHeight * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable in this browser.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let dataUrl = canvas.toDataURL('image/jpeg', 0.72);
  // Fall back to a smaller quality step if the thumbnail is still heavy.
  if (dataUrl.length > PERSIST_MAX_BYTES) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.45);
  }

  const ratio = bitmap.naturalWidth / bitmap.naturalHeight;
  const shape: AttachedImage['shape'] = ratio > 1.2 ? 'landscape' : ratio < 0.85 ? 'portrait' : 'square';

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    type: file.type || `image/${extensionOf(file.name)}`,
    size: file.size,
    width: bitmap.naturalWidth,
    height: bitmap.naturalHeight,
    shape,
    dataUrl,
  };
}

export async function readImages(files: FileList | File[]): Promise<{ images: AttachedImage[]; errors: string[] }> {
  const list = Array.from(files);
  const errors: string[] = [];
  const images: AttachedImage[] = [];

  for (const file of list) {
    if (!isAcceptedImage(file)) {
      errors.push(`${file.name}: unsupported format.`);
      continue;
    }
    try {
      images.push(await readImage(file));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `${file.name}: could not be read.`);
    }
  }

  return { images, errors };
}

/* ------------------------------- persistence ------------------------------- */

const KEY = 'smr:images:v1';

type StoredImage = Omit<AttachedImage, 'dataUrl'>;

/** Thumbnails only - the original files are never stored. */
export function saveImages(images: AttachedImage[]) {
  try {
    const stored: StoredImage[] = images.map((img) => ({
      id: img.id,
      name: img.name,
      type: img.type,
      size: img.size,
      width: img.width,
      height: img.height,
      shape: img.shape,
    }));
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* quota exceeded - images are optional, so failing silently is correct */
  }
}

export function loadImages(): StoredImage[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredImage[]) : [];
  } catch {
    return [];
  }
}

export function clearImages() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------- platform image guidance ------------------------- */

export interface ImageBrief {
  /** Human-readable line shown under the post. */
  lines: string[];
  /** Short machine-readable string appended to the AI prompt. */
  promptContext: string;
}

const IMAGE_RULES: Record<string, { ratio: string; count: string; note: string }> = {
  twitter: { ratio: '16:9', count: 'up to 4', note: 'One strong image beats four weak ones. Text on image must still be readable on a small phone.' },
  threads: { ratio: '1:1 or 4:5', count: 'up to 5', note: 'Vertical images travel further in Threads.' },
  instagram: { ratio: '4:5 for feed reach', count: 'up to 10 (carousel)', note: 'First slide is the thumbnail. Build a carousel: cover, context, detail, CTA.' },
  tiktok: { ratio: '9:16 vertical', count: 'cover only', note: 'Cover text is the hook. Keep it to a few large words.' },
  linkedin: { ratio: '1.91:1', count: '1 document or up to 9', note: 'Native document posts (PDF carousel) get the most dwell time. No emoji in the document.' },
  facebook: { ratio: '1.91:1', count: 'up to 10', note: 'Lead image carries the story.' },
  whatsapp: { ratio: '16:9', count: '1', note: 'One image, plus a caption a busy person can read in five seconds.' },
  telegram: { ratio: '16:9', count: 'up to 10', note: 'Add alt text - many readers browse with images off.' },
  pinterest: { ratio: '2:3 vertical', count: '1 per pin', note: 'Vertical only. Text overlay with the key phrase helps saves.' },
  snapchat: { ratio: '9:16 vertical', count: 'up to 10', note: 'Vertical story sequence.' },
  reddit: { ratio: '16:9', count: '1', note: 'No marketing text on the image. Mark anything that is not self-explanatory.' },
  youtube_community: { ratio: '16:9', count: '1', note: 'Poll or single image.' },
  youtube_description: { ratio: '16:9', count: '1 thumbnail reference', note: 'Describe the thumbnail in the description for accessibility.' },
  medium: { ratio: '16:9', count: '1 hero', note: 'Hero image with alt text is mandatory.' },
  blogger: { ratio: '16:9', count: '1 featured', note: 'Always add alt text.' },
};

export function buildImageBrief(
  platform: string,
  images: AttachedImage[],
  includeAltText: boolean,
  includeOverlay: boolean,
): ImageBrief {
  if (!images.length) return { lines: [], promptContext: '' };

  const rule = IMAGE_RULES[platform] ?? { ratio: '16:9', count: 'up to 4', note: '' };
  const listed = images.map((img, i) => `${i + 1}. ${img.name} (${img.width}x${img.height}, ${img.shape})`);

  const lines = [
    `IMAGES ATTACHED (${images.length})`,
    ...listed,
    `Platform format: ${rule.ratio}, ${rule.count}`,
    rule.note,
  ];

  const extras: string[] = [];
  if (includeAltText) extras.push(`Write ALT TEXT for every image: ${images.length} lines, each under 125 characters, describing what is actually visible. No "image of".`);
  if (includeOverlay) extras.push(`Suggest SHORT on-image text (max 6 words, uppercase) for each image - the overlay is what people read before they read the caption.`);

  if (extras.length) lines.push(...extras);

  const promptContext = `The user attached ${images.length} image(s): ${images
    .map((i) => i.name)
    .join(', ')}. Reference them in the caption naturally (do not invent what they show) and follow the ${rule.ratio} format.`;

  return { lines, promptContext };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
