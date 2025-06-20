// server/index.cjs

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables first
dotenv.config();

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🔧 Starting TrendCraft API server...');
console.log('📁 Current working directory:', process.cwd());

// Check environment variables
console.log('🔍 Environment variables check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- PORT:', process.env.PORT || 'not set (will use 3001)');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'set' : 'not set (will use default)');
console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'set' : 'not set');
console.log('- APIFY_API_TOKEN:', process.env.APIFY_API_TOKEN ? 'set' : 'not set');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'trendcraft-secret-key';

// Initialize Google Gemini AI
let genAI = null;
let model = null;

try {
  if (process.env.GEMINI_API_KEY) {
    console.log('🤖 Initializing Google Gemini AI...');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    console.log('✅ Google Gemini AI initialized successfully');
  } else {
    console.log('⚠️  GEMINI_API_KEY not found, AI features will use fallback');
  }
} catch (error) {
  console.error('❌ Error initializing Google Gemini AI:', error);
}

// Initialize Apify Client (optional since we have fallback data)
let apifyClient = null;

try {
  if (process.env.APIFY_API_TOKEN) {
    console.log('🕷️  Initializing Apify client...');
    // For now, we'll skip Apify initialization to avoid the dependency issue
    // and use mock data instead
    console.log('⚠️  Apify temporarily disabled, using mock data');
  } else {
    console.log('⚠️  APIFY_API_TOKEN not found, will use mock data');
  }
} catch (error) {
  console.error('❌ Error initializing Apify client:', error);
}

// Middleware
console.log('🔧 Setting up middleware...');
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Root route for backend
app.get('/', (req, res) => {
  res.json({
    message: 'TrendCraft API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      trends: '/api/trends',
      content: '/api/content/*',
      posts: '/api/posts',
      analytics: '/api/analytics/*',
      user: '/api/user/*'
    }
  });
});

// Mock Data Store (In production, use a real database)
let users = [
  {
    id: 1,
    username: 'demo',
    email: 'demo@trendcraft.ai',
    password: bcrypt.hashSync('demo123', 10),
    profile: {
      name: 'Demo User',
      bio: 'Content creator exploring AI-powered social media',
      avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop'
    },
    createdAt: new Date('2024-01-01')
  }
];

let posts = [
  {
    id: 1,
    userId: 1,
    content: "🚀 Just discovered the future of content creation with AI! The possibilities are endless when you combine creativity with technology. What's your take on AI-powered social media? #AI #ContentCreation #TechTrends",
    platform: 'twitter',
    viralScore: 87,
    engagement: {
      likes: 342,
      retweets: 89,
      comments: 23,
      shares: 45
    },
    hashtags: ['#AI', '#ContentCreation', '#TechTrends'],
    status: 'published',
    scheduledFor: new Date(),
    createdAt: new Date('2024-01-15'),
    performance: {
      impressions: 12500,
      reach: 8900,
      clickThrough: 156
    }
  },
  {
    id: 2,
    userId: 1,
    content: "💡 Hot take: The best social media strategy isn't about posting more—it's about posting smarter. Data-driven content creation is the game changer we've been waiting for! #SocialMediaStrategy #DataDriven #MarketingTips",
    platform: 'twitter',
    viralScore: 92,
    engagement: {
      likes: 567,
      retweets: 143,
      comments: 67,
      shares: 89
    },
    hashtags: ['#SocialMediaStrategy', '#DataDriven', '#MarketingTips'],
    status: 'published',
    scheduledFor: new Date(Date.now() - 86400000),
    createdAt: new Date('2024-01-14'),
    performance: {
      impressions: 18300,
      reach: 14200,
      clickThrough: 234
    }
  }
];

// Helper function to transform Apify trend data
const transformTrendData = (apifyData, platform = 'twitter') => {
  if (!apifyData || !Array.isArray(apifyData)) {
    console.log('Invalid Apify data received:', apifyData);
    return [];
  }

  return apifyData.map((item, index) => {
    const keyword = item.trend || item.hashtag || item.topic || item.name || `Trend ${index + 1}`;
    const volume = item.volume || item.posts || item.mentions || Math.floor(Math.random() * 100000) + 10000;
    const growth = item.growth || item.change || `+${Math.floor(Math.random() * 50) + 5}%`;

    return {
      id: index + 1,
      keyword: keyword.replace('#', ''),
      category: item.category || 'General',
      trendScore: item.score || Math.floor(Math.random() * 30) + 70,
      volume: typeof volume === 'number' ? volume : parseInt(volume) || Math.floor(Math.random() * 100000) + 10000,
      growth: growth,
      platforms: [platform],
      relatedHashtags: item.hashtags || [`#${keyword.replace('#', '')}`, '#trending', '#viral'],
      peakTime: item.peakTime || '14:00-16:00 UTC',
      demographics: {
        age: item.demographics?.age || '25-34',
        interests: item.demographics?.interests || ['Technology', 'Social Media', 'Trends']
      }
    };
  });
};

