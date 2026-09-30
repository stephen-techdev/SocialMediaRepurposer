/**
 * Virality analysis.
 *
 * Scores a draft on the things that actually drive reach, using platform rules
 * rather than vibes. Two jobs:
 *  1. Tell the AI model which viral levers to pull (see buildPrompt).
 *  2. Score the output afterwards so the user can see WHY something works and
 *     which variation is the one worth posting.
 */
import { countCharacters, countWords, detectScript, splitSentences } from './utils';

export interface ViralTactic {
  id: string;
  name: string;
  hint: string;
}

export const VIRAL_TACTICS: ViralTactic[] = [
  { id: 'curiosity_gap', name: 'Curiosity gap', hint: 'Open a loop in line 1 that only the body closes' },
  { id: 'pattern_interrupt', name: 'Pattern interrupt', hint: 'Break the expected sentence pattern early' },
  { id: 'numbers', name: 'Numbers & specifics', hint: 'Concrete figures beat vague claims' },
  { id: 'emotion', name: 'Emotion', hint: 'Pride, anger, hope, belonging - name the feeling' },
  { id: 'identity', name: 'Identity', hint: '"This is for people who..." - makes it about the reader' },
  { id: 'contrast', name: 'Contrast / before-after', hint: 'Set two opposed states against each other' },
  { id: 'stakes', name: 'Stakes', hint: 'Say what is lost if nothing changes' },
  { id: 'social_proof', name: 'Crowd signal', hint: 'Scale, turnout, people power, "across Tamil Nadu"' },
  { id: 'share_trigger', name: 'Share trigger', hint: 'Give a reason to forward it to someone specific' },
  { id: 'debate', name: 'Open debate', hint: 'Ask the thing people will argue about' },
  { id: 'scannable', name: 'Scannable', hint: 'Short lines, white space, one idea per line' },
  { id: 'local_pride', name: 'Local pride', hint: 'Name the city, region, community precisely' },
];

export const VIRAL_INTENSITY = [
  { id: 'off', name: 'Off', hint: 'Straight reporting, no optimisation' },
  { id: 'subtle', name: 'Subtle', hint: 'One or two levers, keeps it credible' },
  { id: 'strong', name: 'Strong', hint: 'Several levers, still honest' },
  { id: 'maximum', name: 'Maximum', hint: 'Every lever. Expect pushback from some readers' },
] as const;

export interface ViralScore {
  /** 0-100 overall. */
  score: number;
  grade: 'weak' | 'fair' | 'good' | 'strong' | 'viral';
  breakdown: Array<{ label: string; got: number; max: number; tip: string }>;
  strengths: string[];
  gaps: string[];
}

// Non-global regexes: `.test()` on a /g regex is stateful and silently
// returns wrong answers on every second call.
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const EMOJI_ONLY_RE = /^[\p{Extended_Pictographic}\s]+$/u;
const NUMBER_RE = /\b\d[\d,.]*\b/g;
const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;
const QUESTION_RE = /[?]/;
const UPPERCASE_RE = /\p{Lu}/gu;
const WEAK_OPENER_RE = /^(this|it|they|that|these|those)\b/i;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Platform-aware scoring. Weights differ because a 600-character LinkedIn post
 * and a 270-character X post do not reward the same things.
 */
