import React, { useState } from 'react';
import { Send, Clock, Calendar, ChevronDown, AlertTriangle, CheckCircle, Loader } from 'lucide-react';

interface PublishingControlsProps {
  connectedPlatforms: string[];
  onPublish: (platforms: string[], scheduleTime?: Date) => void;
  onSchedule: (platforms: string[], scheduleTime: Date, recurring?: boolean) => void;
  isPublishing?: boolean;
}

const PublishingControls: React.FC<PublishingControlsProps> = ({
  connectedPlatforms,
  onPublish,
  onSchedule,
  isPublishing = false
}) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [recurring, setRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState('daily');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const platformNames: { [key: string]: string } = {
    twitter: 'X (Twitter)',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok'
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handlePublish = () => {
    if (selectedPlatforms.length === 0) return;

    if (publishMode === 'now') {
      setShowConfirmation(true);
    } else {
      const scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      onSchedule(selectedPlatforms, scheduleDateTime, recurring);
    }
  };

  const confirmPublish = () => {
    onPublish(selectedPlatforms);
    setShowConfirmation(false);
    setSelectedPlatforms([]);
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Minimum 5 minutes from now
    return now.toISOString().slice(0, 16);
  };

  if (connectedPlatforms.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <div>
            <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
              No Connected Accounts
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Connect at least one social media account to publish content.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform Selection */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Select Platforms
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {connectedPlatforms.map(platform => (
            <button
              key={platform}
              onClick={() => handlePlatformToggle(platform)}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedPlatforms.includes(platform)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="text-sm font-medium">
                {platformNames[platform] || platform}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Publishing Mode */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Publishing Options
        </h4>
        <div className="flex space-x-4">
          <button
            onClick={() => setPublishMode('now')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
              publishMode === 'now'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Send className="h-4 w-4" />
            <span className="text-sm">Post Now</span>
          </button>
          <button
            onClick={() => setPublishMode('schedule')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
              publishMode === 'schedule'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span className="text-sm">Schedule</span>
          </button>
        </div>
      </div>

      {/* Schedule Settings */}
      {publishMode === 'schedule' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date
              </label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time
              </label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
            </select>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="recurring"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="recurring" className="text-sm text-gray-700 dark:text-gray-300">
              Recurring post
            </label>
            {recurring && (
              <select
                value={recurringType}
                onChange={(e) => setRecurringType(e.target.value)}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>
        </div>
      )}

      {/* Publish Button */}
      <button
        onClick={handlePublish}
        disabled={selectedPlatforms.length === 0 || isPublishing || (publishMode === 'schedule' && (!scheduleDate || !scheduleTime))}
        className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPublishing ? (
          <>
            <Loader className="h-5 w-5 animate-spin" />
            <span>Publishing...</span>
          </>
        ) : (
          <>
            {publishMode === 'now' ? <Send className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
            <span>
              {publishMode === 'now' 
                ? `Publish to ${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? 's' : ''}`
                : 'Schedule Post'
              }
            </span>
          </>
        )}
      </button>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Confirm Publishing
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to publish this content to the following platforms?
            </p>
            <div className="space-y-2 mb-6">
              {selectedPlatforms.map(platform => (
                <div key={platform} className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {platformNames[platform]}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPublish}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Publish Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishingControls;