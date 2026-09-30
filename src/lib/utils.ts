/**
 * Offline text engine.
 *
 * Everything here is deliberately NON-DESTRUCTIVE. The previous version
 * lower-cased the whole text, replaced every "." with "!", and split on any
 * "." which mangled abbreviations, decimals and non-Latin scripts (Tamil,
 * Devanagari, ...). All of that has been replaced with Unicode-aware logic.
 */
import {
  CTA_PHRASES,
  PLATFORMS,
  REGION_HASHTAGS,
  TRENDING_HASHTAGS,
} from './constants';

export type Script = 'latin' | 'tamil' | 'devanagari' | 'telugu' | 'kannada' | 'malayalam' | 'arabic' | 'han' | 'other';

/* ------------------------------- basic metrics ------------------------------ */

/** Counts user-perceived characters, so an emoji costs 1 instead of 2. */
export function countCharacters(text: string): number {
  return [...text].length;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

export function estimateReadingTime(text: string): number {
  return Math.max(1, Math.ceil(countWords(text) / 200));
}

/* --------------------------------- scripts --------------------------------- */

const SCRIPT_RANGES: Array<{ script: Script; re: RegExp }> = [
  { script: 'tamil', re: /[\u0B80-\u0BFF]/ },
  { script: 'devanagari', re: /[\u0900-\u097F]/ },
  { script: 'telugu', re: /[\u0C00-\u0C7F]/ },
  { script: 'kannada', re: /[\u0C80-\u0CFF]/ },
  { script: 'malayalam', re: /[\u0D00-\u0D7F]/ },
  { script: 'arabic', re: /[\u0600-\u06FF]/ },
  { script: 'han', re: /[\u4E00-\u9FFF]/ },
  { script: 'latin', re: /[A-Za-z]/ },
];

export function detectScript(text: string): Script {
  const sample = text.slice(0, 2000);
  for (const { script, re } of SCRIPT_RANGES) {
    if (re.test(sample)) return script;
  }
  return 'other';
}

const SCRIPT_LANGUAGE: Record<Script, string> = {
  tamil: 'ta',
  devanagari: 'hi',
  telugu: 'te',
  kannada: 'kn',
  malayalam: 'ml',
  arabic: 'ar',
  han: 'zh',
  latin: 'en',
  other: 'en',
};

/** Best-effort script-based language guess used when language = "auto". */
export function detectLanguage(text: string): string {
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const indic = (text.match(/[\u0900-\u0DFF]/g) ?? []).length;
  if (indic === 0 && latin === 0) return 'en';
  // Mixed English + Indic script: prefer the Indic language if it dominates.
  if (indic > 0 && latin / (latin + indic) < 0.6) return SCRIPT_LANGUAGE[detectScript(text)];
  return 'en';
}

/* ------------------------------ transliteration ----------------------------- */

const TAMIL_MAP: Record<string, string> = {
  // independent vowels
  அ: 'a', ஆ: 'aa', இ: 'i', ஈ: 'i', உ: 'u', ஊ: 'u', எ: 'e', ஏ: 'ee', ஐ: 'ai', ஒ: 'o', ஓ: 'oo', ஔ: 'au',
  // consonants (bare form = inherent "a", stripped by the pulli rule)
  க: 'k', ங: 'ng', ச: 'ch', ஞ: 'ny', ட: 't', ண: 'n', த: 'th', ந: 'n', ப: 'p', ம: 'm',
  ய: 'y', ர: 'r', ல: 'l', வ: 'v', ழ: 'zh', ள: 'l', ற: 'r', ன: 'n',
  // vowel signs
  'ா': 'a', 'ி': 'i', 'ீ': 'i', 'ு': 'u', 'ூ': 'u', 'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au',
  // Grantha / borrowed letters common in Tamil names and places
  ஜ: 'j', ஷ: 'sh', ஸ: 's', ஹ: 'h',
  // misc: pulli (virama) silences the inherent vowel, anusvara, digits
  '்': '', 'ஃ': 'f', 'ஂ': 'm',
  '௦': '0', '௧': '1', '௨': '2', '௩': '3', '௪': '4', '௫': '5', '௬': '6', '௭': '7', '௮': '8', '௯': '9',
};

/**
 * Romanises Tamil so hashtags are discoverable outside Tamil-script search.
 *
 * Tamil consonants carry an inherent "a" when nothing else follows them, so
 * the mapping is two-pass: a bare consonant emits its inherent vowel, and a
 * following vowel sign replaces it. Getting this wrong produces the classic
 * "#tharapurm" instead of "#tharapuram".
 */
const TAMIL_VOWEL_SIGNS = new Set(['ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ']);
const TAMIL_CONSONANTS = new Set([
  'க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம',
  'ய', 'ர', 'ல', 'வ', 'ழ', 'ள', 'ற', 'ன',
  'ஜ', 'ஷ', 'ஸ', 'ஹ',
]);
const TAMIL_PULLI = '்';

export function romanise(text: string): string {
  const chars = [...text];
  let out = '';

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];

    if (/[A-Za-z0-9\s]/.test(ch)) {
      out += ch;
      continue;
    }

    // Pulli (virama): kills the inherent vowel of the previous consonant.
    if (ch === TAMIL_PULLI) {
      if (out.endsWith('a')) out = out.slice(0, -1);
      continue;
    }

    const next = chars[i + 1];

    if (TAMIL_CONSONANTS.has(ch)) {
      const base = TAMIL_MAP[ch] ?? '';
      // Consonant + vowel sign -> consonant + that vowel, no inherent "a".
      if (next && TAMIL_VOWEL_SIGNS.has(next)) {
        out += base;
        continue;
      }
      // Consonant at end of word, or before a space/another consonant.
      out += `${base}a`;
      continue;
    }

    out += TAMIL_MAP[ch] ?? '';
  }

  return out
    .replace(/\s+/g, ' ')
    .replace(/(.)\1{3,}/g, '$1$1')
    .trim();
}