export function scoreViral(post: string, platform: string): ViralScore {
  const text = post.trim();
  const words = countWords(text);
  const allLines = text.split('\n');
  const lines = allLines.filter((l) => l.trim());
  const sentences = splitSentences(text);
  // The hook is the first LINE, not the first sentence: on Instagram and
  // WhatsApp a three-line opener ("180 km. / 3 districts. / 72% turnout.")
  // is one hook, and scoring it as one 2-word sentence is wrong.
  const firstLine = lines[0] ?? '';
  const hookText = firstLine;
  const firstWords = countWords(hookText);

  // Emoji, hashtag and CTA lines are not part of the caption body, so they must
  // not count against the length budget.
  const body = allLines
    .filter((l) => l.trim() && !/^#/.test(l.trim()) && !EMOJI_ONLY_RE.test(l.trim()))
    .join('\n')
    .trim();
  const bodyChars = countCharacters(body || text);

  const limit =
    { twitter: 280, threads: 500, snapchat: 250, whatsapp: 700, instagram: 2200, tiktok: 2200, linkedin: 3000 }[
      platform
    ] ?? 1000;
  const nonLatin = detectScript(text) !== 'latin';

  const breakdown: ViralScore['breakdown'] = [];
  const strengths: string[] = [];
  const gaps: string[] = [];

  const add = (label: string, got: number, max: number, tip: string) => {
    breakdown.push({ label, got: Math.round(got), max, tip });
    if (got >= max * 0.7) strengths.push(label);
    else if (tip) gaps.push(tip);
  };

  /* ---- 1. The hook (heaviest single factor) ----------------------------- */
  {
    const max = 30;
    let got = 0;
    // A punchy numeric hook is short by design, so allow 3+ words here.
    const lenOk = firstWords >= 3 && firstWords <= 28;
    if (lenOk) got += 10;
    if (QUESTION_RE.test(hookText)) got += 7;
    if ((hookText.match(NUMBER_RE) ?? []).length > 0) got += 6;
    if (/\b(why|how|what|who|when|which)\b/i.test(hookText) || QUESTION_RE.test(hookText)) got += 4;
    if (EMOJI_RE.test(hookText)) got += 3;
    // A hook must be self-contained: never open with a bare demonstrative.
    if (WEAK_OPENER_RE.test(hookText.trim())) got -= 4;
    add('Hook strength', clamp(got, 0, max), max, 'Rewrite line 1: lead with the stake, the number or the question - never with "This".');
  }

  /* ---- 2. Specificity --------------------------------------------------- */
  {
    const max = 20;
    const numbers = text.match(NUMBER_RE)?.length ?? 0;
    const names = (text.match(UPPERCASE_RE) ?? []).length;
    let got = 0;
    got += clamp(numbers, 0, 3) * 4;
    got += clamp(Math.floor(names / 4), 0, 2) * 2;
    if (sentences.some((s) => s.includes(':') || s.includes(',') && s.length > 60)) got += 2;
    add('Specificity', clamp(got, 0, max), max, 'Add real numbers, places, dates and names from the source. Vague claims do not travel.');
  }

  /* ---- 3. Scannability -------------------------------------------------- */
  {
    const max = 15;
    let got = 0;
    const shortLines = lines.filter((l) => countCharacters(l) <= 60).length;
    got += lines.length > 1 ? clamp(Math.round((shortLines / lines.length) * 10), 0, 10) : 4;
    const avgSentence = sentences.length ? countWords(body || text) / sentences.length : words;
    if (avgSentence <= 18) got += 5;
    else if (avgSentence <= 26) got += 3;
    add('Scannability', clamp(got, 0, max), max, 'Break into lines under 60 characters and keep sentences short - most people read on a phone.');
  }

  /* ---- 4. Share & comment triggers -------------------------------------- */
  {
    const max = 20;
    let got = 0;
    if (QUESTION_RE.test(text)) got += 8;
    const tags = text.match(HASHTAG_RE)?.length ?? 0;
    got += tags === 0 ? 0 : tags <= 5 ? 6 : tags <= 12 ? 4 : 1;
    // Any explicit ask to pass it on counts, not just the word "share".
    const SHARE_ASK_RE = /\b(share|forward|tag|send|pass it on|show this|tell \w+|கம்பி|பகிர|அனுப்ப)\w*/i;
    if (SHARE_ASK_RE.test(text)) got += 6;
    if (/\b(you|your|உங்கள்|நீ)\b/i.test(text)) got += 3;
    add('Share & comment triggers', clamp(got, 0, max), max, 'End with one question and one clear reason to share - "send this to the person who still believes..."');
  }

  /* ---- 5. Length discipline --------------------------------------------- */
  {
    const max = 15;
    const ideal = platform === 'twitter' || platform === 'snapchat' ? 0.75 : platform === 'whatsapp' ? 0.5 : 0.4;
    let got = 15;
    // `density` is measured against the body only - hashtags and a CTA are
    // charged to the platform's own limit, not the caption's.
    const bodyDensity = limit ? bodyChars / limit : 1;
    if (bodyDensity > 1) got = 2;
    else if (bodyDensity > 0.92) got = 6;
    else if (bodyDensity > ideal + 0.35) got = 11;
    add(
      'Length fit',
      got,
      max,
      got >= 11
        ? ''
        : bodyDensity > 1
          ? `Over the ${limit} character limit for ${platform} - trim before posting.`
          : platform === 'twitter' || platform === 'snapchat'
            ? 'X posts read best at 200-260 characters - add the detail that makes it worth the swipe.'
            : 'You are under-filling the platform. Add the detail that makes it shareable.',
    );
  }

  /* ---- 6. Emotional pull ----------------------------------------------- */
  {
    const max = 10;
    let got = 0;
    // Deliberately generous: any strong-feeling word counts, in any script.
    const EMOTION_WORDS =
      /\b(proud|pride|angry|anger|fear|fearless|hope|hopeful|dream|struggle|victory|defeat|sacrifice|courage|brave|unity|united|together|first|history|remember|shame|disappoint\w*|fight\w*|win\w*|lost\w*|moment|turning|change\w*|promise|commit\w*|accountab\w*|justice|rights|victim\w*)\b/i;
    const haystack = body || text;
    if (EMOTION_WORDS.test(haystack)) got += 5;
    if (/\b(all|every|each|everyone|together|across|எல்லா|ஒன்றிணைந்த)\b/i.test(haystack)) got += 3;
    // Second-person address is the cheapest reliable emotion signal on social.
    if (/\b(you|your|you're|உங்கள்|நீ)\b/i.test(haystack)) got += 2;
    if (/!/.test(haystack)) got += 2;
    add(
      'Emotional pull',
      clamp(got, 0, max),
      max,
      got >= 3 ? '' : 'Name the feeling explicitly - pride, urgency or belonging - in plain words.',
    );
  }

  const total = breakdown.reduce((sum, b) => sum + b.got, 0);
  const maxTotal = breakdown.reduce((sum, b) => sum + b.max, 0);
  const score = Math.round((total / maxTotal) * 100);

  const grade: ViralScore['grade'] =
    score >= 82 ? 'viral' : score >= 68 ? 'strong' : score >= 52 ? 'good' : score >= 34 ? 'fair' : 'weak';

  if (nonLatin) {
    // Non-Latin scripts are judged on different norms; be slightly generous so
    // Tamil/Hindi output is not unfairly penalised for whitespace heuristics.
    strengths.push('Original script preserved');
  }

  return { score, grade, breakdown, strengths, gaps: [...new Set(gaps)].filter(Boolean) };
}

export const GRADE_STYLE: Record<ViralScore['grade'], { label: string; className: string }> = {
  weak: { label: 'Weak', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  fair: { label: 'Fair', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  good: { label: 'Good', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  strong: { label: 'Strong', className: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  viral: { label: 'Viral-ready', className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
};

/** Instruction block injected into the prompt when virality is switched on. */
export function viralInstruction(tactics: string[], intensity: string, audienceLabel: string): string {
  if (intensity === 'off' || !tactics.length) return '';

  const selected = tactics
    .map((id) => VIRAL_TACTICS.find((t) => t.id === id))
    .filter(Boolean)
    .map((t) => `- ${t!.name}: ${t!.hint}`)
    .join('\n');

  const budget =
    intensity === 'maximum'
      ? 'Use EVERY tactic below. Push hard. Staying factual is still required, but do not sand off the energy.'
      : intensity === 'strong'
        ? `Use most of the tactics below, but keep the piece credible - a reader should never feel manipulated.`
        : `Use only 1-2 of the tactics below, lightly. Subtlety beats cringing.`;

  return `
VIRALITY BRIEF
Audience: ${audienceLabel}
${budget}
Tactics to pull:
${selected}

The hook is the whole game: most readers decide in under 2 seconds. Write line 1 so it is impossible to scroll past, and make the rest of the post deliver on that promise. Vary which tactic each variation leads with so the set is not repetitive.`;
}
