import { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Wand2,
  FileText,
  Settings,
  Search,
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'How do I repurpose content?',
        a: 'Simply paste your original content in the text area, select the platforms you want to generate posts for, choose your tone and language preferences, then click "Generate Posts". The AI will create optimized versions for each platform.',
      },
      {
        q: 'What file types can I upload?',
        a: 'You can upload TXT files directly. PDF and DOCX support is coming soon. For now, you can copy and paste text from these documents.',
      },
      {
        q: 'Is this really free?',
        a: 'Yes! Social Media Repurposer is completely free to use. There are no paid plans, hidden fees, or usage limits.',
      },
    ],
  },
  {
    category: 'Features',
    questions: [
      {
        q: 'What platforms are supported?',
        a: 'We support 15+ platforms including Twitter/X, Instagram, Facebook, LinkedIn, Threads, WhatsApp, Telegram, Pinterest, YouTube (Community & Description), TikTok, Snapchat, Reddit, Medium, and Blogger.',
      },
      {
        q: 'What tones can I choose from?',
        a: 'We offer 7 different tones: Professional, Friendly, Casual, Marketing, Formal, Funny, and Inspirational. Each tone adjusts the language and style of your content accordingly.',
      },
      {
        q: 'How does the hashtag generator work?',
        a: 'The system analyzes your content for keywords and matches them with trending hashtags in your content category. It also adds general viral hashtags to maximize reach.',
      },
    ],
  },
  {
    category: 'Account & Data',
    questions: [
      {
        q: 'Do I need to create an account?',
        a: 'No, you can use the tool without an account. However, creating an account allows you to save your history, favorites, and sync your settings across devices.',
      },
      {
        q: 'Is my data safe?',
        a: 'Yes! Your data is stored securely using Supabase with row-level security. We never share your content with third parties.',
      },
      {
        q: 'Can I export my history?',
        a: 'Yes! You can export your entire history as a JSON file from the History page. Favorites can be exported separately as well.',
      },
    ],
  },
  {
    category: 'Technical',
    questions: [
      {
        q: 'Does this work offline?',
        a: 'The app is a Progressive Web App (PWA) and can work offline for viewing saved content. Generating new posts requires an internet connection.',
      },
      {
        q: 'What browsers are supported?',
        a: 'We support all modern browsers including Chrome, Firefox, Safari, and Edge. For the best experience, use the latest version of your browser.',
      },
      {
        q: 'Is there a mobile app?',
        a: 'The web app is fully responsive and works great on mobile devices. You can also add it to your home screen as a PWA for an app-like experience.',
      },
    ],
  },
];

const GUIDES = [
  {
    title: 'Quick Start Guide',
    icon: Wand2,
    steps: [
      'Paste your content in the input area',
      'Select target platforms',
      'Choose your preferred tone',
      'Click "Generate Posts"',
      'Copy or download your optimized posts',
    ],
  },
  {
    title: 'Using Templates',
    icon: FileText,
    steps: [
      'Navigate to the Templates page',
      'Choose a category that fits your content',
      'Select a template to preview it',
      'Copy the template to use it',
      'Customize the placeholders with your content',
    ],
  },
  {
    title: 'Customizing Settings',
    icon: Settings,
    steps: [
      'Go to Settings from the sidebar',
      'Set your default platform and tone',
      'Choose your preferred theme',
      'Enable/disable features like auto-save',
      'Click "Save Settings" to apply changes',
    ],
  },
];

export function HelpPage() {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggleQuestion = (question: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(question)) {
        newSet.delete(question);
      } else {
        newSet.add(question);
      }
      return newSet;
    });
  };

  const filteredFAQ = FAQ_ITEMS.map(category => ({
    ...category,
    questions: category.questions.filter(
      q =>
        q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(c => c.questions.length > 0);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-4">
          <HelpCircle className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          How can we help?
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Find answers to common questions and learn how to use the tool
        </p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search for help..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          Quick Guides
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GUIDES.map((guide, index) => {
            const Icon = guide.icon;
            return (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{guide.title}</h3>
                </div>
                <ol className="space-y-2">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          {filteredFAQ.map(category => (
            <div key={category.category} className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                {category.category}
              </h3>
              <div className="space-y-2">
                {category.questions.map((item, i) => {
                  const isExpanded = expandedQuestions.has(item.q);
                  return (
                    <div
                      key={i}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleQuestion(item.q)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.q}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4">
                          <p className="text-gray-600 dark:text-gray-400">{item.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
