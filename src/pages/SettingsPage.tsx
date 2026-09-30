import { useState, useEffect } from 'react';
import { loadLocalProfile, saveLocalProfile } from '../lib/store';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import { PLATFORMS, TONES, LANGUAGES } from '../lib/constants';
import {
  Sun,
  Moon,
  Monitor,
  Type,
  Bell,
  Save,
  Eye,
  Target,
  Loader2,
  Contrast,
} from 'lucide-react';

export function SettingsPage() {
  const { theme, setTheme, fontSize, setFontSize, highContrast, setHighContrast } = useTheme();
  const { toasts, success, error, removeToast } = useToast();
  const [saving, setSaving] = useState(false);
  // There is no account, so these are seeded from localStorage and written back
  // to it. The previous version bailed out early when nobody was signed in,
  // which made the Save button silently do nothing.
  const [localSettings, setLocalSettings] = useState(() => {
    const stored = loadLocalProfile() ?? {};
    return {
      default_platform: (stored.default_platform as string) || 'twitter',
      default_tone: (stored.default_tone as string) || 'professional',
      language: (stored.language as string) || 'en',
      auto_save: (stored.auto_save as boolean) ?? true,
      notifications: (stored.notifications as boolean) ?? true,
    };
  });

  useEffect(() => {
    // Preferences must be available before the first generation, not only after
    // the user visits Settings and presses Save.
    saveLocalProfile({ ...loadLocalProfile(), ...localSettings });
  }, [localSettings]);

  const handleSave = () => {
    setSaving(true);
    try {
      saveLocalProfile({
        ...loadLocalProfile(),
        ...localSettings,
        theme,
        font_size: fontSize,
        high_contrast: highContrast,
      });
      success('Settings saved');
    } catch {
      error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const themeOptions = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  const fontSizeOptions = [
    { id: 'small', label: 'Small' },
    { id: 'medium', label: 'Medium' },
    { id: 'large', label: 'Large' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Customize your experience
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Sun className="w-5 h-5" />
            Appearance
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map(option => {
                  const Icon = option.icon;
                  const isActive = theme === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setTheme(option.id as 'light' | 'dark' | 'system')}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isActive ? 'text-blue-500' : 'text-gray-500'}`} />
                      <span className={`font-medium ${isActive ? 'text-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Type className="w-4 h-4" />
                Font Size
              </label>
              <div className="grid grid-cols-3 gap-3">
                {fontSizeOptions.map(option => {
                  const isActive = fontSize === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setFontSize(option.id as 'small' | 'medium' | 'large')}
                      className={`py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-500'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Contrast className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">High Contrast</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">For better visibility</p>
                </div>
              </div>
              <button
                onClick={() => setHighContrast(!highContrast)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  highContrast ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                    highContrast ? 'translate-x-6' : 'translate-x-0.5'
                  } mt-0.5`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Defaults
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Platform
              </label>
              <select
                value={localSettings.default_platform}
                onChange={e => setLocalSettings(prev => ({ ...prev, default_platform: e.target.value }))}
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {PLATFORMS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Tone
              </label>
              <select
                value={localSettings.default_tone}
                onChange={e => setLocalSettings(prev => ({ ...prev, default_tone: e.target.value }))}
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {TONES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Language
              </label>
              <select
                value={localSettings.language}
                onChange={e => setLocalSettings(prev => ({ ...prev, language: e.target.value }))}
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {LANGUAGES.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Preferences
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Save className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Auto Save</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Save posts automatically</p>
                </div>
              </div>
              <button
                onClick={() => setLocalSettings(prev => ({ ...prev, auto_save: !prev.auto_save }))}
                className={`w-12 h-6 rounded-full transition-colors ${
                  localSettings.auto_save ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                    localSettings.auto_save ? 'translate-x-6' : 'translate-x-0.5'
                  } mt-0.5`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Enable browser notifications</p>
                </div>
              </div>
              <button
                onClick={() => setLocalSettings(prev => ({ ...prev, notifications: !prev.notifications }))}
                className={`w-12 h-6 rounded-full transition-colors ${
                  localSettings.notifications ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                    localSettings.notifications ? 'translate-x-6' : 'translate-x-0.5'
                  } mt-0.5`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Accessibility
          </h2>

          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Screen reader support is enabled by default. Use keyboard shortcuts for quick navigation.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Keyboard Shortcuts</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><kbd className="px-2 py-1 bg-white dark:bg-gray-600 rounded">Ctrl + S</kbd> Save current post</li>
                <li><kbd className="px-2 py-1 bg-white dark:bg-gray-600 rounded">Ctrl + C</kbd> Copy generated post</li>
                <li><kbd className="px-2 py-1 bg-white dark:bg-gray-600 rounded">Ctrl + G</kbd> Generate posts</li>
                <li><kbd className="px-2 py-1 bg-white dark:bg-gray-600 rounded">Tab</kbd> Navigate between fields</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