// Helper function to fetch trends (using mock data for now)
const fetchTrendsFromApify = async (platform = 'twitter') => {
  try {
    console.log(`Fetching trends for platform: ${platform}`);

    // Return mock data since Apify is causing issues
    const mockTrends = [
      {
        id: 1,
        keyword: 'AI Revolution',
        category: 'Technology',
        trendScore: 94,
        volume: 125000,
        growth: '+23%',
        platforms: [platform],
        relatedHashtags: ['#AI', '#ArtificialIntelligence', '#TechTrends', '#Innovation'],
        peakTime: '14:00-16:00 UTC',
        demographics: { age: '25-34', interests: ['Technology', 'Innovation', 'Startups'] }
      },
      {
        id: 2,
        keyword: 'Sustainable Tech',
        category: 'Environment',
        trendScore: 78,
        volume: 87000,
        growth: '+15%',
        platforms: [platform],
        relatedHashtags: ['#GreenTech', '#Sustainability', '#CleanEnergy'],
        peakTime: '12:00-14:00 UTC',
        demographics: { age: '28-45', interests: ['Environment', 'Technology', 'Sustainability'] }
      },
      {
        id: 3,
        keyword: 'Remote Work',
        category: 'Business',
        trendScore: 85,
        volume: 95000,
        growth: '+18%',
        platforms: [platform],
        relatedHashtags: ['#RemoteWork', '#DigitalNomad', '#WorkFromHome'],
        peakTime: '09:00-11:00 UTC',
        demographics: { age: '25-40', interests: ['Business', 'Technology', 'Lifestyle'] }
      }
    ];

    console.log(`Returning ${mockTrends.length} mock trends`);
    return mockTrends;
  } catch (error) {
    console.error('Error in fetchTrendsFromApify:', error);
    return [];
  }
};

// Helper function to generate content with Gemini AI
const generateContentWithAI = async (topic, platform, tone, targetAudience, includeHashtags) => {
  try {
    if (!model) {
      throw new Error('Gemini AI not initialized');
    }

    const prompt = `
You are an expert social media content creator. Generate engaging ${platform} content based on the following requirements:

Topic: ${topic}
Platform: ${platform}
Tone: ${tone}
Target Audience: ${targetAudience || 'general audience'}
Include Hashtags: ${includeHashtags ? 'Yes' : 'No'}

Requirements:
- Create content that is likely to go viral on ${platform}
- Use a ${tone} tone throughout
- Make it engaging and shareable
- Keep it appropriate for the platform's character limits and style
- If hashtags are requested, include 3-5 relevant hashtags
- Focus on ${targetAudience || 'general audience'}

Generate only the content text, nothing else.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    // Calculate a viral score based on content characteristics
    const viralScore = calculateViralScore(content, platform);

    // Extract hashtags if they exist in the content
    const hashtagRegex = /#[\w]+/g;
    const hashtags = content.match(hashtagRegex) || [];

    return {
      content: content.trim(),
      viralScore,
      hashtags,
      platform,
      recommendations: {
        bestPostTime: getBestPostTime(platform),
        expectedReach: Math.floor(Math.random() * 5000) + 1000,
        engagementPrediction: {
          likes: Math.floor(viralScore * 5.2),
          retweets: Math.floor(viralScore * 1.8),
          comments: Math.floor(viralScore * 0.9)
        }
      }
    };
  } catch (error) {
    console.error('Error generating content with Gemini AI:', error);

    // Fallback to mock generation
    const toneTemplates = {
      professional: [
        `Exploring the future of ${topic}. Key insights and implications for ${targetAudience || 'professionals'}.`,
        `${topic} is transforming industries. Here's what ${targetAudience || 'leaders'} need to know.`,
        `Breaking down ${topic}: Strategic considerations for ${targetAudience || 'decision makers'}.`
      ],
      casual: [
        `Just discovered something cool about ${topic}! 🤔 What do you think?`,
        `${topic} is everywhere these days! Anyone else fascinated by this?`,
        `Hot take on ${topic}: It's changing everything and I'm here for it! 🔥`
      ],
      humorous: [
        `${topic} be like: "I'm about to change your whole career" 😅`,
        `Me trying to explain ${topic} to my friends: *gestures wildly* ✨`,
        `${topic} really said "hold my beer" to traditional methods 🍺`
      ]
    };

    const templates = toneTemplates[tone] || toneTemplates.professional;
    const content = templates[Math.floor(Math.random() * templates.length)];

    const hashtagPool = [
      `#${topic.replace(/\s+/g, '')}`,
      '#Innovation',
      '#TechTrends',
      '#DigitalTransformation',
      '#FutureReady',
      '#GameChanger',
      '#TrendingNow'
    ];

    const selectedHashtags = includeHashtags
      ? hashtagPool.slice(0, Math.floor(Math.random() * 4) + 2)
      : [];

    const finalContent = includeHashtags
      ? `${content} ${selectedHashtags.join(' ')}`
      : content;

    const viralScore = Math.floor(Math.random() * 30) + 70;

    return {
      content: finalContent,
      viralScore,
      hashtags: selectedHashtags,
      platform,
      recommendations: {
        bestPostTime: getBestPostTime(platform),
        expectedReach: Math.floor(Math.random() * 5000) + 1000,
        engagementPrediction: {
          likes: Math.floor(viralScore * 5.2),
          retweets: Math.floor(viralScore * 1.8),
          comments: Math.floor(viralScore * 0.9)
        }
      }
    };
  }
};

