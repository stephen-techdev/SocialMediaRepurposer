import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import {
  AUDIENCES,
  CALL_TO_ACTIONS,
  CONTENT_TYPES,
  EMOJI_DENSITY,
  HASHTAG_PLACEMENT,
  HASHTAG_SCRIPTS,
  HOOK_STYLES,
  LANGUAGES,
  LENGTHS,
  PLATFORMS,
  TONES,
} from '../lib/constants';
import { GRADE_STYLE, VIRAL_INTENSITY, VIRAL_TACTICS } from '../lib/viral';
import {
  MAX_IMAGES,
  formatBytes,
  loadImages,
  readImages,
  saveImages,
  clearImages as clearStoredImages,
} from '../lib/images';
import type { AttachedImage } from '../types';
import {
  generateForPlatforms,
  type BatchGeneratorOptions,
  type GeneratedVariant,
} from '../lib/contentGenerator';
import { getAiStatus, type AiStatus } from '../lib/aiClient';
import { addPosts, recordGeneration, storageMode } from '../lib/store';
import {
  countCharacters,
  countWords,
  detectLanguage,
  detectScript,
  estimateReadingTime,
  extractKeywords,
  suggestSEOKeywords,
} from '../lib/utils';
import {
  Wand2,
  Copy,
  Download,
  Heart,
  Trash2,
  FileText,
  Hash,
  Type,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Eye,
  Expand,
  Shrink,
  RotateCcw,
  Loader2,
  Check,
  Info,
  CopyCheck,
  Layers,
  CloudOff,
  RefreshCw,
  Save,
  Share2,
  AlertTriangle,
  Flame,
  ImagePlus,
  X,
  Upload,
  Gauge,
  Trash,
} from 'lucide-react';

interface FormState {
  content: string;
  platforms: string[];
  tone: string;
  language: string;
  audience: string;
  contentType: string;
  hookStyle: string;
  length: string;
  emojiDensity: string;
  variations: number;
  includeHashtags: boolean;
  hashtagCount: number;
  hashtagPlacement: string;
  hashtagScript: string;
  includeCTA: boolean;
  ctaKind: string;
  customCTA: string;
  extraTags: string;
  notes: string;
  /* virality */
  viralIntensity: string;
  viralTactics: string[];
  /* images (optional) */
  includeImages: boolean;
  includeAltText: boolean;
}

const DEFAULT_FORM: FormState = {
  content: '',
  platforms: ['twitter', 'instagram'],
  tone: 'professional',
  language: 'auto',
  audience: 'voters',
  contentType: 'news',
  hookStyle: 'auto',
  length: 'standard',
  emojiDensity: 'light',
  variations: 3,
  includeHashtags: true,
  hashtagCount: 6,
  hashtagPlacement: 'separate',
  hashtagScript: 'auto',
  includeCTA: true,
  ctaKind: 'share',
  customCTA: '',
  extraTags: '',
  notes: '',
  viralIntensity: 'subtle',
  viralTactics: ['curiosity_gap', 'numbers', 'share_trigger'],
  includeImages: false,
  includeAltText: true,
};

const STORAGE_KEY = 'smr:repurpose:form:v1';
const EXAMPLES = [
  {
    label: 'Tamil political travel news',
    text: 'தாராபுரம் இடைத்தேர்தல் பிரச்சாரம்: தமிழக முதல்வர் விஜய், தாராபுரம் இடைத்தேர்தல் பிரச்சாரத்திற்காக தாராபுரம் நோக்கி கோவை வழியாகச் சாலை மார்க்கமாகப் பயணம் மேற்கொண்டுள்ளார்.',
  },
  {
    label: 'English scheme announcement',
    text:
      'The Tamil Nadu government has announced a new subsidy scheme for small textile exporters. Units registered with the MSME department will receive up to 15 percent of their annual export value, capped at 12 lakh rupees. Applications open from Monday and will be accepted online for ninety days.',
  },
];

