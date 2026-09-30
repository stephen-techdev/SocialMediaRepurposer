/**
 * Prompt construction for the AI engine.
 *
 * The single biggest quality lever here is the platform playbook: raw "write a
 * post" prompts produce generic output. Each entry below states the real
 * constraints of that platform (limits, hashtag conventions, formatting).
 */
import { AUDIENCES, CONTENT_TYPES, HOOK_STYLES, LANGUAGES, LENGTHS, TONES } from './constants';
import { viralInstruction } from './viral';

export const SYSTEM_PROMPT = `You are a senior social media strategist and newsroom copywriter who works in Indian political and civic communication.

ABSOLUTE RULES
1. Never invent facts. Only use names, places, dates, numbers, party names and quotes present in the SOURCE. If something is missing, do not add it.
2. Preserve every proper noun and number EXACTLY as written in the source (for example: Vijay, Tamil Nadu, Coimbatore, Kozhipalur). Do not anglicise, correct or "improve" them.
3. Write in the requested output language and script. If the language is Tamil, the output must be in Tamil script, not romanised Tamil. Never mix scripts mid-sentence.
4. Respect the character limit HARD. Count characters, not words. Stay under it.
5. No filler. No "In today's fast-paced world". No invented statistics. No fake quotes.
6. Return ONLY valid JSON matching the requested schema. No markdown fences, no commentary.

VOICE
- Lead with the hook. First line is the only thing most people read.
- Short sentences. Active voice. Specific over vague.
- Respectful about political figures and institutions unless the tone is explicitly opposing.
- Reading level: understandable by a general smartphone audience.`;

export interface PromptContext {
  content: string;
  platform: string;
  tone: string;
  language: string;
  audience: string;
  contentType: string;
  hookStyle: string;
  length: string;
  emojiDensity: string;
  includeHashtags: boolean;
  hashtagCount: number;
  hashtagPlacement: string;
  hashtagScript: string;
  includeCTA: boolean;
  ctaKind: string;
  customCTA: string;
  extraTags: string[];
  variations: number;
  notes: string;
  /** Virality optimisation. */
  viralIntensity: string;
  viralTactics: string[];
  /**
   * Optional image context. Filled in by the generator per-platform (see
   * lib/images.ts), so callers of buildPrompt do not need to set it.
   */
  imageContext?: string;
  includeAltText?: boolean;
}

const label = (list: readonly { id: string; name: string }[], id: string): string =>
  list.find((item) => item.id === id)?.name ?? id;

const hint = (list: readonly { id: string; name: string; hint?: string }[], id: string): string =>
  list.find((item) => item.id === id)?.hint ?? '';

export interface PlatformPlaybook {
  name: string;
  limit: number;
  rules: string[];
  format: string;
}

