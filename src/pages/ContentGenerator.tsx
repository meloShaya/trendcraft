import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Send, RotateCcw, Zap, Target, Clock, TrendingUp, Settings, Eye, Hash, MessageSquare, Edit, Save, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PlatformPreview from '../components/PlatformPreview';
import PlatformConnections from '../components/PlatformConnections';
import PublishingControls from '../components/PublishingControls';
import ScheduleManager from '../components/ScheduleManager';
import PlatformOptimizationPanel from '../components/PlatformOptimizationPanel';
import MediaGenerationOptions from '../components/MediaGenerationOptions';
import PricingModal from '../components/PricingModal';
import { useSubscription } from '../hooks/useSubscription';

interface GeneratedContent {
  content: string;
  viralScore: number;
  hashtags: string[];
  platform: string;
  recommendations: {
    bestPostTime: string;
    expectedReach: number;
    engagementPrediction: {
      likes: number;
      retweets: number;
      comments: number;
    };
  };
  platformOptimization?: {
    characterCount: number;
    characterLimit: number;
    hashtagCount: number;
    optimalHashtags: number;
    visualSuggestions: string[];
    ctaSuggestions: string[];
  };
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

interface TrendData {
  topic: string;
  category: string;
  hashtags: string[];
  demographics: {
    age: string;
    interests: string[];
  };
  peakTime: string;
  trendScore: number;
  locationWoeid?: string;
}

// Demo content generation for local memory mode
const USE_LOCAL_MEMORY = true;

const generateDemoContent = (formData: any): GeneratedContent => {
  const demoContents = {
    twitter: [
      `🚀 ${formData.topic} is revolutionizing the way we think about innovation! The future is here and it's more exciting than ever. What's your take on this game-changing trend? #Innovation #Future #Tech`,
      `Breaking: ${formData.topic} just hit a new milestone! 📈 This is exactly what we've been waiting for. The implications are huge for everyone in the industry. Thoughts? 🤔`,
      `Hot take: ${formData.topic} isn't just a trend - it's the foundation of what's coming next. We're witnessing history in the making. Who else is as excited as I am? 🔥`
    ],
    linkedin: [
      `The rise of ${formData.topic} represents a fundamental shift in how we approach modern challenges. As professionals, we need to understand not just what this means today, but how it will reshape our industries tomorrow.\n\nKey insights:\n• Innovation drives transformation\n• Early adoption creates competitive advantage\n• Collaboration accelerates progress\n\nWhat strategies is your organization implementing to stay ahead of this curve? I'd love to hear your thoughts and experiences.\n\n#Innovation #Leadership #FutureOfWork`,
      `${formData.topic} is more than just a buzzword - it's a catalyst for meaningful change across industries. Having worked in this space for several years, I've seen firsthand how transformative this can be.\n\nThe most successful companies I've observed share three common traits:\n1. They embrace change proactively\n2. They invest in their people's growth\n3. They maintain a long-term vision\n\nHow is your team preparing for this evolution?`,
    ],
    instagram: [
      `✨ ${formData.topic} vibes are everything right now! ✨\n\nSwipe to see why this trend is taking over 👉\n\nThis is literally changing the game and I'm here for it! Who else is obsessed? Drop a 🔥 if you're feeling this energy!\n\n#${formData.topic.replace(/\s+/g, '')} #Trending #Vibes #Aesthetic #Mood #Inspo #Goals #Love #Amazing #Perfect`,
      `POV: You discover ${formData.topic} and your whole perspective shifts 🤯\n\nThis is the content we didn't know we needed! Save this post for later because you'll want to come back to it ✨\n\nTag someone who needs to see this! 👇\n\n#Mindblown #GameChanger #MustSee #Viral #Trending #Share #Tag #Save #Love`,
    ],
    facebook: [
      `Friends, I had to share this with you all! ${formData.topic} has been on my mind lately, and I think it's something we should all be paying attention to.\n\nI've been researching this topic extensively, and the potential impact on our daily lives is remarkable. From what I've learned, this could change how we approach many aspects of our personal and professional lives.\n\nWhat do you think? Have you heard about this trend? I'd love to start a conversation about it in the comments below. Share your thoughts and let's discuss!\n\nFeel free to share this post if you think your friends would find it interesting too.`,
    ],
    tiktok: [
      `POV: You just discovered ${formData.topic} 🤯\n\nThis is about to blow your mind! Like if you had no idea this was even possible\n\nComment "MIND BLOWN" if this shocked you too!\n\n#${formData.topic.replace(/\s+/g, '')} #Viral #MindBlown #Trending #FYP #ForYou #Shocking #Amazing #DidYouKnow #Facts`,
    ]
  };

  const platformContent = demoContents[formData.platform as keyof typeof demoContents] || demoContents.twitter;
  const randomContent = platformContent[Math.floor(Math.random() * platformContent.length)];

  const viralScore = Math.floor(Math.random() * 30) + 70; // 70-100 range
  const expectedReach = Math.floor(Math.random() * 50000) + 10000; // 10k-60k range

  return {
    content: randomContent,
    viralScore,
    hashtags: [`#${formData.topic.replace(/\s+/g, '')}`, '#Trending', '#Viral', '#Innovation'],
    platform: formData.platform,
    recommendations: {
      bestPostTime: '14:00-16:00 UTC',
      expectedReach,
      engagementPrediction: {
        likes: Math.floor(expectedReach * 0.05),
        retweets: Math.floor(expectedReach * 0.01),
        comments: Math.floor(expectedReach * 0.008)
      }
    }
  };
};

const ContentGenerator: React.FC = () => {
  const { token, user } = useAuth();
  const { 
    subscription, 
    usage, 
    isPremium, 
    canGeneratePost, 
    createCheckoutSession 
  } = useSubscription();
  
  const [activeTab, setActiveTab] = useState<'generate' | 'preview' | 'publish' | 'schedule'>('generate');
  const [formData, setFormData] = useState({
    topic: '',
    platform: 'twitter',
    tone: 'professional',
    includeHashtags: true,
    targetAudience: '',
    locationWoeid: '1',
    mediaOption: 'none' as 'none' | 'image' | 'video'
  });
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>(['twitter', 'linkedin', 'instagram']); // Demo connected platforms
  const [isPublishing, setIsPublishing] = useState(false);
  const [trendNotification, setTrendNotification] = useState<string | null>(null);
  const [showOptimization, setShowOptimization] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [showPricingModal, setShowPricingModal] = useState(false);

  // Check for trend data from sessionStorage on component mount
  useEffect(() => {
    const savedTrendData = sessionStorage.getItem('selectedTrend');
    if (savedTrendData) {
      try {
        const trendData: TrendData = JSON.parse(savedTrendData);
        
        setFormData(prev => ({
          ...prev,
          topic: trendData.topic,
          targetAudience: trendData.demographics.interests.join(', ') || prev.targetAudience,
          locationWoeid: trendData.locationWoeid || '1'
        }));

        setTrendNotification(`Content form pre-filled with trending topic: "${trendData.topic}"`);
        sessionStorage.removeItem('selectedTrend');
        
        setTimeout(() => {
          setTrendNotification(null);
        }, 5000);
        
      } catch (error) {
        console.error('Error parsing trend data:', error);
        sessionStorage.removeItem('selectedTrend');
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleMediaOptionChange = (option: 'none' | 'image' | 'video') => {
    setFormData(prev => ({
      ...prev,
      mediaOption: option
    }));
  };

  const generateMediaContent = async (textContent: string, mediaType: 'image' | 'video') => {
    try {
      if (mediaType === 'image') {
        // For demo, return a placeholder image
        return 'https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop';
      } else if (mediaType === 'video') {
        // For demo, return a placeholder video
        return 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4';
      }
    } catch (error) {
      console.error(`Error generating ${mediaType}:`, error);
      return null;
    }
  };

  const generateContent = async () => {
    if (!formData.topic.trim()) return;

    // Check usage limits
    if (!canGeneratePost()) {
      setShowPricingModal(true);
      return;
    }

    setLoading(true);
    try {
      let content: GeneratedContent;

      if (USE_LOCAL_MEMORY) {
        // Generate demo content
        console.log('🔄 [CONTENT] Generating demo content');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay
        content = generateDemoContent(formData);
      } else {
        // Original API call (kept intact)
        const response = await fetch('/api/content/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            ...formData,
            locationWoeid: formData.locationWoeid
          })
        });

        if (response.ok) {
          content = await response.json();
        } else {
          throw new Error('Failed to generate content');
        }
      }
      
      // Step 2: Generate media if requested
      let mediaUrl = null;
      if (formData.mediaOption !== 'none' && isPremium) {
        mediaUrl = await generateMediaContent(content.content, formData.mediaOption);
      }
      
      setGeneratedContent({
        ...content,
        mediaUrl,
        mediaType: formData.mediaOption !== 'none' ? formData.mediaOption : undefined
      });
      
      setActiveTab('preview');
      setShowOptimization(true);
      setIsEditingContent(false);
      setEditedContent('');
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (generatedContent) {
      try {
        await navigator.clipboard.writeText(generatedContent.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  const savePost = async () => {
    if (!generatedContent) return;

    try {
      if (USE_LOCAL_MEMORY) {
        console.log('🔄 [CONTENT] Demo save post');
        alert('Demo Mode: Post saved successfully! In a real app, this would save to your database.');
        return;
      }

      // Original save logic (kept intact)
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: generatedContent.content,
          platform: generatedContent.platform,
          viralScore: generatedContent.viralScore,
          hashtags: generatedContent.hashtags,
          status: 'draft',
          media_urls: generatedContent.mediaUrl ? [generatedContent.mediaUrl] : []
        })
      });

      if (response.ok) {
        alert('Post saved successfully!');
      }
    } catch (error) {
      console.error('Error saving post:', error);
    }
  };

  const handleEditContent = () => {
    if (generatedContent) {
      setEditedContent(generatedContent.content);
      setIsEditingContent(true);
    }
  };

  const handleSaveEdit = () => {
    if (generatedContent && editedContent.trim()) {
      setGeneratedContent(prev => prev ? {
        ...prev,
        content: editedContent.trim()
      } : null);
      setIsEditingContent(false);
      setEditedContent('');
    }
  };

  const handleCancelEdit = () => {
    setIsEditingContent(false);
    setEditedContent('');
  };

  const handleRegenerateContent = () => {
    setActiveTab('generate');
    setIsEditingContent(false);
    setEditedContent('');
  };

  const handleHashtagSuggestion = async (hashtags: string[]) => {
    if (!generatedContent) return;
    
    const hashtagString = hashtags.join(' ');
    const updatedContent = `${generatedContent.content} ${hashtagString}`;
    
    setGeneratedContent(prev => prev ? {
      ...prev,
      content: updatedContent,
      hashtags: [...prev.hashtags, ...hashtags]
    } : null);
  };

  const handleCTASuggestion = async (cta: string) => {
    if (!generatedContent) return;
    
    const updatedContent = `${generatedContent.content} ${cta}`;
    
    setGeneratedContent(prev => prev ? {
      ...prev,
      content: updatedContent
    } : null);
  };

  const handlePlatformConnect = (platformId: string) => {
    setConnectedPlatforms(prev => [...prev, platformId]);
  };

  const handlePlatformDisconnect = (platformId: string) => {
    setConnectedPlatforms(prev => prev.filter(p => p !== platformId));
  };

  const handlePublish = async (platforms: string[]) => {
    if (!generatedContent) return;

    setIsPublishing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Publishing to platforms:', platforms);
      alert(`Demo Mode: Successfully published to ${platforms.join(', ')}! In a real app, this would publish to your connected social media accounts.`);
      await savePost();
    } catch (error) {
      console.error('Publishing failed:', error);
      alert('Publishing failed. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSchedule = async (platforms: string[], scheduleTime: Date, recurring?: boolean) => {
    if (!generatedContent) return;

    try {
      console.log('Scheduling post:', { platforms, scheduleTime, recurring });
      alert(`Demo Mode: Post scheduled for ${scheduleTime.toLocaleString()}! In a real app, this would be scheduled in your content calendar.`);
      setActiveTab('schedule');
    } catch (error) {
      console.error('Scheduling failed:', error);
      alert('Scheduling failed. Please try again.');
    }
  };

  const handleEditScheduledPost = (postId: string) => {
    console.log('Edit post:', postId);
  };

  const handleDeleteScheduledPost = (postId: string) => {
    console.log('Delete post:', postId);
  };

  const handleTogglePausePost = (postId: string) => {
    console.log('Toggle pause post:', postId);
  };

  const handleUpgrade = async (plan: 'pro') => {
    try {
      await createCheckoutSession(plan);
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert('Upgrade failed. Please try again.');
    }
  };

  const tabs = [
    { id: 'generate', label: 'Generate', icon: Sparkles, shortLabel: 'Gen' },
    { id: 'preview', label: 'Preview', icon: Eye, shortLabel: 'View' },
    { id: 'publish', label: 'Publish', icon: Send, shortLabel: 'Post' },
    { id: 'schedule', label: 'Schedule', icon: Clock, shortLabel: 'Sched' }
  ];

  const displayName = user?.full_name || user?.username || 'Demo User';
  const avatarUrl = user?.avatar_url || 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop';

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Demo Mode Notice */}
      {USE_LOCAL_MEMORY && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                🚀 Demo Mode Active - Full AI Features Available!
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                You're experiencing TrendCraft with demo data. All features are unlocked including premium AI content generation, media creation, and analytics.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Usage Warning for Free Users */}
      {!isPremium && usage && !USE_LOCAL_MEMORY && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <div>
                <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                  Free Plan: {usage.posts_generated}/10 posts used this month
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  Upgrade to Pro for unlimited posts and premium features
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPricingModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      {/* Trend Notification */}
      {trendNotification && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3" />
            <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
              {trendNotification}
            </p>
          </div>
          <button
            onClick={() => setTrendNotification(null)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
          >
            ×
          </button>
        </div>
      )}

      {/* Header with Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-3 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-3 sm:mb-4">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400 mr-2 sm:mr-3" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">AI Content Studio</h1>
          </div>
          
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 min-w-0 ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <tab.icon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden xs:inline sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-3 sm:p-6">
          {activeTab === 'generate' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
              <div className="xl:col-span-2 space-y-4 sm:space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    What's your topic or idea?
                  </label>
                  <textarea
                    name="topic"
                    value={formData.topic}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none text-sm sm:text-base"
                    placeholder="e.g., AI in content creation, sustainable technology, remote work trends..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Platform
                    </label>
                    <select
                      name="platform"
                      value={formData.platform}
                      onChange={handleInputChange}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm sm:text-base"
                    >
                      <option value="twitter">X (Twitter)</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="tiktok">TikTok</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tone
                    </label>
                    <select
                      name="tone"
                      value={formData.tone}
                      onChange={handleInputChange}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm sm:text-base"
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="humorous">Humorous</option>
                      <option value="inspirational">Inspirational</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Audience (optional)
                  </label>
                  <input
                    type="text"
                    name="targetAudience"
                    value={formData.targetAudience}
                    onChange={handleInputChange}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm sm:text-base"
                    placeholder="e.g., entrepreneurs, tech enthusiasts, marketers..."
                  />
                </div>

                {/* Media Generation Options */}
                <MediaGenerationOptions
                  selectedOption={formData.mediaOption}
                  onOptionChange={handleMediaOptionChange}
                  isPremium={isPremium}
                  onUpgradeClick={() => setShowPricingModal(true)}
                />

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="includeHashtags"
                    checked={formData.includeHashtags}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Include relevant hashtags
                  </label>
                </div>

                <button
                  onClick={generateContent}
                  disabled={loading || !formData.topic.trim() || (!USE_LOCAL_MEMORY && !canGeneratePost())}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 sm:py-3 px-4 sm:px-6 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  )}
                  {loading ? 'Generating...' : 'Generate Content'}
                </button>

                {/* Generated Content Preview */}
                {generatedContent && (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Generated Content</h3>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                            <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="font-medium text-xs sm:text-sm">{generatedContent.viralScore}/100</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                        {generatedContent.content}
                      </p>
                      
                      {/* Show generated media */}
                      {generatedContent.mediaUrl && (
                        <div className="mt-4">
                          {generatedContent.mediaType === 'image' ? (
                            <img 
                              src={generatedContent.mediaUrl} 
                              alt="Generated content" 
                              className="w-full max-w-md rounded-lg"
                            />
                          ) : (
                            <video 
                              src={generatedContent.mediaUrl} 
                              controls 
                              className="w-full max-w-md rounded-lg"
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Performance Predictions */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4">
                        <div className="flex items-center text-blue-600 dark:text-blue-400 mb-2">
                          <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                          <span className="text-xs sm:text-sm font-medium">Expected Reach</span>
                        </div>
                        <p className="text-lg sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                          {generatedContent.recommendations.expectedReach.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 sm:p-4">
                        <div className="flex items-center text-green-600 dark:text-green-400 mb-2">
                          <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                          <span className="text-xs sm:text-sm font-medium">Best Time</span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-green-700 dark:text-green-300">
                          {generatedContent.recommendations.bestPostTime}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                      <button
                        onClick={copyToClipboard}
                        className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-3 sm:px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center text-sm sm:text-base"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={generateContent}
                        className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-3 sm:px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center sm:w-auto"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setActiveTab('preview')}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center text-sm sm:text-base"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Platform Optimization Panel */}
              {generatedContent && (
                <div className="xl:col-span-1">
                  <PlatformOptimizationPanel
                    platform={generatedContent.platform}
                    content={generatedContent.content}
                    topic={formData.topic}
                    category="technology"
                    onHashtagSuggestion={handleHashtagSuggestion}
                    onCTASuggestion={handleCTASuggestion}
                  />
                </div>
              )}

              {!generatedContent && (
                <div className="xl:col-span-1">
                  <div className="text-center py-8 sm:py-12">
                    <Sparkles className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Ready to create viral content?
                    </h3>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                      Enter your topic and let our AI generate engaging social media content for you.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'preview' && generatedContent && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
              <div className="xl:col-span-2">
                {/* Editable Content Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Content</h3>
                    <div className="flex items-center space-x-2">
                      {!isEditingContent ? (
                        <>
                          <button
                            onClick={handleEditContent}
                            className="flex items-center px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Content
                          </button>
                          <button
                            onClick={handleRegenerateContent}
                            className="flex items-center px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Regenerate Content
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleSaveEdit}
                            className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex items-center px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditingContent ? (
                    <div className="space-y-3">
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        rows={6}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none text-sm leading-relaxed"
                        placeholder="Edit your content here..."
                      />
                      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <span>Characters: {editedContent.length}</span>
                        <span>Platform: {generatedContent.platform}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                        {generatedContent.content}
                      </p>
                      
                      {/* Show generated media in preview */}
                      {generatedContent.mediaUrl && (
                        <div className="mt-4">
                          {generatedContent.mediaType === 'image' ? (
                            <img 
                              src={generatedContent.mediaUrl} 
                              alt="Generated content" 
                              className="w-full max-w-md rounded-lg"
                            />
                          ) : (
                            <video 
                              src={generatedContent.mediaUrl} 
                              controls 
                              className="w-full max-w-md rounded-lg"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Platform Preview */}
                <PlatformPreview
                  platform={generatedContent.platform}
                  content={generatedContent.content}
                  userProfile={{
                    name: displayName,
                    username: user?.username || 'demo_user',
                    avatar: avatarUrl,
                    verified: true
                  }}
                  engagement={generatedContent.recommendations.engagementPrediction}
                  media={generatedContent.mediaUrl ? [{
                    type: generatedContent.mediaType || 'image',
                    url: generatedContent.mediaUrl
                  }] : undefined}
                />
                
                <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 mt-6">
                  <button
                    onClick={() => setActiveTab('publish')}
                    className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                  >
                    Proceed to Publish
                  </button>
                </div>
              </div>

              <div className="xl:col-span-1">
                <PlatformOptimizationPanel
                  platform={generatedContent.platform}
                  content={generatedContent.content}
                  topic={formData.topic}
                  category="technology"
                  onHashtagSuggestion={handleHashtagSuggestion}
                  onCTASuggestion={handleCTASuggestion}
                />
              </div>
            </div>
          )}

          {activeTab === 'publish' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              <div>
                <PlatformConnections
                  onConnect={handlePlatformConnect}
                  onDisconnect={handlePlatformDisconnect}
                />
              </div>
              <div>
                <PublishingControls
                  connectedPlatforms={connectedPlatforms}
                  onPublish={handlePublish}
                  onSchedule={handleSchedule}
                  isPublishing={isPublishing}
                />
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <ScheduleManager
              onEdit={handleEditScheduledPost}
              onDelete={handleDeleteScheduledPost}
              onTogglePause={handleTogglePausePost}
            />
          )}
        </div>
      </div>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
};

export default ContentGenerator;