// Helper function to calculate viral score
const calculateViralScore = (content, platform) => {
  let score = 50; // Base score

  // Length optimization
  if (platform === 'twitter' && content.length <= 280) score += 10;
  if (platform === 'instagram' && content.length <= 2200) score += 10;
  if (platform === 'linkedin' && content.length <= 3000) score += 10;

  // Engagement indicators
  if (content.includes('?')) score += 5; // Questions increase engagement
  if (content.match(/[!]{1,3}/g)) score += 5; // Exclamation points
  if (content.match(/[🔥💡🚀✨⭐]/g)) score += 10; // Popular emojis
  if (content.includes('#')) score += 8; // Hashtags
  if (content.match(/\b(tips?|secrets?|hacks?|tricks?)\b/gi)) score += 12; // Value words
  if (content.match(/\b(new|breaking|exclusive|first)\b/gi)) score += 8; // Urgency words

  // Cap the score at 100
  return Math.min(score, 100);
};

// Helper function to get best posting time by platform
const getBestPostTime = (platform) => {
  const times = {
    twitter: '14:00-16:00 UTC',
    instagram: '11:00-13:00 UTC',
    linkedin: '08:00-10:00 UTC',
    facebook: '13:00-15:00 UTC',
    tiktok: '18:00-20:00 UTC'
  };
  return times[platform] || '14:00-16:00 UTC';
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'TrendCraft API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });

    const user = users.find(u => u.email === email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const newUser = {
      id: users.length + 1,
      username,
      email,
      password: bcrypt.hashSync(password, 10),
      profile: {
        name: username,
        bio: '',
        avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop'
      },
      createdAt: new Date()
    };

    users.push(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        profile: newUser.profile
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Trends Routes
app.get('/api/trends', authenticateToken, async (req, res) => {
  try {
    const { category, limit = 10, platform = 'twitter' } = req.query;

    console.log(`Fetching trends - Platform: ${platform}, Category: ${category}, Limit: ${limit}`);

    // Fetch trends (using mock data for now)
    let trends = await fetchTrendsFromApify(platform);

    // Filter by category if specified
    if (category && category !== 'all') {
      trends = trends.filter(t =>
        t.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Limit results
    const limitedTrends = trends.slice(0, parseInt(limit));

    console.log(`Returning ${limitedTrends.length} trends`);
    res.json(limitedTrends);
  } catch (error) {
    console.error('Error in /api/trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

app.get('/api/trends/:id', authenticateToken, async (req, res) => {
  try {
    const trends = await fetchTrendsFromApify();
    const trend = trends.find(t => t.id === parseInt(req.params.id));

    if (!trend) {
      return res.status(404).json({ error: 'Trend not found' });
    }

    res.json(trend);
  } catch (error) {
    console.error('Error fetching specific trend:', error);
    res.status(500).json({ error: 'Failed to fetch trend' });
  }
});

// Content Generation Routes
app.post('/api/content/generate', authenticateToken, async (req, res) => {
  try {
    const { topic, platform, tone, includeHashtags, targetAudience } = req.body;

    console.log('Generating content:', { topic, platform, tone, targetAudience });

    const generatedContent = await generateContentWithAI(
      topic,
      platform,
      tone,
      targetAudience,
      includeHashtags
    );

    console.log('Content generated successfully');
    res.json(generatedContent);
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

// Posts Routes
app.get('/api/posts', authenticateToken, (req, res) => {
  const userPosts = posts.filter(p => p.userId === req.user.id);
  res.json(userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/posts', authenticateToken, (req, res) => {
  const newPost = {
    id: posts.length + 1,
    userId: req.user.id,
    ...req.body,
    createdAt: new Date(),
    engagement: {
      likes: 0,
      retweets: 0,
      comments: 0,
      shares: 0
    },
    performance: {
      impressions: 0,
      reach: 0,
      clickThrough: 0
    }
  };

  posts.push(newPost);
  res.status(201).json(newPost);
});

app.put('/api/posts/:id', authenticateToken, (req, res) => {
  const postIndex = posts.findIndex(p => p.id === parseInt(req.params.id) && p.userId === req.user.id);
  if (postIndex === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }

  posts[postIndex] = { ...posts[postIndex], ...req.body };
  res.json(posts[postIndex]);
});

app.delete('/api/posts/:id', authenticateToken, (req, res) => {
  const postIndex = posts.findIndex(p => p.id === parseInt(req.params.id) && p.userId === req.user.id);
  if (postIndex === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }

  posts.splice(postIndex, 1);
  res.status(204).send();
});

// Analytics Routes
app.get('/api/analytics/overview', authenticateToken, (req, res) => {
  const userPosts = posts.filter(p => p.userId === req.user.id);

  const totalEngagement = userPosts.reduce((sum, post) =>
    sum + post.engagement.likes + post.engagement.retweets + post.engagement.comments, 0
  );

  const totalImpressions = userPosts.reduce((sum, post) =>
    sum + (post.performance?.impressions || 0), 0
  );

  const avgViralScore = userPosts.length > 0
    ? userPosts.reduce((sum, post) => sum + post.viralScore, 0) / userPosts.length
    : 0;

  res.json({
    totalPosts: userPosts.length,
    totalEngagement,
    totalImpressions,
    avgViralScore: Math.round(avgViralScore),
    weeklyGrowth: '+12.5%',
    topPerformingPost: userPosts.sort((a, b) => b.viralScore - a.viralScore)[0] || null
  });
});

app.get('/api/analytics/performance', authenticateToken, (req, res) => {
  // Mock performance data for charts
  const performanceData = [
    { date: '2024-01-08', impressions: 1200, engagement: 89, clicks: 23 },
    { date: '2024-01-09', impressions: 1800, engagement: 134, clicks: 45 },
    { date: '2024-01-10', impressions: 2200, engagement: 167, clicks: 67 },
    { date: '2024-01-11', impressions: 1900, engagement: 142, clicks: 56 },
    { date: '2024-01-12', impressions: 2800, engagement: 234, clicks: 89 },
    { date: '2024-01-13', impressions: 3200, engagement: 298, clicks: 123 },
    { date: '2024-01-14', impressions: 2600, engagement: 187, clicks: 78 }
  ];

  res.json(performanceData);
});

// User Profile Routes
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    profile: user.profile,
    createdAt: user.createdAt
  });
});

app.put('/api/user/profile', authenticateToken, (req, res) => {
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users[userIndex].profile = { ...users[userIndex].profile, ...req.body };
  res.json(users[userIndex].profile);
});

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
    availableRoutes: [
      'GET /',
      'GET /api/health',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/trends',
      'POST /api/content/generate',
      'GET /api/posts',
      'GET /api/analytics/overview',
      'GET /api/analytics/performance',
      'GET /api/user/profile'
    ]
  });
});

// Start server with proper error handling
const startServer = () => {
  try {
    const server = app.listen(PORT, () => {
      console.log(`🚀 TrendCraft API server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🎯 Frontend should run on: http://localhost:5173`);
      console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Not configured'}`);
      console.log(`🕷️ Apify: ${process.env.APIFY_API_TOKEN ? 'Configured (disabled)' : 'Not configured'}`);
      console.log('✅ Server started successfully!');
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please use a different port.`);
      }
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();