export const PLATFORM_PLAYBOOKS: Record<string, PlatformPlaybook> = {
  twitter: {
    name: 'X (Twitter)',
    limit: 280,
    rules: [
      'Single post unless the hook style asks for a thread - if a thread, number each line "1/", "2/" and keep each tweet under 270 characters.',
      'Maximum 2 hashtags. One emoji at most, at the very start.',
      'No line breaks unless it is a thread. Hook must work in the first 100 characters.',
    ],
    format: 'One tight block.',
  },
  threads: {
    name: 'Threads',
    limit: 500,
    rules: ['Conversational, like a friend explaining it.', '1-3 hashtags.', 'Short paragraphs, blank line between thoughts.'],
    format: 'Two or three short paragraphs.',
  },
  snapchat: {
    name: 'Snapchat Spotlight',
    limit: 250,
    rules: ['Very short. One idea only.', '0-1 hashtags, no emoji needed.', 'Written for the on-screen caption overlay.'],
    format: 'One punchy sentence.',
  },
  instagram: {
    name: 'Instagram',
    limit: 2200,
    rules: [
      'Hook line first, then a blank line, then 3-5 short content lines, then hashtags.',
      'Line breaks are the main design tool. Keep every line under 60 characters so it renders well.',
      'Emoji may sit at the end of a line, not scattered randomly.',
    ],
    format: 'Hook line, blank line, short lines, blank line, hashtags.',
  },
  tiktok: {
    name: 'TikTok',
    limit: 2200,
    rules: ['Write for on-screen text, keep it scannable.', 'Short lines, generous line breaks.', 'Include a suggested on-screen text block at the end.'],
    format: 'Hook, short lines, then "On-screen text: ..." suggestion.',
  },
  youtube_community: {
    name: 'YouTube Community post',
    limit: 2500,
    rules: ['Direct address to subscribers. Ask a question to drive replies.', 'Emoji allowed.', 'Short paragraphs.'],
    format: 'Post body, then a question line, then hashtags.',
  },
  linkedin: {
    name: 'LinkedIn',
    limit: 3000,
    rules: [
      'No hashtags in the body. Put 3-5 at the very end on their own line.',
      'Short paragraphs of 1-2 sentences, separated by blank lines.',
      'First line must be a standalone hook that survives the "see more" cut.',
      'End with a question to drive comments.',
    ],
    format: 'Hook line, blank line, 2-4 short paragraphs, blank line, question, blank line, hashtags.',
  },
  whatsapp: {
    name: 'WhatsApp Status',
    limit: 700,
    rules: [
      'NO hashtags and NO @mentions - forwarded messages get flagged.',
      'Plain, simple, readable language. Assume the reader is on a phone with no keyboard shortcuts.',
      'Short lines of 6-8 words so it is readable on the status screen.',
      'One emoji at most, only if the tone allows.',
    ],
    format: 'Two or three short lines.',
  },
  telegram: {
    name: 'Telegram channel',
    limit: 4096,
    rules: ['Readable in-channel formatting, short paragraphs.', 'Optional emoji per section.', '0-3 hashtags, only if the channel normally uses them.'],
    format: 'Headline, blank line, body, blank line, optional tags.',
  },
  facebook: {
    name: 'Facebook',
    limit: 5000,
    rules: ['Complete sentences, moderate length.', 'Ask a question or invite reaction.', '1-3 hashtags at the end.'],
    format: 'Hook, short paragraphs, question, hashtags.',
  },
  pinterest: {
    name: 'Pinterest',
    limit: 500,
    rules: [
      'Keyword-driven. This is a search product, not a feed.',
      'Include 5-8 keyword-rich hashtags.',
      'Write a searchable pin description, not a caption.',
    ],
    format: 'One descriptive paragraph then hashtags.',
  },
  reddit: {
    name: 'Reddit',
    limit: 40000,
    rules: [
      'Return a "title" field: a factual, non-clickbait headline under 300 characters.',
      'Body must read as informational. No hashtags, no marketing language, no emoji.',
      'Neutral, sourced tone.',
    ],
    format: 'Separate title and body.',
  },
  youtube_description: {
    name: 'YouTube description',
    limit: 5000,
    rules: [
      'First 2 lines are the only ones visible before "Show more" - put the summary there.',
      'Then timestamps/sections if relevant, then links placeholder, then 3-5 hashtags.',
    ],
    format: 'Summary, blank line, sections, blank line, hashtags.',
  },
  medium: {
    name: 'Medium article',
    limit: 20000,
    rules: ['Article structure with a subtitle.', 'Paragraphs of 2-4 sentences. Section subheads.', 'No hashtags in the body.'],
    format: 'Title, subtitle, then subheads with paragraphs.',
  },
  blogger: {
    name: 'Blog post',
    limit: 40000,
    rules: ['SEO-aware structure: title, meta description, H2 subheads.', 'Write a meta description field of 140-155 characters.', 'No hashtags.'],
    format: 'Title, meta description, H2 sections with paragraphs.',
  },
};

const HASHTAG_RULES: Record<string, string> = {
  inline: 'Weave the hashtags naturally at the end of the LAST sentence of the body.',
  separate: 'Put the hashtags on their own line AFTER a blank line, at the very end of the post.',
  first_comment:
    'Do NOT put any hashtag inside the post. Put the hashtags in the "hashtags" field only - the app renders them as a first-comment block.',
};

const SCRIPT_RULES: Record<string, string> = {
  auto: 'Keep hashtags in the same script as the post language.',
  native: 'Hashtags MUST be written in the original script of the language.',
  roman: 'Hashtags MUST be romanised into Latin letters, no native script characters.',
  both: 'Give both variants: native-script tags first, then their romanised equivalents.',
};