/** Lower-case, strip diacritics, drop non-alphanumerics - safe for hashtags. */
/**
 * Lower-cases, strips diacritics, and drops everything that cannot live in a
 * Latin-script hashtag. Tamil is romanised first because native-script tags
 * have far lower reach on most platforms.
 */
export function toHashtagToken(word: string): string {
  const base = romanise(word)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return base;
}

/** Strips spaces/punctuation but keeps every letter, mark and digit. */
export function toNativeTag(word: string): string {
  return word.replace(/[^\p{L}\p{M}\p{N}_]/gu, '');
}

/* ----------------------------- sentence handling ---------------------------- */

/** Abbreviations after which a period does NOT end a sentence. */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'no', 'vs', 'etc', 'inc', 'ltd', 'co',
  'op', 'govt', 'dept', 'dist', 'sec', 'min', 'max', 'approx', 'est', 'fig', 'vol', 'pp',
  'am', 'pm', 'usa', 'uk', 'tn', 'nda', 'bjp', 'inc', 'aicc', 'dmk', 'aiadmk', 'bjp',
]);

/**
 * Splits into sentences without being destroyed by periods inside
 * abbreviations, decimals, URLs or non-Latin punctuation.
 */
export function splitSentences(text: string): string[] {
  const protectedText = text
    // keep decimals, versions and abbreviations intact while splitting
    .replace(/(\d)\.(\d)/g, '$1<DOT>$2')
    .replace(/\b([A-Za-z][A-Za-z.]{0,5})\.(?=\s|$)/g, (match, word: string) =>
      ABBREVIATIONS.has(word.toLowerCase().replace(/\.$/, '')) ? `${word}<DOT>` : match,
    )
    .replace(/(https?:\/\/)\./g, '$1<DOT>');

  return protectedText
    .split(/(?<=[.!?।\u2026])\s+|\n+/u)
    .flatMap((chunk) => chunk.split(/(?<=[.!?।\u2026])(?=["'(“])/u))
    .map((s) => s.replace(/<DOT>/g, '.').trim())
    .filter((s) => s.length > 0);
}

export function joinSentences(sentences: string[], separator = ' '): string {
  return sentences.join(separator).replace(/\s+/g, ' ').trim();
}

/** Collapses whitespace and tidies spacing after punctuation. Non-destructive. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=[^\s\d])/g, '$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Removes exact-duplicate sentences while preserving original order and casing. */
export function removeDuplicateSentences(text: string): string {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const sentence of splitSentences(text)) {
    const key = sentence.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').trim();
    if (key.length < 2 || seen.has(key)) continue;
    seen.add(key);
    kept.push(sentence);
  }

  return kept.join(' ');
}

function balancePunctuation(text: string, tone: string): string {
  let out = text.replace(/!{2,}/g, '!');
  if (tone === 'professional' || tone === 'formal' || tone === 'neutral') {
    out = out
      .replace(/!+(?=\s|$)/g, '.')
      .replace(/\?{2,}/g, '?');
  }
  if (tone === 'urgent' || tone === 'news' || tone === 'breaking') {
    out = out.replace(/(?<!\.)\n(?=[A-Z])/g, '. ');
  }
  return out;
}

/**
 * Applies tone WITHOUT destroying the text. The old implementation lower-cased
 * everything and turned every "." into "!" - this only adjusts punctuation
 * intensity, sentence casing and contraction style.
 */
export function adjustTone(text: string, tone: string): string {
  let out = normalizeText(text);
  out = balancePunctuation(out, tone);

  const sentences = splitSentences(out);
  const styled = sentences.map((sentence, i) => {
    let s = sentence.trim();
    const terminal = /[.!?।…]$/.exec(s)?.[0];

    if (i > 0 && /^[a-z]/.test(s) && !/[.!?।…]$/.test(s)) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
    }

    if (terminal) {
      const body = s.slice(0, -1);
      const capped = body.charAt(0).toUpperCase() + body.slice(1);
      s = capped + (tone === 'casual' || tone === 'funny' ? (Math.random() < 0.4 ? '!' : '.') : terminal);
    }

    if (tone === 'casual' || tone === 'funny') {
      s = s.replace(/\bdo not\b/gi, "don't")
        .replace(/\bdoes not\b/gi, "doesn't")
        .replace(/\bis not\b/gi, "isn't")
        .replace(/\bcannot\b/gi, "can't")
        .replace(/\bwill not\b/gi, "won't")
        .replace(/\bwe are\b/gi, "we're");
    }

    return s;
  });

  return styled.join(' ');
}

/* -------------------------------- keywords --------------------------------- */

const STOP_WORDS = new Set([
  // english
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'it', 'its', 'this',
  'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'our', 'their', 'what', 'which', 'who', 'whom', 'where', 'when', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
  'here', 'there', 'then', 'once', 'after', 'before', 'over', 'under', 'into', 'about', 'as',
  'அது', 'இது', 'அந்த', 'இந்த', 'மற்றும்', 'ஆனால்', 'என்று', 'என', 'உள்ள', 'இருந்து', 'வரை',
  'ஆக', 'ஒரு', 'அவர்', 'அவள்', 'அவர்கள்', 'நான்', 'நாம்', 'நீ', 'உங்கள்', 'என்', 'எங்கள்',
  'का', 'की', 'के', 'है', 'हैं', 'में', 'से', 'और', 'का', 'को', 'पर', 'यह', 'वह', 'एक',
]);

/**
 * Unicode-aware keyword extraction. The previous `[^\w\s]` regex threw away
 * every Tamil/Devanagari character, so Indic input produced zero keywords.
 * Proper nouns (capitalised mid-sentence) are boosted, which matters a lot for
 * news text where "Coimbatore" or "Kozhipalur" carry the story.
 */
export function extractKeywords(text: string, limit = 10): string[] {
  const words = text.match(/[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’.%-]*/gu) ?? [];
  const frequency = new Map<string, { count: number; proper: number; key?: string }>();

  for (const raw of words) {
    const word = raw.replace(/^[-'’.]+|[-'’.]+$/g, '');
    if (word.length < 2) continue;

    const lower = word.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;
    if (/^\d+$/.test(word)) continue;

    const isProper = /^\p{Lu}/u.test(word) && word !== word.toUpperCase();
    const current = frequency.get(lower) ?? { count: 0, proper: 0 };
    current.count += 1;
    if (isProper) current.proper += 1;
    frequency.set(lower, current);

    // Keep the best-cased surface form for display.
    if (isProper && !/^\p{Lu}/u.test(current.key ?? '')) {
      current.key = word;
    }
  }

  const entries = [...frequency.entries()].map(([key, v]) => ({
    display: v.key ?? key,
    key,
    score: v.count + v.proper * 2,
  }));

  return entries
    .sort((a, b) => b.score - a.score || b.display.length - a.display.length)
    .slice(0, limit)
    .map((e) => e.display);
}

/* --------------------------------- hashtags -------------------------------- */

function detectRegion(text: string): string | null {
  const lower = text.toLowerCase();
  if (/தமிழ்நாடு|தமிழ்|தாராபுரம்|கோவை|சென்னை|மதுரை|tamil ?nadu/.test(lower)) return 'tamilnadu';
  if (/\bindia\b|இந்தியா|भारत/.test(lower)) return 'india';
  return null;
}

/**
 * Builds hashtags that actually work per platform.
 * `script` controls native vs romanised (many platforms index hashtags written
 * in Latin letters far better even for Tamil-language content).
 */
export function generateHashtags(
  keywords: string[],
  options: { category?: string; platform?: string; limit?: number; script?: string } = {},
): string[] {
  const { category, platform, limit = 8, script = 'auto' } = options;
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (tag: string) => {
    // \p{M} (combining marks) is essential: Tamil, Devanagari, Telugu and
    // Kannada strip their vowel signs into marks. Excluding it silently
    // deleted them and produced "#இடததரதல" instead of "#இடைத்தேர்தல்".
    const clean = tag.replace(/[^\p{L}\p{M}\p{N}_]/gu, '');
    if (!clean) return;
    const key = toHashtagToken(clean) || clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean.startsWith('#') ? clean : `#${clean}`);
  };

  // Pinterest / LinkedIn / Reddit mostly index Latin-script tags.
  const romanPreferred = platform === 'pinterest' || platform === 'linkedin' || platform === 'reddit';
  const useRoman = script === 'roman' || (script === 'auto' && romanPreferred);
  const useBoth = script === 'both';

  // "Already Latin" means every character is a plain ASCII letter/digit, i.e.
  // romanisation would add nothing.
  const isLatin = (word: string) => !/[^\p{ASCII}]/u.test(word);

  for (const keyword of keywords) {
    const native = toNativeTag(keyword);
    const roman = toHashtagToken(keyword);

    if (useBoth) {
      // Native first, then its romanised twin. Both are useful: one reaches
      // native-script search, the other reaches everyone typing in Latin.
      if (native && !isLatin(native)) add(native);
      if (roman) add(roman);
    } else if (useRoman) {
      if (roman) add(roman);
      else if (native) add(native);
    } else {
      if (native) add(native);
      else if (roman) add(roman);
    }
  }

  if (category && TRENDING_HASHTAGS[category]) {
    TRENDING_HASHTAGS[category].slice(0, 4).forEach(add);
  }

  const general = TRENDING_HASHTAGS.general ?? [];
  const region = detectRegion(keywords.join(' '));
  const regional = region ? REGION_HASHTAGS[region] : undefined;
  if (regional) regional.slice(0, 3).forEach(add);
  else general.slice(0, platform === 'twitter' ? 1 : 2).forEach(add);

  return out.slice(0, limit);
}

/* ---------------------------------- CTAs ----------------------------------- */

/**
 * Picks a CTA. `variant` makes the choice deterministic per variation so a set
 * of posts does not all end with the identical line - and so that regenerating
 * the same variation twice gives the same result.
 */
export function generateCTA(tone: string, ctaKind = 'share', custom?: string, variant = 0): string {
  if (custom?.trim()) return custom.trim();

  const pick = (options: string[]) => options[variant % options.length];

  const byKind: Record<string, string[]> = {
    follow: ['Follow the page for more updates', 'Hit follow so you do not miss the next one', 'Turn on notifications'],
    share: ['Share this with someone who needs to see it', 'Forward this to your family and friends', 'Send this to one person who should read it', 'Share it in the group chat before it is forgotten'],
    comment: ['Tell us what you think in the comments', 'Drop your view below', 'What did we miss? Tell us'],
    vote: ['Make your voice heard - cast your vote', 'Stand up and be counted', 'Every vote counts. Go vote'],
    link: ['Full details at the link in bio', 'Read the complete story at the link', 'Everything else is at the link'],
    join: ['Join the movement today', 'Stand with us - share your support', 'Add your name to the list'],
  };

  if (ctaKind && byKind[ctaKind]) return pick(byKind[ctaKind]);

  const professional = ['Learn more at the link', 'Visit our website', 'Discover more', 'Get started today'];
  const friendly = ['Share your thoughts below!', 'Drop a comment!', 'What do you think?', 'Would you agree?'];
  const casual = ['Check it out!', 'Let me know what you think', 'Pretty cool right?', 'Thoughts?'];
  const marketing = ['Limited time offer - Act now!', 'Click to learn more', "Don't miss out!", 'Only for today'];

  switch (tone) {
    case 'professional':
    case 'formal':
      return pick(professional);
    case 'friendly':
      return pick(friendly);
    case 'casual':
      return pick(casual);
    case 'marketing':
      return pick(marketing);
    default:
      return pick(CTA_PHRASES);
  }
}

/* ------------------------------- truncation -------------------------------- */

export function truncateToLimit(text: string, limit: number): string {
  const chars = [...text];
  if (chars.length <= limit) return text;
  const clipped = chars.slice(0, Math.max(0, limit - 1)).join('');
  const lastSpace = clipped.lastIndexOf(' ');
  const body = (lastSpace > limit * 0.6 ? clipped.slice(0, lastSpace) : clipped).replace(/[\s,;:.-]+$/, '');
  return `${body}…`;
}

/**
 * Fits the body into the platform limit while guaranteeing that the CTA and
 * hashtag block survive. The old code truncated the whole thing and could chop
 * hashtags in half, producing broken tags.
 */
export function fitToLimit(body: string, tail: string, limit: number): { body: string; tail: string; fits: boolean } {
  const tailChars = countCharacters(tail);
  if (countCharacters(body) + tailChars <= limit) return { body, tail, fits: true };

  const room = Math.max(0, limit - tailChars);
  return { body: truncateToLimit(body, room), tail, fits: false };
}

/* ------------------------------ summarisation ------------------------------ */

/**
 * Extractive summary. Scores sentences by keyword overlap, position, numbers
 * and length instead of the old "count of long words" heuristic.
 */
export function summarizeContent(text: string, maxSentences = 3): string {
  const sentences = splitSentences(text).filter((s) => countWords(s) > 2);
  if (sentences.length <= maxSentences) return sentences.join(' ');

  const keywords = new Set(extractKeywords(text, 12).map((k) => k.toLowerCase()));
  const scored = sentences.map((sentence, index) => {
    const words = (sentence.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''));
    const overlap = words.filter((w) => keywords.has(w)).length;
    const numbers = (sentence.match(/\d+/g) ?? []).length;
    const positionBonus = index === 0 ? 1.5 : index === 1 ? 0.75 : 0;
    const lengthPenalty = words.length < 4 || words.length > 45 ? -1 : 0;
    return { sentence, index, score: overlap + numbers * 0.8 + positionBonus + lengthPenalty };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence.trim())
    .join(' ');
}

/* --------------------------------- platform -------------------------------- */

export function getPlatformById(id: string) {
  return PLATFORMS.find((p) => p.id === id) as (typeof PLATFORMS)[number] | undefined;
}

/** Sensible character budget per length setting. */
export function targetLength(limit: number, length: string): number {
  switch (length) {
    case 'short':
      return Math.min(limit, 120);
    case 'detailed':
      return Math.min(limit, Math.round(limit * 0.75));
    case 'long':
      return limit;
    default:
      return Math.min(limit, 320);
  }
}

const EMOJI_BANK: Record<string, string[]> = {
  news: ['📰', '🗞️', '📢', '🌀', '🇮🇳'],
  politics: ['🗳️', '🇮🇳', '📣', '🏛️', '🗣️'],
  breaking: ['🚨', '📢', '⚡', '🔴'],
  journey: ['🚗', '🛣️', '📍', '🗺️', '🚉'],
  speech: ['🎤', '📣', '🙏', '👥'],
  scheme: ['🎁', '✅', '🏛️', '📋'],
  opinion: ['💭', '✍️', '🗣️'],
  event: ['📅', '📍', '🎉', '🎫'],
  general: ['✨', '📌', '💬', '👇', '📈'],
};

export function pickEmojis(category: string, count: number): string[] {
  const bank = EMOJI_BANK[category] ?? EMOJI_BANK.general;
  const picked: string[] = [];
  for (let i = 0; i < count; i += 1) picked.push(bank[i % bank.length]);
  return [...new Set(picked)];
}

/**
 * Platform-native structure. Shortens by selecting whole sentences rather than
 * chopping mid-word, and keeps media hints in the platform's own convention.
 */
export function formatContentForPlatform(
  content: string,
  platform: string,
  tone: string,
  length = 'standard',
): string {
  const info = getPlatformById(platform);
  if (!info) return adjustTone(content, tone);

  let text = adjustTone(content, tone);
  const budget = targetLength(info.charLimit, length);
  const sentences = splitSentences(text);

  if (countCharacters(text) > budget) {
    const kept: string[] = [];
    let used = 0;
    for (const sentence of sentences) {
      const cost = countCharacters(sentence) + 1;
      if (used + cost > budget && kept.length > 0) break;
      kept.push(sentence);
      used += cost;
    }
    text = kept.join(' ');
    if (countCharacters(text) > budget) text = truncateToLimit(text, budget);
  }

  switch (platform) {
    case 'twitter':
    case 'threads':
    case 'snapchat':
      text = text.replace(/\n{2,}/g, ' ').trim();
      break;
    case 'instagram':
    case 'tiktok':
    case 'pinterest':
      text = sentences.slice(0, 6).join('\n');
      break;
    case 'linkedin':
      text = text.replace(/([.!?])\s+/g, '$1\n\n');
      break;
    case 'whatsapp':
    case 'telegram':
      text = text.replace(/([.!?])\s+/g, '$1\n');
      break;
    case 'youtube_description':
      text = `${text}\n\n---\n\nSubscribe for more updates.`;
      break;
    default:
      break;
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/* --------------------------------- SEO ------------------------------------- */

export function suggestSEOKeywords(content: string, limit = 15): string[] {
  const keywords = extractKeywords(content, 8);
  const out = [...keywords];
  for (const keyword of keywords) {
    if (countCharacters(keyword) > 4) {
      out.push(`${keyword} latest`, `best ${keyword}`);
    }
  }
  return [...new Set(out)].slice(0, limit);
}