function loadForm(): FormState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_FORM, ...(JSON.parse(raw) as Partial<FormState>) } : DEFAULT_FORM;
  } catch {
    return DEFAULT_FORM;
  }
}

const selectClass =
  'w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const hintClass = 'text-xs text-gray-500 dark:text-gray-400 mt-1';
const cardClass = 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700';

function Toggle({ on, onChange, icon, children }: { on: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="w-full flex items-center justify-between gap-3 py-1.5"
    >
      <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
        <span className="text-gray-400">{icon}</span>
        {children}
      </span>
      <span className={`w-11 h-6 shrink-0 rounded-full transition-colors ${on ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`${cardClass} p-5`}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          {icon}
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
}

export function RepurposePage() {
  const { toasts, success, error, info, removeToast } = useToast();

  const [form, setForm] = useState<FormState>(loadForm);
  const [results, setResults] = useState<GeneratedVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [openResult, setOpenResult] = useState<string | null>(null);
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [showPlatforms, setShowPlatforms] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showScoreDetail, setShowScoreDetail] = useState<Set<string>>(new Set());

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Persist settings so switching pages does not lose a half-built setup.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* storage full or blocked - not critical */
    }
  }, [form]);

  const refreshStatus = useCallback(async () => {
    setStatus(await getAiStatus(true));
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Restore previously attached images (metadata only - thumbnails are dropped).
  useEffect(() => {
    const stored = loadImages();
    if (stored.length) info(`${stored.length} image${stored.length === 1 ? '' : 's'} remembered from your last session. Re-attach them to include them.`);
  }, [info]);

  const wordCount = countWords(form.content);
  const charCount = countCharacters(form.content);
  const readingTime = estimateReadingTime(form.content);
  const keywords = useMemo(() => (form.content ? extractKeywords(form.content) : []), [form.content]);
  const seoKeywords = useMemo(() => (form.content ? suggestSEOKeywords(form.content) : []), [form.content]);
  const detected = form.content ? `${detectLanguage(form.content).toUpperCase()} · ${detectScript(form.content)}` : null;
  const extraTags = form.extraTags.split(/[,\s]+/).map((t) => t.replace(/^#/, '')).filter(Boolean);

  const overLimit = results.filter((r) => r.characterCount > r.limit).length;

  const platformName = (id: string) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

  const togglePlatform = (id: string) =>
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(id) ? prev.platforms.filter((p) => p !== id) : [...prev.platforms, id],
    }));

  const toggleTactic = (id: string) =>
    setForm((prev) => ({
      ...prev,
      viralTactics: prev.viralTactics.includes(id)
        ? prev.viralTactics.filter((t) => t !== id)
        : [...prev.viralTactics, id],
      // Turning on any tactic implies the user wants optimisation.
      viralIntensity: prev.viralIntensity === 'off' ? 'subtle' : prev.viralIntensity,
    }));

  const addImages = async (files: FileList | File[] | null) => {
    if (!files || !files.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return info(`Maximum ${MAX_IMAGES} images per run.`);

    setImageBusy(true);
    const { images: added, errors } = await readImages(Array.from(files).slice(0, room));
    if (added.length) {
      const next = [...images, ...added].slice(0, MAX_IMAGES);
      setImages(next);
      saveImages(next);
      set('includeImages', true);
      success(`${added.length} image${added.length === 1 ? '' : 's'} attached`);
    }
    errors.forEach((message) => error(message));
    setImageBusy(false);
  };

  const removeImage = (id: string) => {
    const next = images.filter((img) => img.id !== id);
    setImages(next);
    saveImages(next);
    if (!next.length) set('includeImages', false);
  };

  const clearAllImages = () => {
    setImages([]);
    clearStoredImages();
    set('includeImages', false);
    info('Images removed');
  };

  const toggleScoreDetail = (key: string) =>
    setShowScoreDetail((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleResult = (key: string) => setOpenResult((prev) => (prev === key ? null : key));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        error('File is larger than 5 MB');
      } else if (/\.(txt|md|csv|json)$/i.test(file.name) || file.type.startsWith('text/')) {
        try {
          const text = await file.text();
          set('content', text);
          success('File loaded');
        } catch {
          error('Could not read that file');
        }
      } else {
        info('Only .txt, .md, .csv and .json can be read in the browser. Open the PDF and paste the text.');
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!form.content.trim()) return error('Paste or type some content first.');
    if (!form.platforms.length) return error('Select at least one platform.');
    if (form.includeCTA && form.ctaKind === 'custom' && !form.customCTA.trim()) {
      return error('You picked a custom call to action but left it empty.');
    }

    setLoading(true);
    setResults([]);

    const options: BatchGeneratorOptions = {
      content: form.content,
      tone: form.tone,
      language: form.language,
      audience: form.audience,
      contentType: form.contentType,
      hookStyle: form.hookStyle,
      length: form.length,
      emojiDensity: form.emojiDensity,
      includeHashtags: form.includeHashtags,
      hashtagCount: form.hashtagCount,
      hashtagPlacement: form.hashtagPlacement,
      hashtagScript: form.hashtagScript,
      includeCTA: form.includeCTA,
      ctaKind: form.ctaKind,
      customCTA: form.customCTA,
      extraTags,
      notes: form.notes,
      variations: form.variations,
      /* virality */
      viralIntensity: form.viralIntensity,
      viralTactics: form.viralTactics,
      /* images */
      images: form.includeImages ? images : [],
      includeAltText: form.includeImages && form.includeAltText,
    };

    try {
      const { results: perPlatform, errors } = await generateForPlatforms(options, form.platforms);
      const flat = perPlatform.flatMap((r) => r.variants);

      setResults(flat);
      setOpenResult(flat[0] ? `${flat[0].platform}:${flat[0].variation}` : null);
      setLastRunAt(Date.now());

      const aiCount = perPlatform.filter((r) => r.engine === 'ai').length;
      if (aiCount === perPlatform.length) success(`Generated ${flat.length} posts with AI`);
      else if (aiCount > 0) info(`Generated ${flat.length} posts - ${aiCount}/${perPlatform.length} platforms used AI.`);
      else info(`Generated ${flat.length} posts with the built-in offline generator.`);

      errors.forEach((message) => info(message));

      if (form.platforms.length && flat.length) {
        void addPosts(
          flat.map((v) => ({
            user_id: 'local',
            original_content: form.content,
            platform: v.platform,
            tone: form.tone,
            language: form.language === 'auto' ? detectLanguage(form.content) : form.language,
            include_emoji: form.emojiDensity !== 'none',
            generated_post: v.post,
            hashtags: v.hashtags,
            cta: v.cta,
            character_count: v.characterCount,
          })),
        );
        void recordGeneration({
          platforms: form.platforms,
          tones: [form.tone],
          count: flat.length,
        });
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      success(`${label} copied`);
    } catch {
      error('Clipboard blocked by the browser');
    }
  };

  const copyAll = async () => {
    const text = results
      .map((r) => `===== ${platformName(r.platform)} - variation ${r.variation + 1} =====\n${r.post}`)
      .join('\n\n');
    await copyText(text, 'All variations');
  };

  const download = (variant: GeneratedVariant) => {
    const blob = new Blob([variant.post], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${variant.platform}_v${variant.variation + 1}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    success('Downloaded');
  };

  const downloadAll = () => {
    const text = results
      .map((r) => `===== ${platformName(r.platform)} - variation ${r.variation + 1} =====\n${r.post}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_posts_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    success('Downloaded every variation');
  };

  const toggleFavorite = (variant: GeneratedVariant) => {
    const key = `${variant.platform}:${variant.variation}`;
    setFavoriteKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const platformsWith = (id: string) => results.filter((r) => r.platform === id);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">Repurpose Your Content</h1>
          <p className="text-gray-600 dark:text-gray-400">
            One story in, platform-native posts out - in the language and register your audience actually reads.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              status?.aiEnabled
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            }`}
            title={status?.aiEnabled ? `Provider: ${status.provider} / ${status.model}` : 'Using the offline generator'}
          >
            {status?.aiEnabled ? <Sparkles className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
            {status?.aiEnabled ? `AI: ${status.model}` : 'Offline generator'}
          </span>
          <button
            onClick={refreshStatus}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Re-check the AI provider"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {storageMode === 'local' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" title="History is stored in this browser only">
              <Save className="w-3.5 h-3.5" />
              Saved locally
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ------------------------------- input ------------------------------ */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`${cardClass} p-6`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <label className="block text-lg font-semibold text-gray-900 dark:text-white">Your Content</label>
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.json,text/plain" onChange={handleFileUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Upload
                </button>
              </div>
            </div>

            <textarea
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="Paste the full story here - the more detail you give (names, places, dates, numbers, quotes) the better every variation will be."
              className="w-full h-64 p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><Type className="w-4 h-4" />{wordCount} words</span>
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><Hash className="w-4 h-4" />{charCount} characters</span>
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><Clock className="w-4 h-4" />{readingTime} min read</span>
              {detected && <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs">{detected}</span>}
            </div>

            {keywords.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key terms detected</p>
                <div className="flex flex-wrap gap-2">
                  {keywords.slice(0, 10).map((keyword, i) => (
                    <span key={`${keyword}-${i}`} className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  onClick={() => {
                    set('content', example.text);
                    info('Example loaded');
                  }}
                  className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {example.label}
                </button>
              ))}
              <button
                onClick={() => {
                  if (!form.content.trim()) return;
                  set('content', form.content.split(/(?<=[.!?।])\s+/).flatMap((s, i) => (i % 2 && s.split(/\s+/).length > 10 ? [s, s.split(/\s+/).slice(0, 6).join(' ') + ' - ' + s] : [s])).join(' '));
                  info('Content elaborated for testing');
                }}
                disabled={!form.content.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                <Expand className="w-4 h-4" />
                Expand
              </button>
              <button
                onClick={() => set('content', form.content.split(/(?<=[.!?।])\s+/).slice(0, 2).join(' '))}
                disabled={!form.content.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                <Shrink className="w-4 h-4" />
                Shorten
              </button>
              <button
                onClick={() => {
                  set('content', '');
                  setResults([]);
                  info('Cleared');
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors ml-auto"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>

          {/* ----------------------------- results ----------------------------- */}
          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-500" />
                  {results.length} variation{results.length === 1 ? '' : 's'} across {form.platforms.length} platform
                  {form.platforms.length === 1 ? '' : 's'}
                </h2>
                <div className="flex gap-2">
                  <button onClick={copyAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <CopyCheck className="w-4 h-4" />
                    Copy all
                  </button>
                  <button onClick={downloadAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              </div>

              {overLimit > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4" />
                  {overLimit} variation{overLimit === 1 ? '' : 's'} exceed the platform limit. Shorten the input or reduce the length.
                </div>
              )}

              {form.platforms.map((platformId) => {
                const variants = platformsWith(platformId);
                if (!variants.length) return null;

                return (
                  <div key={platformId} className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {platformName(platformId)}
                    </h3>

                    {variants.map((variant) => {
                      const key = `${variant.platform}:${variant.variation}`;
                      const open = openResult === key;
                      const pct = Math.min(100, Math.round((variant.characterCount / variant.limit) * 100));
                      const over = variant.characterCount > variant.limit;

                      return (
                        <div key={key} className={`${cardClass} overflow-hidden`}>
                          <button type="button" onClick={() => toggleResult(key)} className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center">
                                <Wand2 className="w-5 h-5 text-blue-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white truncate">
                                  Variation {variant.variation + 1}
                                  {variant.hook ? <span className="font-normal text-gray-500 dark:text-gray-400"> - {variant.hook.slice(0, 60)}</span> : null}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <div className="w-24 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                    <div className={`h-full ${over ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className={`text-xs ${over ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {variant.characterCount}/{variant.limit}
                                  </span>
                                  {variant.viral && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleScoreDetail(key);
                                      }}
                                      title="Show the virality breakdown"
                                      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${GRADE_STYLE[variant.viral.grade].className} hover:opacity-80 transition-opacity`}
                                    >
                                      <Flame className="w-3 h-3" />
                                      {variant.viral.score} · {GRADE_STYLE[variant.viral.grade].label}
                                    </button>
                                  )}
                                  {variant.imageBrief.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400" title="Image guidance attached">
                                      <ImagePlus className="w-3 h-3" />
                                      image
                                    </span>
                                  )}
                                  {variant.engine === 'ai' ? (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">AI</span>
                                  ) : (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">offline</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {open ? <ChevronUp className="w-5 h-5 shrink-0 text-gray-400" /> : <ChevronDown className="w-5 h-5 shrink-0 text-gray-400" />}
                          </button>

                          {open && (
                            <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700">
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                                <p className="text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">{variant.post}</p>
                              </div>

                              {variant.why && (
                                <p className="mt-3 text-xs italic text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                                  <Eye className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  {variant.why}
                                </p>
                              )}

                              {variant.hashtags.length > 0 && (
                                <div className="mt-4">
                                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hashtags</p>
                                  <div className="flex flex-wrap gap-2">
                                    {variant.hashtags.map((tag) => (
                                      <button key={tag} onClick={() => copyText(tag, 'Tag')} className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm hover:opacity-75 transition-opacity" title="Click to copy">
                                        {tag}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {variant.cta && (
                                <div className="mt-4">
                                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Call to action</p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{variant.cta}</p>
                                </div>
                              )}

                              {variant.viral && showScoreDetail.has(key) && (
                                <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
                                  <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                      <Gauge className="w-4 h-4 text-blue-500" />
                                      Virality breakdown
                                    </p>
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${GRADE_STYLE[variant.viral.grade].className}`}>
                                      {variant.viral.score}/100 · {GRADE_STYLE[variant.viral.grade].label}
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    {variant.viral.breakdown.map((row) => (
                                      <div key={row.label}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="text-gray-600 dark:text-gray-300">{row.label}</span>
                                          <span className="text-gray-400 dark:text-gray-500">{row.got}/{row.max}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                          <div
                                            className={`h-full ${row.got / row.max >= 0.7 ? 'bg-emerald-500' : row.got / row.max >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`}
                                            style={{ width: `${Math.round((row.got / row.max) * 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {variant.viral.gaps.length > 0 && (
                                    <ul className="mt-3 space-y-1">
                                      {variant.viral.gaps.map((gap) => (
                                        <li key={gap} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                                          <span>→</span>
                                          {gap}
                                        </li>
                                      ))}
                                    </ul>
                                  )}

                                  {variant.viral.strengths.length > 0 && (
                                    <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                                      Working: {variant.viral.strengths.join(', ')}
                                    </p>
                                  )}
                                </div>
                              )}

                              {variant.altText && (
                                <div className="mt-4">
                                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alt text</p>
                                  <button
                                    onClick={() => copyText(variant.altText as string, 'Alt text')}
                                    className="text-left text-sm text-gray-600 dark:text-gray-400 hover:underline"
                                  >
                                    {variant.altText}
                                  </button>
                                </div>
                              )}

                              {variant.imageBrief.length > 0 && (
                                <div className="mt-4">
                                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image guidance</p>
                                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 space-y-0.5">
                                    {variant.imageBrief.map((line) => (
                                      <p key={line} className="text-xs text-gray-600 dark:text-gray-400">{line}</p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {variant.notes.length > 0 && (
                                <div className="mt-4 space-y-1">
                                  {variant.notes.map((note) => (
                                    <p key={note} className="text-xs text-amber-600 dark:text-amber-400">- {note}</p>
                                  ))}
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2 mt-4">
                                <button onClick={() => copyText(variant.post, 'Post')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors">
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </button>
                                <button onClick={() => download(variant)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                  <Download className="w-4 h-4" />
                                  Download
                                </button>
                                <button onClick={() => toggleFavorite(variant)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${favoriteKeys.has(key) ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                                  <Heart className={`w-4 h-4 ${favoriteKeys.has(key) ? 'fill-current' : ''}`} />
                                  {favoriteKeys.has(key) ? 'Saved' : 'Save'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ------------------------------ options ----------------------------- */}
        <div className="space-y-6">
          <div className={`${cardClass} p-5`}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Platforms</h3>
            <p className={`${hintClass} mb-3`}>
              {form.platforms.length} selected - {form.platforms.length * form.variations} outputs will be created
            </p>

            <button type="button" onClick={() => setShowPlatforms(!showPlatforms)} className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
              <span>{form.platforms.length} selected</span>
              <ChevronDown className={`w-5 h-5 transition-transform ${showPlatforms ? 'rotate-180' : ''}`} />
            </button>

            {showPlatforms && (
              /* Horizontal wrap: platforms sit side by side and flow onto the next
                 line, instead of a single vertical column. Each chip carries the
                 character limit on a second line so it stays readable at this width. */
              <div className="mt-2 flex flex-wrap gap-2">
                {PLATFORMS.map((platform) => {
                  const selected = form.platforms.includes(platform.id);
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => togglePlatform(platform.id)}
                      aria-pressed={selected}
                      title={`${platform.name} - ${platform.charLimit.toLocaleString()} chars max`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-colors ${
                        selected
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      <span className="text-sm font-medium leading-tight">{platform.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {form.platforms.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {form.platforms.map((p) => (
                  <button key={p} onClick={() => togglePlatform(p)} className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium hover:opacity-75 transition-opacity" title="Click to remove">
                    {platformName(p)} x
                  </button>
                ))}
              </div>
            )}
          </div>

          <Section title="Variations" icon={<Layers className="w-4 h-4 text-blue-500" />}>
            <div>
              <label className={labelClass}>How many variations per platform: {form.variations}</label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={form.variations}
                onChange={(e) => set('variations', Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <p className={hintClass}>Each variation takes a different angle: news first, human detail, consequences, question to the reader, contrast.</p>
            </div>
          </Section>

          <Section title="Make it viral" icon={<Flame className="w-4 h-4 text-orange-500" />}>
            <div>
              <label className={labelClass}>Intensity</label>
              <select value={form.viralIntensity} onChange={(e) => set('viralIntensity', e.target.value)} className={selectClass}>
                {VIRAL_INTENSITY.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <p className={hintClass}>{VIRAL_INTENSITY.find((v) => v.id === form.viralIntensity)?.hint}</p>
            </div>

            {form.viralIntensity !== 'off' && (
              <>
                <div>
                  <label className={labelClass}>Levers to pull ({form.viralTactics.length} selected)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {VIRAL_TACTICS.map((tactic) => {
                      const on = form.viralTactics.includes(tactic.id);
                      return (
                        <button
                          key={tactic.id}
                          type="button"
                          onClick={() => toggleTactic(tactic.id)}
                          title={tactic.hint}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            on
                              ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {tactic.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className={hintClass}>More levers is not always better - pick 2-4 that fit the story. Every post is scored on these same criteria afterwards.</p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { label: 'News reach', ids: ['numbers', 'local_pride', 'social_proof'] },
                    { label: 'Debate', ids: ['debate', 'contrast', 'identity'] },
                    { label: 'Forward-worthy', ids: ['share_trigger', 'emotion', 'stakes'] },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => set('viralTactics', preset.ids)}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Section>

          <Section title="Images (optional)" icon={<ImagePlus className="w-4 h-4 text-blue-500" />} defaultOpen={false}>
            <Toggle on={form.includeImages} onChange={(v) => set('includeImages', v)} icon={<ImagePlus className="w-5 h-5" />}>
              Attach images to this run
            </Toggle>

            {form.includeImages && (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void addImages(e.target.files);
                    if (imageInputRef.current) imageInputRef.current.value = '';
                  }}
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void addImages(e.dataTransfer.files);
                  }}
                  onClick={() => imageInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                    dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }`}
                >
                  {imageBusy ? (
                    <>
                      <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-500" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Reading images...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Drop images here, or click to browse</p>
                      <p className={`${hintClass} mt-1`}>JPG, PNG, WebP, GIF up to 8 MB. Max {MAX_IMAGES} images.</p>
                    </>
                  )}
                </div>

                {images.length > 0 && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {images.map((img) => (
                        <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700">
                          <img src={img.dataUrl} alt={img.name} className="w-full h-20 object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(img.id);
                            }}
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label={`Remove ${img.name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="px-1.5 py-1 bg-white dark:bg-gray-800">
                            <p className="text-[10px] truncate text-gray-600 dark:text-gray-400" title={img.name}>{img.name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">{img.width}x{img.height} · {formatBytes(img.size)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={clearAllImages}
                      className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      <Trash className="w-3.5 h-3.5" />
                      Remove all images
                    </button>
                    <Toggle on={form.includeAltText} onChange={(v) => set('includeAltText', v)} icon={<Sparkles className="w-5 h-5" />}>
                      Generate alt text
                    </Toggle>
                    <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Images stay on your device - they are never uploaded and the AI never sees the pixels, only the file names. You get platform-correct format guidance and alt text drafts.
                    </p>
                  </>
                )}
              </>
            )}
          </Section>

          <Section title="Audience & Story" icon={<Share2 className="w-4 h-4 text-blue-500" />}>
            <div>
              <label className={labelClass}>Who is this for</label>
              <select value={form.audience} onChange={(e) => set('audience', e.target.value)} className={selectClass}>
                {AUDIENCES.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className={hintClass}>{AUDIENCES.find((a) => a.id === form.audience)?.hint}</p>
            </div>

            <div>
              <label className={labelClass}>What kind of story</label>
              <select value={form.contentType} onChange={(e) => set('contentType', e.target.value)} className={selectClass}>
                {CONTENT_TYPES.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className={hintClass}>{CONTENT_TYPES.find((c) => c.id === form.contentType)?.hint}</p>
            </div>
          </Section>

          <Section title="Voice" icon={<RotateCcw className="w-4 h-4 text-blue-500" />}>
            <div>
              <label className={labelClass}>Tone</label>
              <select value={form.tone} onChange={(e) => set('tone', e.target.value)} className={selectClass}>
                {TONES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className={hintClass}>{TONES.find((t) => t.id === form.tone)?.description}</p>
            </div>

            <div>
              <label className={labelClass}>Output language</label>
              <select value={form.language} onChange={(e) => set('language', e.target.value)} className={selectClass}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <p className={hintClass}>{form.language === 'auto' ? 'Keeps the input language and script, including Tamil, Hindi, Telugu and more.' : 'The post will be rewritten in this language.'}</p>
            </div>

            <div>
              <label className={labelClass}>Hook style</label>
              <select value={form.hookStyle} onChange={(e) => set('hookStyle', e.target.value)} className={selectClass}>
                {HOOK_STYLES.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <p className={hintClass}>{HOOK_STYLES.find((h) => h.id === form.hookStyle)?.hint}</p>
            </div>

            <div>
              <label className={labelClass}>Length</label>
              <select value={form.length} onChange={(e) => set('length', e.target.value)} className={selectClass}>
                {LENGTHS.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </Section>

          <Section title="Hashtags" icon={<Hash className="w-4 h-4 text-blue-500" />} defaultOpen={false}>
            <Toggle on={form.includeHashtags} onChange={(v) => set('includeHashtags', v)} icon={<Hash className="w-5 h-5" />}>
              Include hashtags
            </Toggle>

            {form.includeHashtags && (
              <>
                <div>
                  <label className={labelClass}>How many: {form.hashtagCount}</label>
                  <input type="range" min={1} max={15} step={1} value={form.hashtagCount} onChange={(e) => set('hashtagCount', Number(e.target.value))} className="w-full accent-blue-500" />
                </div>

                <div>
                  <label className={labelClass}>Placement</label>
                  <select value={form.hashtagPlacement} onChange={(e) => set('hashtagPlacement', e.target.value)} className={selectClass}>
                    {HASHTAG_PLACEMENT.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <p className={hintClass}>"First comment" keeps the caption clean - paste them in the first reply.</p>
                </div>

                <div>
                  <label className={labelClass}>Script</label>
                  <select value={form.hashtagScript} onChange={(e) => set('hashtagScript', e.target.value)} className={selectClass}>
                    {HASHTAG_SCRIPTS.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <p className={hintClass}>Native-script tags do not reach as many people on most platforms - romanised tags usually travel further.</p>
                </div>

                <div>
                  <label className={labelClass}>Must-include tags</label>
                  <input
                    type="text"
                    value={form.extraTags}
                    onChange={(e) => set('extraTags', e.target.value)}
                    placeholder="#TamilNadu #Election2026"
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className={hintClass}>Comma or space separated. These are always added to every variation.</p>
                </div>
              </>
            )}
          </Section>

          <Section title="Call to action & emoji" icon={<Sparkles className="w-4 h-4 text-blue-500" />} defaultOpen={false}>
            <Toggle on={form.includeCTA} onChange={(v) => set('includeCTA', v)} icon={<Share2 className="w-5 h-5" />}>
              Include a call to action
            </Toggle>

            {form.includeCTA && (
              <>
                <div>
                  <label className={labelClass}>Goal</label>
                  <select value={form.ctaKind} onChange={(e) => set('ctaKind', e.target.value)} className={selectClass}>
                    {CALL_TO_ACTIONS.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {form.ctaKind === 'custom' && (
                  <div>
                    <label className={labelClass}>Your CTA text</label>
                    <input
                      type="text"
                      value={form.customCTA}
                      onChange={(e) => set('customCTA', e.target.value)}
                      placeholder="Forward this to your WhatsApp group"
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className={labelClass}>Emoji density</label>
              <select value={form.emojiDensity} onChange={(e) => set('emojiDensity', e.target.value)} className={selectClass}>
                {EMOJI_DENSITY.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </Section>

          <Section title="Extra instructions" icon={<Info className="w-4 h-4 text-blue-500" />} defaultOpen={false}>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="e.g. Mention the Coimbatore rally time. Do not use the word 'massive'. Keep the party name in Tamil."
              className="w-full h-24 p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500"
            />
            <p className={hintClass}>Passed straight to the model. Use it for anything the dropdowns cannot express.</p>
          </Section>

          <button
            onClick={handleGenerate}
            disabled={loading || !form.content.trim() || form.platforms.length === 0}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-lg hover:shadow-xl hover:shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating {form.platforms.length * form.variations} posts...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate {form.platforms.length * form.variations} posts
              </>
            )}
          </button>

          {seoKeywords.length > 0 && (
            <div className={`${cardClass} p-5`}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Search terms</h3>
              <div className="flex flex-wrap gap-2">
                {seoKeywords.slice(0, 12).map((keyword, i) => (
                  <button key={`${keyword}-${i}`} onClick={() => copyText(keyword, 'Term')} className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs hover:opacity-75 transition-opacity">
                    {keyword}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lastRunAt && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              Last run {new Date(lastRunAt).toLocaleTimeString()} - settings are remembered on this device
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
