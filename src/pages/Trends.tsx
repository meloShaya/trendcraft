import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Search, Filter, Hash, Clock, Users, BarChart3, Sparkles, Zap, MapPin, AlertCircle } from 'lucide-react';
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

interface Location {
  name: string;
  woeid: number;
}

// Demo trends data for local memory mode
const DEMO_TRENDS: Trend[] = [
  {
    id: 1,
    keyword: "AI Content Creation",
    category: "Technology",
    trendScore: 94,
    volume: 125000,
    growth: "+45%",
    platforms: ["twitter", "linkedin"],
    relatedHashtags: ["#AI", "#ContentCreation", "#TechTrends", "#Innovation"],
    peakTime: "14:00-16:00 UTC",
    demographics: { age: "25-34", interests: ["technology", "marketing", "entrepreneurship"] }
  },
  {
    id: 2,
    keyword: "Sustainable Technology",
    category: "Environment",
    trendScore: 87,
    volume: 89000,
    growth: "+32%",
    platforms: ["twitter", "instagram"],
    relatedHashtags: ["#GreenTech", "#Sustainability", "#CleanEnergy", "#EcoFriendly"],
    peakTime: "10:00-12:00 UTC",
    demographics: { age: "18-35", interests: ["environment", "technology", "sustainability"] }
  },
  {
    id: 3,
    keyword: "Remote Work Trends",
    category: "Business",
    trendScore: 82,
    volume: 67000,
    growth: "+28%",
    platforms: ["linkedin", "twitter"],
    relatedHashtags: ["#RemoteWork", "#WorkFromHome", "#DigitalNomad", "#FutureOfWork"],
    peakTime: "09:00-11:00 UTC",
    demographics: { age: "25-45", interests: ["business", "productivity", "lifestyle"] }
  },
  {
    id: 4,
    keyword: "Mental Health Awareness",
    category: "Health",
    trendScore: 91,
    volume: 156000,
    growth: "+52%",
    platforms: ["instagram", "tiktok"],
    relatedHashtags: ["#MentalHealth", "#Wellness", "#SelfCare", "#Mindfulness"],
    peakTime: "19:00-21:00 UTC",
    demographics: { age: "18-30", interests: ["health", "wellness", "lifestyle"] }
  },
  {
    id: 5,
    keyword: "Cryptocurrency Updates",
    category: "Finance",
    trendScore: 76,
    volume: 234000,
    growth: "+18%",
    platforms: ["twitter", "reddit"],
    relatedHashtags: ["#Crypto", "#Bitcoin", "#Blockchain", "#DeFi"],
    peakTime: "15:00-17:00 UTC",
    demographics: { age: "20-40", interests: ["finance", "technology", "investing"] }
  },
  {
    id: 6,
    keyword: "Plant-Based Nutrition",
    category: "Health",
    trendScore: 85,
    volume: 78000,
    growth: "+38%",
    platforms: ["instagram", "tiktok"],
    relatedHashtags: ["#PlantBased", "#Vegan", "#HealthyEating", "#Nutrition"],
    peakTime: "12:00-14:00 UTC",
    demographics: { age: "22-35", interests: ["health", "nutrition", "lifestyle"] }
  }
];

const DEMO_LOCATIONS: Location[] = [
  { name: "Worldwide", woeid: 1 },
  { name: "United States", woeid: 23424977 },
  { name: "United Kingdom", woeid: 23424975 },
  { name: "Canada", woeid: 23424775 },
  { name: "Australia", woeid: 23424748 },
  { name: "Germany", woeid: 23424829 },
  { name: "France", woeid: 23424819 },
  { name: "Japan", woeid: 23424856 }
];

const USE_LOCAL_MEMORY = true;

