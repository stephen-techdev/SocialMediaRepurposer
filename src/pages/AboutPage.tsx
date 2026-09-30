import {
  Sparkles,
  Zap,
  Globe,
  Shield,
  Heart,
  Users,
  Target,
  Award,
  Check,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant Generation',
    description: 'Transform your content into platform-optimized posts in seconds',
  },
  {
    icon: Globe,
    title: '15+ Platforms',
    description: 'Support for all major social media platforms in one place',
  },
  {
    icon: Target,
    title: 'Smart Optimization',
    description: 'AI-powered hashtag generation and content formatting',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Your data stays secure with end-to-end encryption',
  },
];

const STATS = [
  { value: '15+', label: 'Platforms Supported' },
  { value: '7', label: 'Content Tones' },
  { value: '100%', label: 'Free Forever' },
  { value: '15', label: 'Languages' },
];

const VALUES = [
  {
    icon: Heart,
    title: 'User-Centric',
    description: 'Every feature is designed with our users in mind. We prioritize simplicity, speed, and effectiveness.',
  },
  {
    icon: Users,
    title: 'Community Driven',
    description: 'We listen to feedback and continuously improve based on what our users need most.',
  },
  {
    icon: Award,
    title: 'Quality First',
    description: 'We maintain high standards for content generation, ensuring professional results every time.',
  },
];

export function AboutPage() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <section className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Social Media Repurposer
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          The free, powerful tool that transforms your content into optimized posts for every social media platform
        </p>
      </section>

      <section className="mb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((stat, index) => (
            <div
              key={index}
              className="text-center p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"
            >
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent mb-2">
                {stat.value}
              </p>
              <p className="text-gray-600 dark:text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Why Choose Us?
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="flex gap-4 p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Our Mission
        </h2>
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-8 text-white text-center">
          <p className="text-lg max-w-3xl mx-auto">
            We believe that great content deserves to reach every audience on every platform.
            Our mission is to make content repurposing accessible to everyone - creators, marketers,
            students, and businesses - completely free, without compromising on quality.
          </p>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          What We Stand For
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {VALUES.map((value, index) => {
            const Icon = value.icon;
            return (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{value.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{value.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Key Benefits
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'No account required to use basic features',
              'Works on all devices - desktop, tablet, and mobile',
              'Offline support with Progressive Web App',
              'Regular updates with new features',
              'Privacy-focused - your data stays yours',
              'Fast, lightweight, and ad-free experience',
            ].map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
