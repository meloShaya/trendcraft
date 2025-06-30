import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Middleware
app.use(cors());
app.use(express.json());

// Updated authentication middleware using Supabase auth
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Use Supabase to verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('❌ [AUTH] Token verification failed:', error?.message || 'No user found');
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Set user information in request
    req.user = user;
    req.userId = user.id;
    console.log('✅ [AUTH] Token verified for user:', user.id);
    next();
  } catch (error) {
    console.error('❌ [AUTH] Authentication error:', error.message);
    return res.status(403).json({ error: 'Authentication failed' });
  }
};

// Helper function to generate content with Gemini AI
const generateContentWithGemini = async (topic, platform, tone, targetAudience, locationWoeid) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Get location name for context
    const locationMap = {
      '1': 'Worldwide',
      '23424977': 'United States',
      '23424975': 'United Kingdom',
      '23424775': 'Canada',
      '23424748': 'Australia',
      '23424829': 'Germany',
      '23424819': 'France',
      '23424856': 'Japan',
      '23424768': 'Brazil',
      '23424848': 'India'
    };
    const locationName = locationMap[locationWoeid] || 'Worldwide';

    // Platform-specific character limits and guidelines
    const platformGuidelines = {
      twitter: {
        maxChars: 280,
        style: 'concise, engaging, use emojis sparingly, include relevant hashtags',
        format: 'Tweet format with strong hook in first line'
      },
      linkedin: {
        maxChars: 3000,
        style: 'professional, insightful, value-driven, industry-focused',
        format: 'Professional post with clear value proposition'
      },
      instagram: {
        maxChars: 2200,
        style: 'visual-first, engaging, lifestyle-oriented, hashtag-heavy',
        format: 'Caption that complements visual content'
      },
      facebook: {
        maxChars: 63206,
        style: 'conversational, community-focused, shareable',
        format: 'Engaging post that encourages interaction'
      },
      tiktok: {
        maxChars: 2200,
        style: 'trendy, entertaining, youth-oriented, viral potential',
        format: 'Video description that hooks viewers'
      }
    };

    const guidelines = platformGuidelines[platform] || platformGuidelines.twitter;

    const prompt = `You are an expert social media content creator specializing in viral content. Create a ${platform} post about "${topic}" with the following requirements:

PLATFORM: ${platform.toUpperCase()}
TONE: ${tone}
TARGET AUDIENCE: ${targetAudience || 'general audience'}
LOCATION CONTEXT: ${locationName}
CHARACTER LIMIT: ${guidelines.maxChars}
STYLE: ${guidelines.style}
FORMAT: ${guidelines.format}

REQUIREMENTS:
1. Create engaging, viral-worthy content that fits ${platform}'s style
2. Stay within ${guidelines.maxChars} characters
3. Use ${tone} tone throughout
4. Make it relevant to ${locationName} audience when appropriate
5. Include 2-3 relevant hashtags naturally integrated
6. Start with a strong hook to grab attention
7. End with a call-to-action that encourages engagement
8. Make it shareable and conversation-starting

CONTENT TOPIC: ${topic}

Generate ONLY the post content, no explanations or additional text. Make it authentic, engaging, and optimized for ${platform}.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedContent = response.text().trim();

    // Calculate viral score based on content characteristics
    const viralScore = calculateViralScore(generatedContent, platform, topic);

    // Extract hashtags from the generated content
    const hashtagRegex = /#[\w]+/g;
    const hashtags = generatedContent.match(hashtagRegex) || [];

    // Generate engagement predictions based on viral score and platform
    const engagementPrediction = generateEngagementPrediction(viralScore, platform);

    return {
      content: generatedContent,
      viralScore,
      hashtags,
      platform,
      recommendations: {
        bestPostTime: getBestPostTime(platform, locationWoeid),
        expectedReach: Math.floor(viralScore * 100 + Math.random() * 1000),
        engagementPrediction
      },
      trendAnalysis: `AI analysis suggests this ${topic} content has high viral potential due to current trends and audience interest.`,
      contextData: {
        sources: [`Generated for ${locationName} audience`],
        location: locationName,
        aiModel: 'Gemini 2.0 Flash'
      }
    };
  } catch (error) {
    console.error('Gemini AI generation error:', error);
    throw new Error('Failed to generate content with AI');
  }
};

// Helper function to calculate viral score
const calculateViralScore = (content, platform, topic) => {
  let score = 50; // Base score

  // Length optimization
  const platformOptimalLengths = {
    twitter: { min: 71, max: 100 },
    linkedin: { min: 150, max: 300 },
    instagram: { min: 138, max: 150 },
    facebook: { min: 100, max: 250 },
    tiktok: { min: 100, max: 150 }
  };

  const optimal = platformOptimalLengths[platform] || platformOptimalLengths.twitter;
  if (content.length >= optimal.min && content.length <= optimal.max) {
    score += 10;
  }

  // Engagement indicators
  if (content.includes('?')) score += 5; // Questions drive engagement
  if (content.match(/[!]{1,2}/g)) score += 3; // Excitement
  if (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu)) score += 5; // Emojis
  if (content.includes('#')) score += 5; // Hashtags
  
  // Trending keywords boost
  const trendingKeywords = ['AI', 'trending', 'viral', 'breaking', 'exclusive', 'secret', 'hack', 'tip'];
  const foundKeywords = trendingKeywords.filter(keyword => 
    content.toLowerCase().includes(keyword.toLowerCase())
  );
  score += foundKeywords.length * 3;

  // Platform-specific bonuses
  if (platform === 'twitter' && content.length <= 280) score += 5;
  if (platform === 'linkedin' && content.includes('insight')) score += 5;
  if (platform === 'instagram' && content.match(/#[\w]+/g)?.length >= 3) score += 5;

  return Math.min(Math.max(score, 30), 100); // Clamp between 30-100
};

// Helper function to generate engagement predictions
const generateEngagementPrediction = (viralScore, platform) => {
  const baseMultiplier = viralScore / 100;
  
  const platformMultipliers = {
    twitter: { likes: 50, retweets: 10, comments: 5 },
    linkedin: { likes: 30, retweets: 5, comments: 8 },
    instagram: { likes: 100, retweets: 15, comments: 10 },
    facebook: { likes: 40, retweets: 8, comments: 12 },
    tiktok: { likes: 200, retweets: 50, comments: 25 }
  };

  const multipliers = platformMultipliers[platform] || platformMultipliers.twitter;
  
  return {
    likes: Math.floor(multipliers.likes * baseMultiplier * (0.8 + Math.random() * 0.4)),
    retweets: Math.floor(multipliers.retweets * baseMultiplier * (0.8 + Math.random() * 0.4)),
    comments: Math.floor(multipliers.comments * baseMultiplier * (0.8 + Math.random() * 0.4))
  };
};

// Helper function to get optimal posting time by location
const getBestPostTime = (platform, locationWoeid) => {
  const timeZones = {
    '1': '14:00-16:00 UTC', // Worldwide
    '23424977': '12:00-15:00 EST', // United States
    '23424975': '12:00-14:00 GMT', // United Kingdom
    '23424775': '11:00-13:00 EST', // Canada
    '23424748': '19:00-21:00 AEST', // Australia
    '23424829': '13:00-15:00 CET', // Germany
    '23424819': '13:00-15:00 CET', // France
    '23424856': '20:00-22:00 JST', // Japan
    '23424768': '18:00-20:00 BRT', // Brazil
    '23424848': '19:00-21:00 IST'  // India
  };

  return timeZones[locationWoeid] || '14:00-16:00 UTC';
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'TrendCraft API',
    ai_status: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
  });
});

// Get user subscription
app.get('/api/subscription', authenticateToken, async (req, res) => {
  try {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching subscription:', error);
      return res.status(500).json({ error: 'Failed to fetch subscription' });
    }

    // If no subscription found, return default free plan
    if (!subscription) {
      const defaultSubscription = {
        id: 'free',
        user_id: req.userId,
        plan: 'free',
        status: 'active',
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return res.json(defaultSubscription);
    }

    res.json(subscription);
  } catch (error) {
    console.error('Subscription endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user usage tracking
app.get('/api/usage', authenticateToken, async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    const { data: usage, error } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', req.userId)
      .eq('month', currentMonth + '-01') // First day of current month
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching usage:', error);
      return res.status(500).json({ error: 'Failed to fetch usage' });
    }

    // If no usage found, return default zero usage
    if (!usage) {
      const defaultUsage = {
        id: 'default',
        user_id: req.userId,
        posts_generated: 0,
        images_generated: 0,
        videos_generated: 0,
        month: currentMonth,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return res.json(defaultUsage);
    }

    res.json(usage);
  } catch (error) {
    console.error('Usage endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Stripe checkout session (placeholder)
app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;
    
    // TODO: Implement actual Stripe integration
    // For now, return a placeholder response
    res.json({
      message: 'Stripe integration coming soon',
      plan: plan,
      user_id: req.userId
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Open billing portal (placeholder)
app.post('/api/billing-portal', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement actual Stripe billing portal
    // For now, return a placeholder response
    res.json({
      message: 'Billing portal coming soon',
      user_id: req.userId
    });
  } catch (error) {
    console.error('Billing portal error:', error);
    res.status(500).json({ error: 'Failed to open billing portal' });
  }
});

// Content generation endpoint with real Gemini AI
app.post('/api/content/generate', authenticateToken, async (req, res) => {
  try {
    const { topic, platform, tone, includeHashtags, targetAudience, locationWoeid } = req.body;

    if (!topic || !platform) {
      return res.status(400).json({ error: 'Topic and platform are required' });
    }

    // Check user's usage limits
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', req.userId)
      .eq('month', currentMonth + '-01')
      .single();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    const isPremium = subscription?.plan === 'pro' && subscription?.status === 'active';
    const postsGenerated = usage?.posts_generated || 0;

    // Check limits for free users
    if (!isPremium && postsGenerated >= 10) {
      return res.status(403).json({ 
        error: 'Monthly limit reached. Upgrade to Pro for unlimited posts.',
        limit_reached: true
      });
    }

    console.log(`🤖 Generating content with Gemini AI for topic: "${topic}" on ${platform}`);

    // Generate content using Gemini AI
    const generatedContent = await generateContentWithGemini(
      topic, 
      platform, 
      tone || 'professional', 
      targetAudience, 
      locationWoeid || '1'
    );

    console.log(`✅ Content generated successfully with viral score: ${generatedContent.viralScore}`);

    // Update usage tracking
    if (usage) {
      await supabase
        .from('usage_tracking')
        .update({ 
          posts_generated: postsGenerated + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', req.userId)
        .eq('month', currentMonth + '-01');
    } else {
      await supabase
        .from('usage_tracking')
        .insert({
          user_id: req.userId,
          posts_generated: 1,
          images_generated: 0,
          videos_generated: 0,
          month: currentMonth + '-01'
        });
    }

    res.json(generatedContent);
  } catch (error) {
    console.error('Content generation error:', error);
    
    // Provide specific error messages for different failure types
    if (error.message.includes('API key')) {
      return res.status(500).json({ error: 'AI service configuration error. Please try again later.' });
    } else if (error.message.includes('quota')) {
      return res.status(429).json({ error: 'AI service quota exceeded. Please try again later.' });
    } else {
      return res.status(500).json({ error: 'Failed to generate content. Please try again.' });
    }
  }
});

// Trends endpoint
app.get('/api/trends', authenticateToken, async (req, res) => {
  try {
    const { platform = 'twitter', limit = 20, location = '1' } = req.query;

    const { data: trends, error } = await supabase
      .from('trends')
      .select('*')
      .eq('platform', platform)
      .eq('location_woeid', location)
      .gt('expires_at', new Date().toISOString())
      .order('trend_score', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error('Error fetching trends:', error);
      return res.status(500).json({ error: 'Failed to fetch trends' });
    }

    // Transform the data to match the expected format
    const transformedTrends = (trends || []).map((trend, index) => ({
      id: index + 1,
      keyword: trend.keyword,
      category: trend.category || 'General',
      trendScore: trend.trend_score || 50,
      volume: trend.volume || 0,
      growth: trend.growth_percentage || '+0%',
      platforms: [platform],
      relatedHashtags: trend.related_hashtags || [],
      peakTime: trend.peak_time || '14:00-16:00 UTC',
      demographics: trend.demographics || { age: '18-34', interests: [] }
    }));

    res.json(transformedTrends);
  } catch (error) {
    console.error('Trends endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Trends locations endpoint
app.get('/api/trends/locations', authenticateToken, async (req, res) => {
  try {
    // Return static list of supported locations
    const locations = [
      { name: "Worldwide", woeid: 1 },
      { name: "United States", woeid: 23424977 },
      { name: "United Kingdom", woeid: 23424975 },
      { name: "Canada", woeid: 23424775 },
      { name: "Australia", woeid: 23424748 },
      { name: "Germany", woeid: 23424829 },
      { name: "France", woeid: 23424819 },
      { name: "Japan", woeid: 23424856 },
      { name: "Brazil", woeid: 23424768 },
      { name: "India", woeid: 23424848 }
    ];

    res.json(locations);
  } catch (error) {
    console.error('Trends locations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Posts endpoints
app.get('/api/posts', authenticateToken, async (req, res) => {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return res.status(500).json({ error: 'Failed to fetch posts' });
    }

    res.json(posts || []);
  } catch (error) {
    console.error('Posts endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    const postData = {
      ...req.body,
      user_id: req.userId
    };

    const { data: post, error } = await supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return res.status(500).json({ error: 'Failed to create post' });
    }

    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId); // Ensure user can only delete their own posts

    if (error) {
      console.error('Error deleting post:', error);
      return res.status(500).json({ error: 'Failed to delete post' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics endpoints
app.get('/api/analytics/overview', authenticateToken, async (req, res) => {
  try {
    // Get user's posts
    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', req.userId);

    // Get analytics data
    const { data: analytics } = await supabase
      .from('post_analytics')
      .select('*')
      .in('post_id', (posts || []).map(p => p.id));

    const totalPosts = posts?.length || 0;
    const totalEngagement = analytics?.reduce((sum, a) => sum + (a.likes_count || 0) + (a.comments_count || 0) + (a.shares_count || 0), 0) || 0;
    const totalImpressions = analytics?.reduce((sum, a) => sum + (a.impressions || 0), 0) || 0;
    const avgViralScore = posts?.length ? posts.reduce((sum, p) => sum + (p.viral_score || 0), 0) / posts.length : 0;

    const overview = {
      totalPosts,
      totalEngagement,
      totalImpressions,
      avgViralScore: Math.round(avgViralScore),
      weeklyGrowth: '+12.5%', // This could be calculated from actual data
      topPerformingPost: posts?.[0] || null
    };

    res.json(overview);
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/analytics/performance', authenticateToken, async (req, res) => {
  try {
    // Get actual performance data from post_analytics table
    const { data: posts } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', req.userId);

    if (!posts || posts.length === 0) {
      return res.json([]);
    }

    const { data: analytics } = await supabase
      .from('post_analytics')
      .select('*')
      .in('post_id', posts.map(p => p.id))
      .order('collection_date', { ascending: true });

    // Group analytics by date and sum up metrics
    const performanceMap = new Map();
    
    (analytics || []).forEach(analytic => {
      const date = analytic.collection_date;
      if (!performanceMap.has(date)) {
        performanceMap.set(date, {
          date,
          impressions: 0,
          engagement: 0,
          clicks: 0
        });
      }
      
      const existing = performanceMap.get(date);
      existing.impressions += analytic.impressions || 0;
      existing.engagement += (analytic.likes_count || 0) + (analytic.comments_count || 0) + (analytic.shares_count || 0);
      existing.clicks += analytic.click_through_rate ? Math.floor(analytic.impressions * analytic.click_through_rate / 100) : 0;
    });

    const performanceData = Array.from(performanceMap.values());
    res.json(performanceData);
  } catch (error) {
    console.error('Analytics performance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User profile endpoints
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    res.json(user);
  } catch (error) {
    console.error('User profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, bio, avatar_url } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .update({ full_name, bio, avatar_url, updated_at: new Date().toISOString() })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User streak endpoints
app.get('/api/user/streak', authenticateToken, async (req, res) => {
  try {
    const { data: streaks, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', req.userId)
      .order('date', { ascending: false })
      .limit(90); // Last 90 days

    if (error) {
      console.error('Error fetching streaks:', error);
      return res.status(500).json({ error: 'Failed to fetch streaks' });
    }

    // Calculate current and longest streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date().toISOString().split('T')[0];
    const sortedStreaks = (streaks || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    for (const streak of sortedStreaks) {
      if (streak.posted) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
        
        // Calculate current streak (consecutive days from today)
        if (currentStreak === 0 || streak.date === today) {
          currentStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }

    const lastPostDate = sortedStreaks.find(s => s.posted)?.date || null;

    const streakData = {
      currentStreak,
      longestStreak,
      lastPostDate,
      streakData: streaks || []
    };

    res.json(streakData);
  } catch (error) {
    console.error('User streak error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/user/streak/update', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Upsert today's streak
    const { data: streak, error } = await supabase
      .from('user_streaks')
      .upsert({
        user_id: req.userId,
        date: today,
        posted: true,
        post_count: 1
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating streak:', error);
      return res.status(500).json({ error: 'Failed to update streak' });
    }

    res.json({ success: true, streak });
  } catch (error) {
    console.error('Update streak error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 TrendCraft API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing API Key'}`);
  console.log(`🔐 Auth: Using Supabase built-in authentication`);
});