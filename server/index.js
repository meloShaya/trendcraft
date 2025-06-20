import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'trendcraft-secret-key';

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true
}));
app.use(express.json());

// Root route for backend
app.get('/', (req, res) => {
  res.json({ 
    message: 'TrendCraft API Server', 
    version: '1.0.0',
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

// Mock trends data
const mockTrends = [
  {
    id: 1,
    keyword: 'AI Revolution',
    category: 'Technology',
    trendScore: 94,
    volume: 125000,
    growth: '+23%',
    platforms: ['twitter'],
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
    platforms: ['twitter'],
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
    platforms: ['linkedin'],
    relatedHashtags: ['#RemoteWork', '#WorkFromHome', '#DigitalNomad'],
    peakTime: '09:00-11:00 UTC',
    demographics: { age: '25-40', interests: ['Business', 'Technology', 'Productivity'] }
  }
];

// Helper function to generate content with mock AI
const generateContentWithAI = async (topic, platform, tone, targetAudience, includeHashtags) => {
  try {
    // Mock AI content generation
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
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
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
  res.json({ status: 'OK', message: 'TrendCraft API is running' });
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
    const { category, limit = 10 } = req.query;
    
    console.log(`Fetching trends - Category: ${category}, Limit: ${limit}`);
    
    let trends = [...mockTrends];
    
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
    const trend = mockTrends.find(t => t.id === parseInt(req.params.id));
    
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

    // Generate content using mock AI
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

app.listen(PORT, () => {
  console.log(`🚀 TrendCraft API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎯 Frontend should run on: http://localhost:5173`);
});