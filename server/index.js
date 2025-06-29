import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Verify the JWT token using Supabase's JWT secret
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      console.error('JWT_SECRET or SUPABASE_JWT_SECRET not found');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    req.userId = decoded.sub; // Supabase uses 'sub' for user ID
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'TrendCraft API'
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

// Content generation endpoint
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

    // Generate mock content for now
    const mockContent = {
      content: `🚀 ${topic} is revolutionizing the way we think about ${platform} content! Here's why this matters for ${targetAudience || 'everyone'}: \n\nThe future is here, and it's more exciting than ever. What are your thoughts? ${includeHashtags ? '#Innovation #TechTrends #Future' : ''}`,
      viralScore: Math.floor(Math.random() * 30) + 70, // 70-100
      hashtags: includeHashtags ? ['#Innovation', '#TechTrends', '#Future'] : [],
      platform: platform,
      recommendations: {
        bestPostTime: '14:00-16:00 UTC',
        expectedReach: Math.floor(Math.random() * 5000) + 1000,
        engagementPrediction: {
          likes: Math.floor(Math.random() * 500) + 100,
          retweets: Math.floor(Math.random() * 100) + 20,
          comments: Math.floor(Math.random() * 50) + 10
        }
      },
      trendAnalysis: `This topic is trending due to recent developments in the ${topic} space.`,
      contextData: {
        sources: [],
        location: locationWoeid === '1' ? 'Worldwide' : 'Selected Location'
      }
    };

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

    res.json(mockContent);
  } catch (error) {
    console.error('Content generation error:', error);
    res.status(500).json({ error: 'Failed to generate content' });
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
      weeklyGrowth: '+12.5%', // Mock data
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
    // Return mock performance data for now
    const performanceData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split('T')[0],
        impressions: Math.floor(Math.random() * 1000) + 500,
        engagement: Math.floor(Math.random() * 100) + 50,
        clicks: Math.floor(Math.random() * 50) + 10
      };
    }).reverse();

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
});