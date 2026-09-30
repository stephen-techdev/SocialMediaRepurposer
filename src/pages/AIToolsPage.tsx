import React, { useEffect, useState } from 'react';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import { AI_TOOLS, TONES } from '../lib/constants';
import { getAiStatus, runPrompt, AI_TOOL_SYSTEM_PROMPT, type AiStatus } from '../lib/aiClient';
import { buildToolPrompt } from '../lib/prompts';
import { detectLanguage, extractKeywords, generateHashtags, splitSentences, summarizeContent } from '../lib/utils';
import {
  Type,
  Heading,
  UserCircle,
  Package,
  Megaphone,
  Mail,
  Linkedin,
  Youtube,
  PlayCircle,
  Video,
  FileText,
  Newspaper,
  ListOrdered,
  Quote,
  Copy,
  Download,
  Sparkles,
  Loader2,
  ChevronRight,
  CloudOff,
  CopyCheck,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Type,
  Heading,
  UserCircle,
  Package,
  Megaphone,
  Mail,
  Linkedin,
  Youtube,
  PlayCircle,
  Video,
  FileText,
  Newspaper,
  ListOrdered,
  Quote,
};

interface ToolItem {
  text: string;
  hashtags?: string[];
  why?: string;
}

/* ---------------------------------------------------------------------------
 * Offline fallback.
 * The old version returned hard-coded marketing filler ("Introducing a
 * revolutionary solution...", "STOP SCROLLING!") regardless of the input.
 * This derives everything from the user's own words instead.
 * ------------------------------------------------------------------------- */
function offlineTool(toolId: string, content: string, _tone: string, language: string): ToolItem[] {
  const sentences = splitSentences(content);
  const keywords = extractKeywords(content, 8);
  const subject = keywords.slice(0, 3).join(', ') || 'this update';
  const langNote = language === 'auto' ? '' : ` (${language})`;

  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  switch (toolId) {
    case 'caption':
      return [
        { text: `${cap(sentences[0] ?? subject)}\n\n${summarizeContent(content, 2)}\n\n${generateHashtags(keywords, { limit: 5 }).join(' ')}`, hashtags: generateHashtags(keywords, { limit: 5 }) },
        { text: `${summarizeContent(content, 1)}\n\n${sentences.slice(1, 3).join(' ')}${langNote}`, hashtags: [] },
        { text: sentences.map(cap).join('\n') },
      ];
    case 'quote_card':
      return sentences.slice(0, 8).map((s) => ({ text: s.length > 90 ? `${s.slice(0, 88)}…` : s }));
    case 'title':
    case 'youtube_title':
      return keywords.slice(0, 10).map((k) => ({
        text:
          toolId === 'youtube_title'
            ? `${cap(k)} - Full Details`
            : [`${cap(k)}: What You Need to Know`, `The Complete Guide to ${k}`, `${cap(k)} Explained Simply`, `Why ${k} Matters Now`][
                keywords.indexOf(k) % 4
              ],
      }));
    case 'headline':
      return sentences.slice(0, 10).map((s) => ({ text: cap(s.split(/[,;]/)[0]) }));
    case 'bio':
      return [
        { text: `${subject}`.slice(0, 150) },
        { text: `Sharing ${keywords[0] ?? 'updates'} every day`.slice(0, 150) },
      ];
    case 'product':
      return [{ text: `${cap(sentences[0] ?? subject)}\n\n${summarizeContent(content, 3)}` }];
    case 'ad_copy':
      return [{ text: `${cap(sentences[0] ?? subject)}\n\n${summarizeContent(content, 2)}\n\nGet started today.` }];
    case 'email':
      return [{ text: `Subject: ${cap(keywords[0] ?? 'Update')}\n\n${summarizeContent(content, 3)}\n\nRead more at the link.` }];
    case 'linkedin':
      return [{ text: `${summarizeContent(content, 1)}\n\n${summarizeContent(content, 4)}\n\nWhat do you think?` }];
    case 'youtube_desc':
      return [{ text: `${summarizeContent(content, 2)}\n\n0:00 Introduction\n\n${generateHashtags(keywords, { limit: 4 }).join(' ')}` }];
    case 'video_script':
      return [{ text: `[HOOK]\n${cap(sentences[0] ?? subject)}\n\n[BODY]\n${summarizeContent(content, 3)}\n\n[CTA]\nFollow for more.` }];
    case 'blog_summary':
      return [
        { text: summarizeContent(content, 1) },
        { text: summarizeContent(content, 3) },
        { text: content },
      ];
    case 'thread':
      return [{ text: sentences.slice(0, 8).map((s, i) => `${i + 1}/ ${cap(s)}`).join('\n\n') }];
    default:
      return [{ text: content }];
  }
}

