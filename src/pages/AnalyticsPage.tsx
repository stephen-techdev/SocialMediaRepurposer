import { useEffect, useState } from 'react';
import type { Analytics } from '../lib/supabase';
import { listAnalytics, listPosts } from '../lib/store';
import { BarChart3, TrendingUp, Calendar, PieChart, Activity, Loader2 } from 'lucide-react';

export function AnalyticsPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const [rows, posts] = await Promise.all([
          listAnalytics(12),
          listPosts({ limit: 500 }),
        ]);
        setAnalytics(rows);
        setTotalPosts(posts.length);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    }

    void fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (totalPosts === 0) {
    return (
      <div className="p-6 lg:p-8">
        <div className="text-center py-12 max-w-lg mx-auto">
          <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No data yet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Generate a few posts and this page will show which platforms and tones you actually use.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => onNavigate('repurpose')} className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium">
              Start Creating
            </button>
          </div>
        </div>
      </div>
    );
  }

  const platformStats: Record<string, number> = {};
  const toneStats: Record<string, number> = {};

  analytics.forEach(a => {
    a.platforms_used?.forEach(p => {
      platformStats[p] = (platformStats[p] || 0) + 1;
    });
    a.tones_used?.forEach(t => {
      toneStats[t] = (toneStats[t] || 0) + 1;
    });
  });

  const totalGenerated = analytics.reduce((sum, a) => sum + a.posts_generated, 0);
  const weeklyAverage = analytics.length > 0 ? Math.round(totalGenerated / analytics.length) : 0;

  const stats = [
    { label: 'Total Posts', value: totalPosts, icon: Activity, color: 'from-blue-500 to-cyan-500' },
    { label: 'Weekly Average', value: weeklyAverage, icon: TrendingUp, color: 'from-emerald-500 to-green-500' },
    { label: 'Platforms Used', value: Object.keys(platformStats).length, icon: PieChart, color: 'from-orange-500 to-amber-500' },
    { label: 'Weeks Active', value: analytics.length, icon: Calendar, color: 'from-pink-500 to-rose-500' },
  ];

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your content generation performance
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Weekly Activity
          </h2>

          {analytics.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No data yet
            </div>
          ) : (
            <div className="h-48 flex items-end gap-2">
              {analytics.slice(0, 12).reverse().map((a, i) => {
                const height = Math.max(10, (a.posts_generated / (Math.max(...analytics.map(x => x.posts_generated)) || 1)) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-gradient-to-t from-blue-500 to-cyan-500 rounded-t-lg transition-all hover:opacity-80 cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`${a.posts_generated} posts`}
                    />
                    <span className="text-xs text-gray-400 hidden sm:block">
                      W{i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Platform Distribution
          </h2>

          {Object.keys(platformStats).length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No data yet
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(platformStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([platform, count]) => {
                  const percentage = ((count / totalPosts) * 100).toFixed(0);
                  return (
                    <div key={platform} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-gray-600 dark:text-gray-400 truncate">
                        {platform}
                      </span>
                      <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-12 text-sm text-gray-600 dark:text-gray-400 text-right">
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Tone Usage
          </h2>

          {Object.keys(toneStats).length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No data yet
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(toneStats)
                .sort((a, b) => b[1] - a[1])
                .map(([tone, count]) => (
                  <div key={tone} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <p className="font-medium text-gray-900 dark:text-white capitalize">{tone}</p>
                    <p className="text-2xl font-bold text-blue-500">{count}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">posts</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
