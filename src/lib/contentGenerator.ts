/**
 * Generation orchestrator.
 *
 * Two engines:
 *  - AI: server-side LLM through /api/generate (see server/aiProxy.ts).
 *  - Offline: deterministic-ish local pipeline built on lib/utils.ts, used
 *    when no provider is configured. It is intentionally conservative: it never
 *    invents facts, it only restructures the user's own words.
 */
import { getAiStatus, runPrompt } from './aiClient';
import { buildPrompt, PLATFORM_PLAYBOOKS, type PromptContext } from './prompts';
import { buildImageBrief } from './images';
import type { AttachedImage } from '../types';
import { scoreViral } from './viral';
import {
  adjustTone,
  countCharacters,
  detectLanguage,
  extractKeywords,
  fitToLimit,
  formatContentForPlatform,
  generateCTA,
  generateHashtags,
  getPlatformById,
  pickEmojis,
  removeDuplicateSentences,
  splitSentences,
  summarizeContent,
  suggestSEOKeywords,
  targetLength,
  truncateToLimit,
} from './utils';

/** Options for one platform. `variations` is optional here because the batch
 *  runner sets it once for every platform. */
export type GeneratorOptions = Omit<PromptContext, 'variations'> & {
  useAi?: boolean;
  variations?: number;
} & ExtraGenerationInput;

/** Batch variant: everything except the platform, which the runner supplies. */
export type BatchGeneratorOptions = Omit<GeneratorOptions, 'platform'>;

/** Everything a single post needs, including the optional attachments. */
export interface ExtraGenerationInput {
  images?: AttachedImage[];
  includeAltText?: boolean;
}

export interface GeneratedVariant {
  platform: string;
  variation: number;
  post: string;
  hashtags: string[];
  cta: string | null;
  hook: string;
  why?: string;
  altText?: string | null;
  characterCount: number;
  limit: number;
  engine: 'ai' | 'offline';
  notes: string[];
  /** Virality breakdown. Null only when virality is switched off. */
  viral: import('./viral').ViralScore | null;
  /** Platform-appropriate image guidance for this specific post. */
  imageBrief: string[];
}

// \p{M} matters: Tamil/Devanagari vowel signs live in the mark category.
const HASHTAG_RE = /(^|\s)#([\p{L}\p{M}\p{N}_]+)/gu;

/** Every hashtag actually present in a finished post. */
function extractTags(post: string): string[] {
  return [...post.matchAll(HASHTAG_RE)].map((m) => `#${m[2]}`);
}

/**
 * Platforms where a hashtag block is actively wrong, regardless of the toggle.
 * WhatsApp and Reddit suppress or remove them, and Telegram channels that do
 * not normally use tags look spammy with them.
 */
const HASHTAG_HOSTILE_PLATFORMS = new Set(['whatsapp', 'reddit']);

function hashtagsAllowed(platform: string, requested: boolean): boolean {
  return requested && !HASHTAG_HOSTILE_PLATFORMS.has(platform);
}

/**
 * Appends as many whole hashtags as fit on ONE final line. Truncating mid-tag
 * produces a dead "#tharapu…" which silently breaks search, so a partial tag is
 * never allowed, and the line is rebuilt each time instead of appended to.
 */
