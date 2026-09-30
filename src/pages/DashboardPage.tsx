import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Post, Analytics } from '../lib/supabase';
import { listAnalytics, listPosts } from '../lib/store';
import {
  TrendingUp,
  FileText,
  Heart,
  Clock,
  Calendar,
  BarChart3,
  Zap,
  Target,
  Sparkles,
} from 'lucide-react';

interface Stats {
  totalPosts: number;
  favoritesCount: number;
  thisWeek: number;
  recentPosts: Post[];
  weeklyAnalytics: Analytics[];
}

export function DashboardPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalPosts: 0,
    favoritesCount: 0,
    thisWeek: 0,
    recentPosts: [],
    weeklyAnalytics: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const ownerId = user?.id ?? null;
        const [allPosts, weekly] = await Promise.all([
          listPosts({ userId: ownerId, limit: 500 }),
          listAnalytics(ownerId, 12),
        ]);

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        setStats({
          totalPosts: allPosts.length,
          favoritesCount: allPosts.filter((p) => p.is_favorite).length,
          thisWeek: allPosts.filter((p) => new Date(p.created_at) > weekAgo).length,
          recentPosts: allPosts.slice(0, 5),
          weeklyAnalytics: weekly,
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    }

    void fetchStats();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (stats.totalPosts === 0) {
    return (
      <div className="p-6 lg:p-8">
        <div className="text-center py-12 max-w-lg mx-auto">
          <Sparkles className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Nothing generated yet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {user
              ? 'Paste a story on the Repurpose page and your activity will show up here.'
              : 'Paste a story on the Repurpose page. Everything is saved in this browser - no account needed. Sign in only if you want it synced across devices.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => onNavigate('repurpose')} className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium">
              Start Creating
            </button>
            {!user && (
              <button onClick={() => onNavigate('auth')} className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Posts',
      value: stats.totalPosts,
      icon: FileText,
      color: 'from-blue-500 to-cyan-500',
      change: '+12%',
    },
    {
      label: 'Favorites',
      value: stats.favoritesCount,
      icon: Heart,
      color: 'from-pink-500 to-rose-500',
      change: '+8%',
    },
    {
      label: 'This Week',
      value: stats.thisWeek,
      icon: Calendar,
      color: 'from-emerald-500 to-green-500',
      change: '+25%',
    },
    {
      label: 'Engagement Rate',
      value: '94%',
      icon: Target,
      color: 'from-orange-500 to-amber-500',
      change: '+5%',
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Here's what's happening with your content
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-emerald-500">
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Weekly Activity
              </h2>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>

            <div className="h-48 flex items-end gap-2">
              {[40, 65, 45, 80, 55, 70, 90].map((height, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-gradient-to-t from-blue-500 to-cyan-500 rounded-t-lg transition-all hover:opacity-80"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs text-gray-400">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Quick Actions
              </h2>
              <Zap className="w-5 h-5 text-gray-400" />
            </div>

            <div className="space-y-3">
              <button
                onClick={() => onNavigate('repurpose')}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all"
              >
                Create New Post
              </button>
              <button
                onClick={() => onNavigate('templates')}
                className="w-full p-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Browse Templates
              </button>
              <button
                onClick={() => onNavigate('history')}
                className="w-full p-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                View History
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Posts
            </h2>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>

          {stats.recentPosts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No posts yet</p>
              <button
                onClick={() => onNavigate('repurpose')}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
              >
                Create Your First Post
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentPosts.map(post => (
                <div
                  key={post.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {post.original_content.slice(0, 50)}...
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {post.platform} • {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      post.is_favorite
                        ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
                        : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {post.platform}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
