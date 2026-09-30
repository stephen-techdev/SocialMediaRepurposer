import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Post } from '../lib/supabase';
import { listPosts, setFavorite, storageMode } from '../lib/store';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import {
  Heart,
  Download,
  Copy,
  Search,
  X,
  Eye,
  Loader2,
} from 'lucide-react';

export function FavoritesPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth();
  const { toasts, success, error, removeToast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const load = useCallback(async () => {
    try {
      setPosts(await listPosts({ userId: user?.id ?? null, onlyFavorites: true, limit: 200 }));
    } catch {
      error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  }, [user?.id, error]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggleFavorite = async (postId: string) => {
    try {
      await setFavorite(postId, false, user?.id ?? null);
      setPosts(posts.filter(p => p.id !== postId));
      success('Removed from favorites');
    } catch {
      error('Failed to update');
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      success('Copied to clipboard');
    } catch {
      error('Failed to copy');
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(posts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'favorites_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    success('Favorites exported');
  };

  const filteredPosts = posts.filter(post =>
    !searchQuery ||
    post.original_content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.generated_post?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {storageMode === 'local' && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
          <span>Favourites are stored in this browser only. Add Supabase keys to <code>.env</code> to sync them.</span>
          <button onClick={() => onNavigate('auth')} className="ml-auto shrink-0 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium">
            Sign in
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Favorites
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {posts.length} saved posts
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={posts.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search favorites..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {posts.length === 0 ? 'No favorites yet' : 'No matching posts'}
          </p>
          <button
            onClick={() => onNavigate('repurpose')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium"
          >
            Start Creating
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPosts.map(post => (
            <div
              key={post.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                  {post.platform}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setSelectedPost(post)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleCopy(post.generated_post || post.original_content)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleToggleFavorite(post.id)}
                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Heart className="w-4 h-4 text-pink-500 fill-current" />
                  </button>
                </div>
              </div>
              <p className="text-gray-900 dark:text-white font-medium line-clamp-2 mb-2">
                {post.generated_post?.slice(0, 100) || post.original_content.slice(0, 100)}...
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(post.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Favorite Post
              </h2>
              <button
                onClick={() => setSelectedPost(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Platform
                  </label>
                  <p className="text-gray-900 dark:text-white">{selectedPost.platform}</p>
                </div>
                {selectedPost.generated_post && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Generated Post
                    </label>
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                      {selectedPost.generated_post}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => handleCopy(selectedPost.generated_post || selectedPost.original_content)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg transition-shadow"
              >
                Copy Post
              </button>
              <button
                onClick={() => handleToggleFavorite(selectedPost.id)}
                className="px-4 py-3 rounded-xl bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 font-medium hover:bg-pink-200 dark:hover:bg-pink-900/50 transition-colors"
              >
                <Heart className="w-5 h-5 fill-current" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