function parseItems(raw: string): ToolItem[] {
  const candidates: string[] = [];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(raw.trim());
  const a = raw.indexOf('{');
  const b = raw.lastIndexOf('}');
  if (a !== -1 && b > a) candidates.push(raw.slice(a, b + 1));
  const c = raw.indexOf('[');
  const d = raw.lastIndexOf(']');
  if (c !== -1 && d > c) candidates.push(raw.slice(c, d + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const list = Array.isArray(parsed) ? parsed : (parsed.items ?? parsed.results);
      if (Array.isArray(list)) {
        const mapped = list
          .map((item) => (typeof item === 'string' ? { text: item } : item))
          .filter((item) => item && typeof item.text === 'string' && item.text.trim());
        if (mapped.length) return mapped;
      }
    } catch {
      /* try next */
    }
  }
  throw new Error('The model did not return usable JSON.');
}

export function AIToolsPage() {
  const { toasts, success, error, info, removeToast } = useToast();
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [tone, setTone] = useState('professional');
  const [language, setLanguage] = useState('auto');
  const [items, setItems] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [usedOffline, setUsedOffline] = useState(false);

  useEffect(() => {
    void getAiStatus().then(setStatus);
  }, []);

  const handleGenerate = async () => {
    if (!input.trim()) return error('Please enter some content');
    const tool = AI_TOOLS.find((t) => t.id === selectedTool);
    if (!tool) return;

    setLoading(true);
    setItems([]);
    setUsedOffline(false);

    const detected = language === 'auto' ? detectLanguage(input) : language;

    if (status?.aiEnabled) {
      try {
        const raw = await runPrompt(buildToolPrompt(selectedTool!, input, tone, language), {
          system: AI_TOOL_SYSTEM_PROMPT,
        });
        setItems(parseItems(raw));
        success(`${tool.name} generated`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Generation failed';
        setItems(offlineTool(selectedTool!, input, tone, detected));
        setUsedOffline(true);
        info(`${message} Showing offline results instead.`);
      }
    } else {
      setItems(offlineTool(selectedTool!, input, tone, detected));
      setUsedOffline(true);
      info('No AI provider configured - showing offline results.');
    }

    setLoading(false);
  };

  const combinedOutput = items.map((i) => i.text).join('\n\n----------\n\n');

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      success('Copied to clipboard');
    } catch {
      error('Failed to copy');
    }
  };

  const handleDownload = (text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTool}_output.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    success('Downloaded successfully');
  };

  if (selectedTool) {
    const tool = AI_TOOLS.find((t) => t.id === selectedTool);
    const Icon = ICON_MAP[tool?.id ?? ''] ?? Type;

    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <button
          onClick={() => {
            setSelectedTool(null);
            setInput('');
            setItems([]);
          }}
          className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-6"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Tools
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tool?.name}</h1>
            <p className="text-gray-600 dark:text-gray-400">{tool?.description}</p>
          </div>
          <span
            className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              status?.aiEnabled
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            {status?.aiEnabled ? <Sparkles className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
            {status?.aiEnabled ? `AI: ${status.model}` : 'Offline'}
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Input Content</label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste the raw material here..."
                className="w-full h-48 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {TONES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">Same as input</option>
                  <option value="ta">Tamil</option>
                  <option value="hi">Hindi</option>
                  <option value="bn">Bengali</option>
                  <option value="te">Telugu</option>
                  <option value="kn">Kannada</option>
                  <option value="ml">Malayalam</option>
                  <option value="en">English</option>
                  <option value="ta_IN">Tamil (India)</option>
                  <option value="en_IN">English (India)</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !input.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:shadow-lg transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate
                </>
              )}
            </button>

            {usedOffline && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Offline results are derived only from your own words, so they are shorter and less polished than AI output.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Output {items.length > 0 && `(${items.length})`}
              </label>
              {items.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(combinedOutput)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors"
                  >
                    <CopyCheck className="w-3.5 h-3.5" />
                    Copy all
                  </button>
                  <button
                    onClick={() => handleDownload(combinedOutput)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="h-64 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-400">
                Results will appear here
              </div>
            ) : (
              <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div key={index} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4 group relative">
                    <span className="absolute top-2 right-2 text-xs font-semibold text-gray-400">#{index + 1}</span>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap pr-8 leading-relaxed">{item.text}</p>
                    {item.hashtags && item.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {item.hashtags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleCopy(item.text)} className="p-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-500 hover:text-blue-500 transition-colors" title="Copy">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDownload(item.text)} className="p-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">AI Tools</h1>
        <p className="text-gray-600 dark:text-gray-400">Specialised generators for every content need</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {AI_TOOLS.map((tool) => {
          const Icon = ICON_MAP[tool.id] ?? Type;
          return (
            <button
              key={tool.id}
              onClick={() => setSelectedTool(tool.id)}
              className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-500/50 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center mb-4 group-hover:from-blue-500 group-hover:to-cyan-500 transition-all">
                <Icon className="w-6 h-6 text-blue-500 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{tool.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{tool.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