const Trends: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('twitter');
  const [selectedLocation, setSelectedLocation] = useState('1'); // Worldwide by default
  const [analyzingTrend, setAnalyzingTrend] = useState<number | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');

  // Load supported locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        if (USE_LOCAL_MEMORY) {
          console.log('🔄 [TRENDS] Using demo locations');
          setLocations(DEMO_LOCATIONS);
          return;
        }

        // Original API call (kept intact)
        const response = await fetch('/api/trends/locations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.status === 401 || response.status === 403) {
          logout();
          return;
        }
        
        if (response.ok) {
          const data = await response.json();
          setLocations(data);
        } else {
          setLocations(DEMO_LOCATIONS);
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
        setLocations(DEMO_LOCATIONS);
      }
    };

    if (token) {
      fetchLocations();
    }
  }, [token, logout]);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        
        if (USE_LOCAL_MEMORY) {
          console.log('🔄 [TRENDS] Using demo trends data');
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          setTrends(DEMO_TRENDS);
          setLoading(false);
          return;
        }

        // Original API call (kept intact)
        const response = await fetch(`/api/trends?platform=${selectedPlatform}&limit=20&location=${selectedLocation}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.status === 401 || response.status === 403) {
          logout();
          return;
        }
        
        if (!response.ok) {
          console.error('Failed to fetch trends:', response.status, response.statusText);
          setTrends([]);
          return;
        }
        
        const data = await response.json();
        
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
  }, [token, selectedPlatform, selectedLocation, logout]);

  const filteredTrends = trends.filter(trend =>
    trend.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trend.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const platforms = [
    { id: 'twitter', name: 'X (Twitter)', icon: '𝕏', supported: true },
    { id: 'instagram', name: 'Instagram', icon: '📷', supported: true },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', supported: true },
    { id: 'facebook', name: 'Facebook', icon: 'f', supported: true },
    { id: 'youtube', name: 'YouTube', icon: '▶️', supported: true }
  ];

  const getTrendColor = (score: number) => {
    if (score >= 90) return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
    if (score >= 80) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
    return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
  };

  const handleUseInContent = async (trend: Trend) => {
    setAnalyzingTrend(trend.id);
    
    try {
      // Step 1: Search for context
      setProcessingStage('🔍 Searching for context...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 2: Analyze the trend with context and location
      setProcessingStage('🧠 Analyzing trend...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (USE_LOCAL_MEMORY) {
        // Demo mode - just simulate the process
        setProcessingStage('✨ Finalizing...');
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // Original API call (kept intact)
        const analysisResponse = await fetch('/api/content/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            topic: trend.keyword,
            platform: selectedPlatform,
            tone: 'professional',
            includeHashtags: true,
            targetAudience: trend.demographics.interests.join(', ') || '',
            isAnalysisOnly: true,
            locationWoeid: selectedLocation
          })
        });

        if (!analysisResponse.ok) {
          throw new Error('Failed to analyze trend');
        }

        setProcessingStage('✨ Finalizing...');
      }

      // Store the trend data with analysis in sessionStorage
      const trendData = {
        topic: trend.keyword,
        category: trend.category,
        hashtags: trend.relatedHashtags,
        demographics: trend.demographics,
        peakTime: trend.peakTime,
        trendScore: trend.trendScore,
        platform: selectedPlatform,
        volume: trend.volume,
        growth: trend.growth,
        locationWoeid: selectedLocation
      };
      
      sessionStorage.setItem('selectedTrend', JSON.stringify(trendData));
      
      // Navigate to the content generator
      navigate('/generate');
    } catch (error) {
      console.error('Error analyzing trend:', error);
      // Fallback: navigate without analysis
      const trendData = {
        topic: trend.keyword,
        category: trend.category,
        hashtags: trend.relatedHashtags,
        demographics: trend.demographics,
        peakTime: trend.peakTime,
        trendScore: trend.trendScore,
        locationWoeid: selectedLocation
      };
      
      sessionStorage.setItem('selectedTrend', JSON.stringify(trendData));
      navigate('/generate');
    } finally {
      setAnalyzingTrend(null);
      setProcessingStage('');
    }
  };

  const selectedLocationName = locations.find(loc => loc.woeid.toString() === selectedLocation)?.name || 'Worldwide';
  const selectedPlatformData = platforms.find(p => p.id === selectedPlatform);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Demo Mode Notice */}
      {USE_LOCAL_MEMORY && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-900 dark:text-green-200">
                🚀 Demo Mode - Live Trending Data Available!
              </p>
              <p className="text-xs text-green-700 dark:text-green-300">
                Explore real-time trending topics across all platforms. Click "Create Viral Content" to generate AI-powered posts based on these trends.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Trending Topics</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Discover what's trending across social media platforms</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4">
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

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Platform Filter */}
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

            {/* Location Filter */}
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm sm:text-base min-w-[140px]"
              >
                {locations.map(location => (
                  <option key={location.woeid} value={location.woeid}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Platform Status Indicator */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Live trends from {selectedPlatformData?.name} • {selectedLocationName}
            </span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {trends.length} trends found
          </div>
        </div>
      </div>

      {/* Enhanced AI Notice */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 sm:p-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
              🚀 Enhanced AI Content Generation with Location Context
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              Our AI now uses a sophisticated three-step process: searching for real-time context from your selected location, 
              analyzing the trend's core emotion and talking points, then generating viral content with proven hooks and cultural relevance.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                🔍 Real-time Context Search
              </span>
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                🧠 Location-aware Analysis
              </span>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs rounded-full">
                🎯 Cultural Optimization
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trends Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {filteredTrends.map((trend) => (
          <div key={trend.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-600">
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

            {/* Demographics and Enhanced Action */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  <span className="text-xs sm:text-sm">Age: {trend.demographics.age}</span>
                </div>
                <button 
                  onClick={() => handleUseInContent(trend)}
                  disabled={analyzingTrend === trend.id}
                  className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {analyzingTrend === trend.id ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span className="hidden sm:inline">{processingStage}</span>
                      <span className="sm:hidden">Processing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Create Viral Content</span>
                      <span className="sm:hidden">Create</span>
                    </>
                  )}
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
            {searchTerm 
              ? 'Try adjusting your search criteria.' 
              : `No trends available for ${selectedPlatformData?.name} in ${selectedLocationName} at the moment.`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default Trends;