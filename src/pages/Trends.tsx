import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Search, Filter, Hash, Clock, Users, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Trend {
  id: number;
  keyword: string;
  category: string;
  trendScore: number;
  volume: number;
  growth: string;
  platforms: string[];
  relatedHashtags: string[];
  peakTime: string;
  demographics: {
    age: string;
    interests: string[];
  };
}

const Trends: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('twitter');

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/trends?platform=${selectedPlatform}&limit=20`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.status === 401 || response.status === 403) {
          // Authentication failed - logout user and redirect to login
          logout();
          return;
        }
        
        if (!response.ok) {
          console.error('Failed to fetch trends:', response.status, response.statusText);
          setTrends([]);
          return;
        }
        
        const data = await response.json();
        
        // Ensure data is an array before setting trends
        if (Array.isArray(data)) {
          setTrends(data);
        } else {
          console.error('Trends data is not an array:', data);
          setTrends([]);
        }
      } catch (error) {
        console.error('Error fetching trends:', error);
        setTrends([]);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchTrends();
    }
  }, [token, selectedPlatform, logout]);

  const filteredTrends = trends.filter(trend =>
    trend.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trend.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const platforms = [
    { id: 'twitter', name: 'X (Twitter)', icon: '𝕏' },
    { id: 'instagram', name: 'Instagram', icon: '📷' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵' },
    { id: 'facebook', name: 'Facebook', icon: 'f' },
    { id: 'youtube', name: 'YouTube', icon: '▶️' }
  ];

  const getTrendColor = (score: number) => {
    if (score >= 90) return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
    if (score >= 80) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
    return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
  };

  const handleUseInContent = (trend: Trend) => {
    // Store the trend data in sessionStorage so it can be accessed by the content generator
    const trendData = {
      topic: trend.keyword,
      category: trend.category,
      hashtags: trend.relatedHashtags,
      demographics: trend.demographics,
      peakTime: trend.peakTime,
      trendScore: trend.trendScore
    };
    
    sessionStorage.setItem('selectedTrend', JSON.stringify(trendData));
    
    // Navigate to the content generator
    navigate('/generate');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Trending Topics</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Discover what's trending across social media platforms</p>
        </div>
      </div>

      {/* Search and Platform Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search trends..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm sm:text-base"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm sm:text-base min-w-[140px]"
            >
              {platforms.map(platform => (
                <option key={platform.id} value={platform.id}>
                  {platform.icon} {platform.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Platform Status Indicator */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Live trends from {platforms.find(p => p.id === selectedPlatform)?.name}
            </span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {trends.length} trends found
          </div>
        </div>
      </div>

      {/* Trends Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {filteredTrends.map((trend) => (
          <div key={trend.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {trend.keyword}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(trend.trendScore)} flex-shrink-0`}>
                    {trend.trendScore}/100
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">{trend.category}</p>
                <p className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400">{trend.growth} growth</p>
              </div>
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
              <div className="flex items-center">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 mr-2 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Volume</p>
                  <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">
                    {typeof trend.volume === 'number' ? trend.volume.toLocaleString() : trend.volume}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 mr-2 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Peak Time</p>
                  <p className="font-medium text-gray-900 dark:text-white text-xs sm:text-sm">
                    {trend.peakTime}
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Badge */}
            <div className="mb-4">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">Platform:</p>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {trend.platforms.map(platform => {
                  const platformInfo = platforms.find(p => p.id === platform);
                  return (
                    <span
                      key={platform}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded-md capitalize flex items-center space-x-1"
                    >
                      <span>{platformInfo?.icon || '📱'}</span>
                      <span>{platformInfo?.name || platform}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Hashtags */}
            <div className="mb-4">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">Related hashtags:</p>
              <div className="flex flex-wrap gap-1">
                {trend.relatedHashtags.slice(0, 4).map((hashtag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                  >
                    <Hash className="h-3 w-3 mr-1" />
                    {hashtag.replace('#', '')}
                  </span>
                ))}
              </div>
            </div>

            {/* Demographics and Action */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  <span className="text-xs sm:text-sm">Age: {trend.demographics.age}</span>
                </div>
                <button 
                  onClick={() => handleUseInContent(trend)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-xs sm:text-sm transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded"
                >
                  Use in Content
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTrends.length === 0 && !loading && (
        <div className="text-center py-8 sm:py-12">
          <TrendingUp className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
            No trends found
          </h3>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search criteria.' : `No trends available for ${platforms.find(p => p.id === selectedPlatform)?.name} at the moment.`}
          </p>
        </div>
      )}
    </div>
  );
};

export default Trends;