function appendTagsFitting(body: string, tags: string[], limit: number): string {
  const cleanBody = body.replace(/(?:\n+[^\n#]*#[^\n#]*)+$/, '').trimEnd();
  const kept: string[] = [];

  for (const tag of tags) {
    const candidate = `${cleanBody}\n\n${[...kept, tag].join(' ')}`;
    if (countCharacters(candidate) > limit) break;
    kept.push(tag);
  }

  return kept.length ? `${cleanBody}\n\n${kept.join(' ')}` : cleanBody;
}

/** Viral-intensity default used by callers that do not pass the field. */
const VIRAL_DEFAULTS = { viralIntensity: 'off', viralTactics: [] as string[] } as const;

/**
 * Safe, fact-preserving virality passes for the offline engine.
 * It never invents content: it only restructures what the user already wrote -
 * fixes a weak opener, tightens length, and makes the post scannable.
 */
function applyOfflineViral(body: string, options: GeneratorOptions, limit: number): { body: string; notes: string[] } {
  const notes: string[] = [];
  const intensity = options.viralIntensity ?? 'off';
  if (intensity === 'off') return { body, notes };

  const tactics = options.viralTactics ?? [];
  let out = body.trim();

  // Weak openers ("This is...", "It was...") cost the swipe. Replace with a
  // name-anchored opener built from the sentence's own first proper noun.
  if (tactics.length && /^(this|it|that|these|those)\b/i.test(out)) {
    const proper = /\p{Lu}[\p{L}\p{M}]{2,}/u.exec(out);
    if (proper) {
      out = out.replace(/^(this|it|that|these|those)\b/i, proper[0]);
      notes.push('Rewrote a weak opening line.');
    }
  }

  // Scannability: on multi-line-capable platforms, break after sentence ends.
  if (['instagram', 'tiktok', 'facebook', 'whatsapp', 'telegram', 'linkedin'].includes(options.platform) && tactics.length) {
    out = out.replace(/([.!?।])\s+/g, '$1\n').replace(/\n{3,}/g, '\n\n');
  }

  // Length discipline: a post far under the platform limit rarely travels.
  const idealHigh = Math.round(limit * (options.platform === 'twitter' || options.platform === 'snapchat' ? 0.92 : 0.6));
  const idealLow = Math.round(limit * 0.35);
  const chars = countCharacters(out);
  if (chars < idealLow && tactics.includes('emotion')) {
    notes.push(`Post is only ${chars} characters - the offline generator cannot add detail the source does not contain. Add more to your input for a stronger result.`);
  } else if (chars > idealHigh) {
    const sentences = splitSentences(out);
    const kept: string[] = [];
    let used = 0;
    for (const sentence of sentences) {
      const cost = countCharacters(sentence) + 2;
      if (used + cost > idealHigh && kept.length) break;
      kept.push(sentence);
      used += cost;
    }
    out = kept.join('\n\n');
    notes.push('Trimmed to the ideal length range for reach.');
  }

  return { body: out, notes };
}

/** Shared tail for both engines: virality score + image guidance. */
function decorate(
  variant: Omit<GeneratedVariant, 'viral' | 'imageBrief'>,
  options: GeneratorOptions,
  images: AttachedImage[],
  includeAltText: boolean,
): GeneratedVariant {
  const viral =
    (options.viralIntensity ?? 'off') === 'off' ? null : scoreViral(variant.post, variant.platform);
  const imageBrief = buildImageBrief(variant.platform, images, includeAltText, false).lines;
  return { ...variant, viral, imageBrief };
}

function stripHashtags(text: string): string {
  return text.replace(HASHTAG_RE, '$1').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '').trim();
}

function uniqueTags(tags: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const clean = raw.trim().replace(/^#+/, '');
    if (!clean || clean.length < 2) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`#${clean}`);
    if (out.length >= limit) break;
  }
  return out;
}

/** Last line of safety: never publish a post over the platform limit. */
function enforceLimit(
  body: string,
  cta: string | null,
  hashtags: string[],
  limit: number,
  placement: string,
  notes: string[],
): { post: string; cta: string | null; hashtags: string[] } {
  let tail = '';
  if (placement === 'inline' && hashtags.length) tail += ` ${hashtags.join(' ')}`;
  if (cta) tail += `${tail ? '\n\n' : ''}${cta}`;

  const { body: fitted, tail: usedTail } = fitToLimit(body, tail, limit);
  let out = fitted + (usedTail ? `\n\n${usedTail}` : '');

  if (countCharacters(out) > limit) {
    const lines = fitted.split('\n');
    while (countCharacters(out) > limit && lines.length > 1) {
      lines.pop();
      out = lines.join('\n') + (usedTail ? `\n\n${usedTail}` : '');
    }
  }

  if (countCharacters(out) > limit) {
    notes.push(`Trimmed to fit the ${limit} character limit.`);
    out = truncateToLimit(out, limit);
    return { post: out, cta: null, hashtags: [] };
  }

  return { post: out, cta, hashtags };
}

function composeOffline(options: GeneratorOptions, variationIndex: number): GeneratedVariant {
  const info = getPlatformById(options.platform);
  const limit = info?.charLimit ?? PLATFORM_PLAYBOOKS[options.platform]?.limit ?? 3000;
  const notes: string[] = [];

  const sentencePool = splitSentences(removeDuplicateSentences(options.content));

  // Deterministic variation: each index uses a different sentence budget and a
  // different rotation, so the set is genuinely different posts rather than the
  // same post three times. Offline mode cannot rewrite wording without an LLM -
  // it varies structure, ordering and emphasis only, which is what it can do
  // honestly.
  const baseCount =
    options.length === 'short' ? 1 : options.length === 'standard' ? 3 : options.length === 'detailed' ? 5 : 8;
  const wanted = Math.min(sentencePool.length, Math.max(1, baseCount - variationIndex));
  const rotation = variationIndex % Math.max(1, sentencePool.length);
  const shifted =
    rotation > 0 ? [...sentencePool.slice(rotation), ...sentencePool.slice(0, rotation)] : sentencePool;

  let body = shifted.slice(0, wanted).join(' ').trim();

  // Trailing sentences (the detail that follows the headline) go to later
  // variations, so variation 1 is the tight version.
  if (variationIndex > 0 && countCharacters(body) < limit * 0.5) {
    const extra = shifted.slice(wanted, wanted + variationIndex);
    if (extra.length) body = `${body} ${extra.join(' ')}`;
  }

  if (countCharacters(body) > limit * 0.75) {
    body = summarizeContent(body, Math.max(1, Math.ceil(wanted / 2)));
  }

  body = adjustTone(body, options.tone);
  body = formatContentForPlatform(body, options.platform, options.tone, options.length);

  const viralised = applyOfflineViral(body, options, limit);
  body = viralised.body;
  notes.push(...viralised.notes);

  const emojiCount = { none: 0, light: 1, medium: 3, heavy: 6 }[options.emojiDensity] ?? 2;
  if (emojiCount > 0) {
    // Offset by variation so variation 1 is not always the same emoji.
    const emoji = pickEmojis(options.contentType, emojiCount + variationIndex).slice(variationIndex);
    if (emoji.length && !body.startsWith(emoji[0])) body = `${emoji[0]} ${body}`;
  }

  const cta = options.includeCTA
    ? generateCTA(
        options.tone,
        // Vary the CTA wording per variation so the set is not repetitive.
        options.ctaKind === 'custom' ? undefined : options.ctaKind,
        options.ctaKind === 'custom' ? options.customCTA : undefined,
        variationIndex,
      )
    : null;

  const keywords = extractKeywords(options.content, 12);
  const wantsTags = hashtagsAllowed(options.platform, options.includeHashtags);
  if (options.includeHashtags && !wantsTags) {
    notes.push('Hashtags removed: they are suppressed on this platform.');
  }
  const hashtags = wantsTags
    ? uniqueTags(
        [
          ...options.extraTags.map((t) => t.replace(/^#/, '')),
          ...generateHashtags(keywords, {
            category: options.contentType,
            platform: options.platform,
            limit: options.hashtagCount,
            script: options.hashtagScript,
          }),
        ],
        options.hashtagCount,
      )
    : [];

  const placement = options.hashtagPlacement ?? 'separate';
  const prepared =
    placement === 'inline'
      ? body
      : stripHashtags(body);

  const { post, cta: keptCta, hashtags: keptTags } = enforceLimit(
    prepared,
    cta,
    placement === 'inline' ? hashtags : [],
    limit,
    'separate',
    notes,
  );

  let finalPost = post;
  let usedTags = hashtags;
  if (hashtags.length && placement !== 'inline') {
    finalPost = appendTagsFitting(finalPost, hashtags, limit);
    usedTags = extractTags(finalPost);
    if (usedTags.length < hashtags.length) {
      notes.push(`Dropped ${hashtags.length - usedTags.length} hashtag(s) that did not fit under ${limit} characters.`);
    }
  }

  const hook = splitSentences(finalPost)[0]?.slice(0, 140) ?? '';

  return decorate(
    {
      platform: options.platform,
      variation: variationIndex,
      post: finalPost,
      hashtags: usedTags.length ? usedTags : keptTags,
      cta: keptCta,
      hook,
      characterCount: countCharacters(finalPost),
      limit,
      engine: 'offline',
      notes,
    },
    options,
    options.images ?? [],
    options.includeAltText ?? false,
  );
}

interface RawVariant {
  post?: string;
  hashtags?: string[];
  cta?: string | null;
  hook?: string;
  why?: string;
  alt_text?: string | null;
}

/** Models are unreliable JSON emitters, so every field is treated as untrusted. */
function parseVariations(raw: string): RawVariant[] {
  const candidates: string[] = [];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(raw.trim());
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(raw.slice(first, last + 1));
  const firstArr = raw.indexOf('[');
  const lastArr = raw.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) candidates.push(raw.slice(firstArr, lastArr + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const list = Array.isArray(parsed) ? parsed : parsed?.variations ?? parsed?.items;
      if (Array.isArray(list) && list.length) {
        return list.filter((v) => typeof v?.post === 'string' && v.post.trim());
      }
    } catch {
      /* next candidate */
    }
  }
  throw new Error('The model did not return usable JSON.');
}

function finalizeAiVariant(
  options: GeneratorOptions,
  raw: RawVariant,
  variationIndex: number,
  fallbackLimit: number,
): GeneratedVariant {
  const limit = getPlatformById(options.platform)?.charLimit ?? fallbackLimit;
  const notes: string[] = [];

  const placement = options.hashtagPlacement ?? 'separate';
  let body = String(raw.post).replace(/\r\n/g, '\n').trim();

  const modelTags = Array.isArray(raw.hashtags) ? raw.hashtags.filter((t) => typeof t === 'string') : [];
  const wantsTags = hashtagsAllowed(options.platform, options.includeHashtags);
  if (options.includeHashtags && !wantsTags) {
    notes.push('Hashtags removed: they are suppressed on this platform.');
  }
  const hashtags = wantsTags
    ? uniqueTags(
        [
          ...options.extraTags.map((t) => t.replace(/^#/, '')),
          ...modelTags,
          ...generateHashtags(extractKeywords(options.content, 6), {
            category: options.contentType,
            platform: options.platform,
            limit: Math.max(2, options.hashtagCount - modelTags.length),
            script: options.hashtagScript,
          }),
        ],
        options.hashtagCount,
      )
    : [];

  if (options.emojiDensity === 'none') {
    body = body.replace(/\p{Extended_Pictographic}/gu, '').replace(/[ \t]{2,}/g, ' ');
  }

  if (placement !== 'inline') {
    const stripped = stripHashtags(body);
    if (stripped !== body) notes.push('Hashtags moved out of the body text.');
    body = stripped;
  } else {
    body = body.replace(HASHTAG_RE, '$1').replace(/[ \t]{2,}/g, ' ');
    const inlineTags = uniqueTags([...body.matchAll(HASHTAG_RE)].map((m) => `#${m[2]}`), options.hashtagCount);
    body = body.replace(HASHTAG_RE, '$1').trim();
    hashtags.splice(0, hashtags.length, ...inlineTags);
  }

  const cta = options.includeCTA
    ? raw.cta?.trim() ||
      generateCTA(
        options.tone,
        options.ctaKind,
        options.ctaKind === 'custom' ? options.customCTA : undefined,
        variationIndex,
      )
    : null;

  const limited = enforceLimit(body, cta, placement === 'inline' ? hashtags : [], limit, 'separate', notes);
  let post = limited.post;

  if (hashtags.length && placement !== 'inline') {
    const before = hashtags.length;
    post = appendTagsFitting(post, hashtags, limit);
    const dropped = before - extractTags(post).length;
    if (dropped > 0) notes.push(`Dropped ${dropped} hashtag(s) that did not fit under ${limit} characters.`);
  }

  if (countCharacters(post) > limit) {
    notes.push(`Trimmed to fit the ${limit} character limit.`);
    post = truncateToLimit(post, limit);
  }

  return decorate(
    {
      platform: options.platform,
      variation: variationIndex,
      post,
      hashtags,
      cta: limited.cta,
      hook: raw.hook?.trim() || splitSentences(post)[0]?.slice(0, 140) || '',
      why: raw.why?.trim(),
      // The model never receives image pixels (only filenames), so any alt text
      // it writes is a guess. Keep it, but never let it masquerade as verified.
      altText: options.images?.length ? raw.alt_text?.trim() || null : null,
      characterCount: countCharacters(post),
      limit,
      engine: 'ai',
      notes,
    },
    options,
    options.images ?? [],
    options.includeAltText ?? false,
  );
}

export interface GenerateResult {
  variants: GeneratedVariant[];
  engine: 'ai' | 'offline';
  error?: string;
}

/**
 * Generates `variations` outputs for ONE platform.
 * Falls back to the offline engine for that platform if the AI call fails, so a
 * single bad request never wipes out the whole batch.
 */
export async function generateForPlatform(options: GeneratorOptions): Promise<GenerateResult> {
  const wanted = Math.min(5, Math.max(1, options.variations ?? 1));
  const status = await getAiStatus();
  const shouldUseAi = options.useAi !== false && status.aiEnabled;

  if (!shouldUseAi) {
    return {
      variants: Array.from({ length: wanted }, (_, i) => composeOffline(options, i)),
      engine: 'offline',
    };
  }

  try {
    // The image brief is per-platform, so it cannot be baked into the shared
    // PromptContext - build it here for the platform being generated.
    const images = options.images ?? [];
    const brief = buildImageBrief(options.platform, images, options.includeAltText ?? false, false);

    const raw = await runPrompt(
      buildPrompt(
        {
          ...VIRAL_DEFAULTS,
          ...options,
          variations: wanted,
          imageContext: brief.promptContext,
        },
        0,
      ),
    );
    const parsed = parseVariations(raw);
    const fallbackLimit = getPlatformById(options.platform)?.charLimit ?? 3000;

    const variants = parsed
      .slice(0, wanted)
      .map((v, i) => finalizeAiVariant(options, v, i, fallbackLimit));

    if (!variants.length) throw new Error('The model returned no usable variations.');
    return { variants, engine: 'ai' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed.';
    const variants = Array.from({ length: wanted }, (_, i) => composeOffline(options, i));
    return { variants, engine: 'offline', error: `${message} Fell back to the built-in generator.` };
  }
}

/** Runs every selected platform in parallel. */
export async function generateForPlatforms(
  options: BatchGeneratorOptions,
  platformIds: string[],
): Promise<{ results: GenerateResult[]; errors: string[] }> {
  const settled = await Promise.all(
    platformIds.map((platform) => generateForPlatform({ ...options, platform })),
  );
  const errors = settled.map((r) => r.error).filter((e): e is string => Boolean(e));
  return { results: settled, errors };
}

/* -------------------------------------------------------------------------- */
/* Backwards-compatible helpers used by AIToolsPage                            */
/* -------------------------------------------------------------------------- */

export interface GeneratedContent {
  post: string;
  hashtags: string[];
  cta: string | null;
  characterCount: number;
}

export function processContent(options: {
  content: string;
  platform: string;
  tone: string;
  language?: string;
  includeEmoji?: boolean;
  includeHashtags?: boolean;
  includeCTA?: boolean;
}): GeneratedContent {
  const variant = composeOffline(
    {
      content: options.content,
      platform: options.platform,
      tone: options.tone,
      language: options.language ?? detectLanguage(options.content),
      audience: 'general',
      contentType: 'news',
      hookStyle: 'auto',
      length: 'standard',
      emojiDensity: options.includeEmoji === false ? 'none' : 'light',
      includeHashtags: options.includeHashtags !== false,
      hashtagCount: 8,
      hashtagPlacement: 'separate',
      hashtagScript: 'auto',
      includeCTA: options.includeCTA !== false,
      ctaKind: 'share',
      customCTA: '',
      extraTags: [],
      notes: '',
      viralIntensity: 'off',
      viralTactics: [],
      imageContext: '',
      includeAltText: false,
    },
    0,
  );

  return {
    post: variant.post,
    hashtags: variant.hashtags,
    cta: variant.cta,
    characterCount: variant.characterCount,
  };
}

/* ------------------------------ text utilities ----------------------------- */

export function expandContent(content: string): string {
  const sentences = splitSentences(content);
  const expanded: string[] = [];

  for (const sentence of sentences) {
    expanded.push(sentence);
    const words = sentence.split(/\s+/).length;
    if (words > 12 && Math.random() > 0.55) {
      expanded.push('This is an important point worth dwelling on.');
    }
  }

  return expanded.join(' ');
}

export function shortenContent(content: string): string {
  const sentences = splitSentences(content);
  return summarizeContent(sentences.join(' '), Math.max(1, Math.ceil(sentences.length / 2)));
}

const SYNONYMS: Record<string, string[]> = {
  good: ['excellent', 'great', 'outstanding', 'remarkable'],
  bad: ['poor', 'inadequate', 'lacking'],
  big: ['substantial', 'significant', 'considerable'],
  small: ['minor', 'modest', 'slight'],
  fast: ['rapid', 'swift', 'quick'],
  slow: ['gradual', 'steady', 'measured'],
  important: ['crucial', 'essential', 'vital'],
  new: ['novel', 'fresh', 'innovative'],
  old: ['established', 'traditional', 'time-tested'],
  use: ['utilise', 'employ', 'leverage'],
  make: ['create', 'develop', 'produce'],
  show: ['demonstrate', 'illustrate', 'reveal'],
  visit: ['tour', 'call on'],
  travel: ['journey', 'move'],
  road: ['highway', 'route'],
};

/** Word-level paraphrase. Deliberately conservative: numbers are never touched. */
export function rewriteContent(content: string, tone: string): string {
  const rewritten = content.replace(/[\p{L}\p{M}'-]+/gu, (word) => {
    const lower = word.toLowerCase();
    const options = SYNONYMS[lower];
    if (!options || Math.random() <= 0.5) return word;
    const replacement = options[Math.floor(Math.random() * options.length)];
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  });

  return adjustTone(rewritten, tone);
}

export { suggestSEOKeywords, targetLength };
