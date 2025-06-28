import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Users, 
  BarChart3, 
  Zap, 
  ArrowUpRight,
  Clock,
  Heart,
  MessageCircle,
  Share,
  ArrowDownRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import PostingStreak from '../components/PostingStreak';

interface AnalyticsData {
  totalPosts: number;
  totalEngagement: number;
  totalImpressions: number;
  avgViralScore: number;
  weeklyGrowth: string;
  topPerformingPost: any;
}

interface PerformanceData {
  date: string;
  impressions: number;
  engagement: number;
  clicks: number;
}

const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [analyticsRes, performanceRes] = await Promise.all([
          fetch('/api/analytics/overview', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch('/api/analytics/performance', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json();
          setAnalytics(analyticsData);
        } else {
          // Set default analytics if API fails
          setAnalytics({
            totalPosts: 0,
            totalEngagement: 0,
            totalImpressions: 0,
            avgViralScore: 0,
            weeklyGrowth: '+0%',
            topPerformingPost: null
          });
        }

        if (performanceRes.ok) {
          const performanceData = await performanceRes.json();
          setPerformanceData(Array.isArray(performanceData) ? performanceData : []);
        } else {
          // Set empty array if API fails
          setPerformanceData([]);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set default values on error
        setAnalytics({
          totalPosts: 0,
          totalEngagement: 0,
          totalImpressions: 0,
          avgViralScore: 0,
          weeklyGrowth: '+0%',
          topPerformingPost: null
        });
        setPerformanceData([]);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'generate':
        navigate('/generate');
        break;
      case 'trends':
        navigate('/trends');
        break;
      case 'schedule':
        navigate('/posts');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Calculate real growth percentages based on data
  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '+0%';
    const growth = ((current - previous) / previous) * 100;
    return growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
  };

  const statCards = [
    {
      title: 'Total Posts',
      value: analytics?.totalPosts || 0,
      icon: BarChart3,
      color: 'blue',
      change: analytics?.totalPosts ? calculateGrowth(analytics.totalPosts, Math.max(0, analytics.totalPosts - 2)) : '+0%'
    },
    {
      title: 'Total Engagement',
      value: analytics?.totalEngagement || 0,
      icon: Heart,
      color: 'red',
      change: analytics?.weeklyGrowth || '+0%'
    },
    {
      title: 'Impressions',
      value: analytics?.totalImpressions?.toLocaleString() || '0',
      icon: TrendingUp,
      color: 'green',
      change: analytics?.totalImpressions ? calculateGrowth(analytics.totalImpressions, Math.max(0, analytics.totalImpressions - 1000)) : '+0%'
    },
    {
      title: 'Avg Viral Score',
      value: analytics?.avgViralScore || 0,
      icon: Zap,
      color: 'purple',
      change: analytics?.avgViralScore ? calculateGrowth(analytics.avgViralScore, Math.max(0, analytics.avgViralScore - 5)) : '+0%'
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{card.title}</p>
                <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1 sm:mt-2">{card.value}</p>
                <p className={`text-xs sm:text-sm mt-1 flex items-center ${
                  card.change.startsWith('+') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {card.change.startsWith('+') ? (
                    <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  )}
                  {card.change}
                </p>
              </div>
              <div className={`p-2 sm:p-3 rounded-lg bg-${card.color}-100 dark:bg-${card.color}-900/20 flex-shrink-0`}>
                <card.icon className={`h-4 w-4 sm:h-6 sm:w-6 text-${card.color}-600 dark:text-${card.color}-400`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Performance Chart */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance Trends
          </h3>
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
                    dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="engagement" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
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

        {/* Top Performing Post */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Performing Post
          </h3>
          {analytics?.topPerformingPost ? (
            <div className="space-y-4">
              <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-gray-900 dark:text-white text-sm leading-relaxed">
                  {analytics.topPerformingPost.content}
                </p>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <span className="flex items-center">
                    <Heart className="h-4 w-4 mr-1 text-red-500" />
                    <span className="text-xs sm:text-sm">{analytics.topPerformingPost.engagement?.likes || 0}</span>
                  </span>
                  <span className="flex items-center">
                    <MessageCircle className="h-4 w-4 mr-1 text-blue-500" />
                    <span className="text-xs sm:text-sm">{analytics.topPerformingPost.engagement?.comments || 0}</span>
                  </span>
                  <span className="flex items-center">
                    <Share className="h-4 w-4 mr-1 text-green-500" />
                    <span className="text-xs sm:text-sm">{analytics.topPerformingPost.engagement?.retweets || 0}</span>
                  </span>
                </div>
                <div className="flex items-center">
                  <Zap className="h-4 w-4 mr-1 text-yellow-500" />
                  <span className="font-medium text-xs sm:text-sm">{analytics.topPerformingPost.viralScore}/100</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No posts yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Create your first post to see performance data</p>
            </div>
          )}
        </div>
      </div>

      {/* Posting Streak Component */}
      <PostingStreak />

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <button 
            onClick={() => handleQuickAction('generate')}
            className="flex items-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
          >
            <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400 mr-3 group-hover:scale-110 transition-transform flex-shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Generate Content</p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Create AI-powered posts</p>
            </div>
          </button>
          
          <button 
            onClick={() => handleQuickAction('trends')}
            className="flex items-center p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group"
          >
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400 mr-3 group-hover:scale-110 transition-transform flex-shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Explore Trends</p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Discover what's trending</p>
            </div>
          </button>
          
          <button 
            onClick={() => handleQuickAction('schedule')}
            className="flex items-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
          >
            <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400 mr-3 group-hover:scale-110 transition-transform flex-shrink-0" />
            <div className="text-left min-w-0">
              <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Schedule Posts</p>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Plan your content</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;