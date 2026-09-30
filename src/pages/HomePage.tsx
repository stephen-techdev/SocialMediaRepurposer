import {
  Sparkles,
  ArrowRight,
  Zap,
  Globe,
  Target,
  Layers,
  Download,
  Shield,
  Check,
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

const FEATURES = [
  {
    icon: Zap,
    title: 'AI-Powered Conversion',
    description: 'Transform your content into platform-optimized posts instantly',
  },
  {
    icon: Globe,
    title: '15+ Platforms',
    description: 'Generate posts for Twitter, Instagram, LinkedIn, and more',
  },
  {
    icon: Target,
    title: 'Smart Hashtags',
    description: 'Auto-generate relevant hashtags for maximum reach',
  },
  {
    icon: Layers,
    title: 'Multiple Tones',
    description: 'Choose from 7 different content tones for any audience',
  },
  {
    icon: Download,
    title: 'Export Options',
    description: 'Download your posts as TXT, PDF, or DOCX files',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Your data stays secure with local storage options',
  },
];

const PLATFORMS_SHOWN = [
  'Twitter',
  'Instagram',
  'LinkedIn',
  'Facebook',
  'TikTok',
  'YouTube',
  'Threads',
  'WhatsApp',
];

export function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-900">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Content Repurposer
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Transform One Post Into{' '}
              <span className="bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                Viral Content
              </span>{' '}
              For Every Platform
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-10">
              Paste your content once and instantly generate optimized posts for 15+ social media
              platforms with the perfect tone, hashtags, and call-to-action.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onNavigate('repurpose')}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-lg hover:shadow-xl hover:shadow-blue-500/25 transition-all flex items-center gap-2"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => onNavigate('about')}
                className="px-8 py-4 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold text-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Learn More
              </button>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-emerald-500" />
                Free Forever
              </span>
              <span className="hidden sm:block">•</span>
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-emerald-500" />
                No Credit Card
              </span>
              <span className="hidden sm:block">•</span>
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-emerald-500" />
                Works Offline
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Supported Platforms
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Create optimized content for all major social networks
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            {PLATFORMS_SHOWN.map(platform => (
              <div
                key={platform}
                className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium"
              >
                {platform}
              </div>
            ))}
            <div className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium">
              +7 More
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Powerful features to help you create, optimize, and manage your social media
              presence
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-none transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center mb-4 group-hover:from-blue-500/20 group-hover:to-cyan-500/20 transition-colors">
                    <Icon className="w-6 h-6 text-blue-500 dark:text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-blue-600 to-cyan-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Content?
          </h2>
          <p className="text-lg text-white/80 mb-8">
            Join thousands of creators, marketers, and businesses using Social Media Repurposer
          </p>
          <button
            onClick={() => onNavigate('repurpose')}
            className="px-8 py-4 rounded-xl bg-white text-blue-600 font-semibold text-lg hover:shadow-xl transition-all"
          >
            Start For Free
          </button>
        </div>
      </section>
    </div>
  );
}