export function buildPrompt(ctx: PromptContext, variationIndex: number): string {
  const playbook = PLATFORM_PLAYBOOKS[ctx.platform] ?? {
    name: ctx.platform,
    limit: 3000,
    rules: ['Respect the character limit.'],
    format: 'Short paragraphs.',
  };

  const language =
    ctx.language === 'auto'
      ? 'Same language and script as the SOURCE text.'
      : `${label(LANGUAGES, ctx.language)} - write entirely in this language and script.`;

  const emojiCount = { none: 0, light: 1, medium: 3, heavy: 6 }[ctx.emojiDensity] ?? 2;

  const variationAngle = [
    'Lead with the news itself, no teaser.',
    'Lead with the human detail (who, where, who was present).',
    'Lead with the consequence or what happens next.',
    'Lead with a direct question to the reader.',
    'Lead with the contrast between expectation and reality.',
  ][variationIndex % 5];

  const extra = ctx.extraTags.filter(Boolean).map((t) => t.replace(/^#/, ''));
  const imageContext = ctx.imageContext?.trim() ?? '';
  const hasImages = imageContext.length > 0;
  const wantsAltText = Boolean(ctx.includeAltText) && hasImages;

  return `TASK
Write ${ctx.variations > 1 ? `${ctx.variations} distinct variations` : '1 post'} for ${playbook.name}, repurposed from the SOURCE below.

SOURCE (do not add anything that is not here)
"""
${ctx.content.trim()}
"""

CONFIGURATION
- Content type: ${label(CONTENT_TYPES, ctx.contentType)} ${hint(CONTENT_TYPES, ctx.contentType)}
- Audience: ${label(AUDIENCES, ctx.audience)} ${hint(AUDIENCES, ctx.audience)}
- Tone: ${label(TONES, ctx.tone)}
- Language: ${language}
- Length: ${label(LENGTHS, ctx.length)} ${hint(LENGTHS, ctx.length)}
- Hook style: ${label(HOOK_STYLES, ctx.hookStyle)} ${hint(HOOK_STYLES, ctx.hookStyle)}
- Emoji: ${ctx.emojiDensity === 'none' ? 'Do not use any emoji.' : `Use about ${emojiCount} emoji, placed deliberately, never mid-word.`}
- Call to action: ${
    ctx.includeCTA
      ? ctx.ctaKind === 'custom'
        ? `Use EXACTLY this CTA and nothing else: "${ctx.customCTA}"`
        : `Add one short call to action. Intent: ${ctx.ctaKind.replace(/_/g, ' ')}.`
      : 'Do NOT include any call to action.'
  }
- Hashtags: ${
    ctx.includeHashtags
      ? `${ctx.hashtagCount} hashtags. Placement: ${HASHTAG_RULES[ctx.hashtagPlacement] ?? HASHTAG_RULES.separate} Script: ${SCRIPT_RULES[ctx.hashtagScript] ?? SCRIPT_RULES.auto}`
      : 'Do NOT use hashtags anywhere.'
}
${extra.length ? `- Hashtags that MUST be included: ${extra.map((t) => '#' + t).join(', ')}` : ''}
${viralInstruction(ctx.viralTactics, ctx.viralIntensity, label(AUDIENCES, ctx.audience))}
${hasImages ? `\nIMAGES\n${imageContext}\n${wantsAltText ? 'Add an "alt_text" field per variation with one line per image (max 125 characters each, describing only what is genuinely visible in the file the user attached - never invent content).\n' : ''}` : ''}

PLATFORM RULES (${playbook.name}, hard limit ${playbook.limit} characters)
${playbook.rules.map((r) => `- ${r}`).join('\n')}
Expected shape: ${playbook.format}

THIS VARIATION (#${variationIndex + 1})
${variationAngle}
${ctx.notes.trim() ? `\nEXTRA INSTRUCTIONS FROM THE USER\n${ctx.notes.trim()}` : ''}

OUTPUT SCHEMA - return exactly this JSON and nothing else
{
  "variations": [
    {
      "post": "the full ready-to-publish text, hashtags included only if placement is 'inline'",
      "hashtags": ["#tag1", "#tag2"],
      "cta": "the call to action sentence, or null",
      "hook": "just the first line, for display",
      "why": "one short sentence on why this works for this platform"${wantsAltText ? ',\n      "alt_text": "alt text for the attached images, or null"' : ''}
    }
  ]
}`;
}

export const AI_TOOL_SYSTEM_PROMPT = `You are a senior copywriter. Never invent facts, names, dates or numbers that are absent from the user's input. Return ONLY valid JSON matching the requested schema, with no markdown fences and no commentary.`;

export function buildToolPrompt(tool: string, input: string, tone: string, language: string): string {
  const shared = `TONE: ${tone}
LANGUAGE: ${language === 'auto' ? 'Same as the input.' : language}
Keep every proper noun and number exactly as written in the input.

INPUT
"""
${input}
"""

`;

  const schemas: Record<string, string> = {
    caption: `Write 5 distinct social captions. Return {"items":[{"text":"...","hashtags":["#a"],"why":"..."}]}`,
    title: `Write 10 title options, varied in style. Return {"items":[{"text":"..."}]}`,
    headline: `Write 10 news headlines for this item. Factual, no clickbait, no invented facts, max 12 words each. Return {"items":[{"text":"..."}]}`,
    bio: `Write 3 bio options (max 150 characters each). Return {"items":[{"text":"..."}]}`,
    product: `Write 3 product descriptions. Return {"items":[{"text":"..."}]}`,
    ad_copy: `Write 3 ad copy options with a headline and body. Return {"items":[{"text":"..."}]}`,
    email: `Write 3 email subject + body options. Return {"items":[{"text":"Subject: ...\\n\\n..."}]}`,
    linkedin: `Write 3 LinkedIn posts, short paragraphs, no hashtags in the body. Return {"items":[{"text":"..."}]}`,
    youtube_title: `Write 10 YouTube title options under 70 characters. Return {"items":[{"text":"..."}]}`,
    youtube_desc: `Write 3 YouTube descriptions with summary, sections and hashtags. Return {"items":[{"text":"..."}]}`,
    video_script: `Write 3 short video scripts with timestamps and on-screen text cues. Return {"items":[{"text":"..."}]}`,
    blog_summary: `Write 3 summaries of different lengths (short, medium, long). Return {"items":[{"text":"..."}]}`,
    thread: `Write a numbered Twitter/X thread. Return {"items":[{"text":"1/ ...\\n2/ ..."}]}`,
    quote_card: `Write 8 short punchy lines (under 90 characters) suitable for a quote image. Return {"items":[{"text":"..."}]}`,
  };

  return shared + (schemas[tool] ?? schemas.caption);
}
