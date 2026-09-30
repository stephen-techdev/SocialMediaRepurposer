export type Platform = typeof import('../lib/constants').PLATFORMS[number]['id'];
export type Tone = typeof import('../lib/constants').TONES[number]['id'];
export type Language = typeof import('../lib/constants').LANGUAGES[number]['id'];
export type TemplateCategory = typeof import('../lib/constants').TEMPLATE_CATEGORIES[number]['id'];
export type AITool = typeof import('../lib/constants').AI_TOOLS[number]['id'];

/** An image the user attached. Never uploaded anywhere - thumbnail only. */
export interface AttachedImage {
  id: string;
  name: string;
  type: string;
  /** Original size in bytes, for display only. */
  size: number;
  width: number;
  height: number;
  shape: 'landscape' | 'portrait' | 'square';
  /** Downscaled JPEG thumbnail as a data URL. */
  dataUrl: string;
}

export interface GeneratedPost {
  platform: Platform;
  post: string;
  hashtags: string[];
  cta: string | null;
  characterCount: number;
}

export interface ContentInput {
  content: string;
  platforms: Platform[];
  tone: Tone;
  language: Language;
  includeEmoji: boolean;
  includeHashtags: boolean;
  includeCTA: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}
