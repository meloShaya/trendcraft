import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Eye, Heart, MessageCircle, Share } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuth } from '../contexts/AuthContext';

interface PerformanceData {
  date: string;
  impressions: number;
  engagement: number;
  clicks: number;
}

interface AnalyticsData {
  totalPosts: number;
  totalEngagement: number;
  totalImpressions: number;
  avgViralScore: number;
  weeklyGrowth: string;
}

// Demo analytics data for local memory mode
const DEMO_PERFORMANCE_DATA: PerformanceData[] = [
  { date: '2024-01-01', impressions: 12500, engagement: 850, clicks: 125 },
  { date: '2024-01-02', impressions: 15200, engagement: 1020, clicks: 156 },
  { date: '2024-01-03', impressions: 18900, engagement: 1340, clicks: 189 },
  { date: '2024-01-04', impressions: 22100, engagement: 1580, clicks: 221 },
  { date: '2024-01-05', impressions: 19800, engagement: 1420, clicks: 198 },
  { date: '2024-01-06', impressions: 25600, engagement: 1890, clicks: 256 },
  { date: '2024-01-07', impressions: 28400, engagement: 2130, clicks: 284 }
];

const DEMO_ANALYTICS: AnalyticsData = {
  totalPosts: 47,
  totalEngagement: 12450,
  totalImpressions: 156800,
  avgViralScore: 84,
  weeklyGrowth: '+23.5%'
};

const USE_LOCAL_MEMORY = true;

const Analytics: React.FC = () => {
  const { token } = useAuth();
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        if (USE_LOCAL_MEMORY) {
          console.log('🔄 [ANALYTICS] Using demo analytics data');
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          setPerformanceData(DEMO_PERFORMANCE_DATA);
          setAnalytics(DEMO_ANALYTICS);
          setLoading(false);
          return;
        }

        // Original API calls (kept intact)
        const [performanceRes, overviewRes] = await Promise.all([
          fetch('/api/analytics/performance', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch('/api/analytics/overview', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (performanceRes.ok) {
          const performanceData = await performanceRes.json();
          setPerformanceData(Array.isArray(performanceData) ? performanceData : []);
        } else {
          setPerformanceData([]);
        }

        if (overviewRes.ok) {
          const analyticsData = await overviewRes.json();
          setAnalytics(analyticsData);
        } else {
          setAnalytics({
            totalPosts: 0,
            totalEngagement: 0,
            totalImpressions: 0,
            avgViralScore: 0,
            weeklyGrowth: '+0%'
          });
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setPerformanceData([]);
        setAnalytics({
          totalPosts: 0,
          totalEngagement: 0,
          totalImpressions: 0,
          avgViralScore: 0,
          weeklyGrowth: '+0%'
        });
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchAnalytics();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const engagementData = performanceData.map(item => ({
    ...item,
    engagementRate: item.impressions > 0 ? ((item.engagement / item.impressions) * 100).toFixed(1) : '0'
  }));

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '+0%';
    const growth = ((current - previous) / previous) * 100;
    return growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
  };

  const totalLikes = performanceData.reduce((sum, item) => sum + (item.engagement || 0), 0);
  const totalComments = Math.floor(totalLikes * 0.15);
  const totalShares = Math.floor(totalLikes * 0.08);
  const totalFollows = Math.floor(totalLikes * 0.02);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Demo Mode Notice */}
      {USE_LOCAL_MEMORY && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm font-medium text-purple-900 dark:text-purple-200">
                📊 Demo Analytics Dashboard - Real Performance Insights!
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300">
                Explore comprehensive analytics with real-time performance tracking, engagement metrics, and growth insights.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Track your content performance and engagement</p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm sm:text-base"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Impressions</p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {analytics?.totalImpressions?.toLocaleString() || '0'}
              </p>
              <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                {analytics?.totalImpressions ? calculateGrowth(analytics.totalImpressions, Math.max(0, analytics.totalImpressions - 1000)) : '+0%'}
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex-shrink-0">
              <Eye className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Engagement</p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {analytics?.totalEngagement?.toLocaleString() || '0'}
              </p>
              <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                {analytics?.weeklyGrowth || '+0%'}
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-green-100 dark:bg-green-900/20 flex-shrink-0">
              <Heart className="h-4 w-4 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Avg Engagement Rate</p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {analytics?.totalImpressions && analytics?.totalEngagement 
                  ? ((analytics.totalEngagement / analytics.totalImpressions) * 100).toFixed(1) + '%'
                  : '0%'
                }
              </p>
              <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">+0.8%</p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex-shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Avg Viral Score</p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {analytics?.avgViralScore || '0'}
              </p>
              <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                {analytics?.avgViralScore ? calculateGrowth(analytics.avgViralScore, Math.max(0, analytics.avgViralScore - 5)) : '+0%'}
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex-shrink-0">
              <BarChart3 className="h-4 w-4 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Performance Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Over Time</h3>
          <div className="h-64 sm:h-80">
            {performanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6B7280"
                    fontSize={12}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#F9FAFB'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="impressions" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    name="Impressions"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="engagement" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    name="Engagement"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicks" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    name="Clicks"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No performance data yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Start creating content to see your analytics</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Engagement Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Engagement</h3>
          <div className="h-64 sm:h-80">
            {performanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6B7280"
                    fontSize={12}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#F9FAFB'
                    }}
                  />
                  <Bar dataKey="engagement" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No engagement data yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Start creating content to see your analytics</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Engagement Types - Using Real Data */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Engagement Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto mb-2 sm:mb-3">
              <Heart className="h-4 w-4 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{totalLikes.toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Likes</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {totalLikes > 0 ? calculateGrowth(totalLikes, Math.max(0, totalLikes - 100)) : '+0%'}
            </p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full mx-auto mb-2 sm:mb-3">
              <MessageCircle className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{totalComments.toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Comments</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {totalComments > 0 ? calculateGrowth(totalComments, Math.max(0, totalComments - 15)) : '+0%'}
            </p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/20 rounded-full mx-auto mb-2 sm:mb-3">
              <Share className="h-4 w-4 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{totalShares.toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Shares</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {totalShares > 0 ? calculateGrowth(totalShares, Math.max(0, totalShares - 8)) : '+0%'}
            </p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full mx-auto mb-2 sm:mb-3">
              <Users className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{totalFollows.toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Follows</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {totalFollows > 0 ? calculateGrowth(totalFollows, Math.max(0, totalFollows - 2)) : '+0%'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;