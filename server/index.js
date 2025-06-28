import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Token verification failed' });
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get user subscription
app.get('/api/subscription', verifyToken, async (req, res) => {
  try {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return default free subscription if none exists
    if (!subscription) {
      return res.json({
        id: 'free',
        plan: 'free',
        status: 'active',
        current_period_end: null
      });
    }

    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Get user usage
app.get('/api/usage', verifyToken, async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    
    const { data: usage, error } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('month', currentMonth)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return default usage if none exists
    if (!usage) {
      return res.json({
        posts_generated: 0,
        images_generated: 0,
        videos_generated: 0,
        month: currentMonth
      });
    }

    res.json(usage);
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// Create Stripe checkout session
app.post('/api/create-checkout-session', verifyToken, async (req, res) => {
  try {
    const { plan } = req.body;
    
    if (plan !== 'pro') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Check if user already has a Stripe customer
    let { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', req.user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: {
          user_id: req.user.id
        }
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'TrendCraft Pro',
              description: 'Unlimited posts, AI image/video generation, voice chat, and premium features'
            },
            unit_amount: 2900, // $29.00
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/generate`,
      metadata: {
        user_id: req.user.id,
        plan: 'pro'
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create billing portal session
app.post('/api/billing-portal', verifyToken, async (req, res) => {
  try {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', req.user.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

// Content generation endpoint
app.post('/api/content/generate', verifyToken, async (req, res) => {
  try {
    const { topic, platform, tone, includeHashtags, targetAudience, locationWoeid } = req.body;

    // Check user's subscription and usage
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    
    const [subscriptionResult, usageResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', req.user.id)
        .single(),
      supabase
        .from('usage_tracking')
        .select('posts_generated')
        .eq('user_id', req.user.id)
        .eq('month', currentMonth)
        .single()
    ]);

    const subscription = subscriptionResult.data;
    const usage = usageResult.data;
    
    const isPremium = subscription?.plan === 'pro' && subscription?.status === 'active';
    const postsGenerated = usage?.posts_generated || 0;

    // Check limits for free users
    if (!isPremium && postsGenerated >= 10) {
      return res.status(403).json({ 
        error: 'Monthly limit reached. Upgrade to Pro for unlimited posts.',
        code: 'LIMIT_REACHED'
      });
    }

    // Mock content generation (replace with actual AI API call)
    const mockContent = {
      content: `🚀 ${topic} is revolutionizing the way we think about ${platform} content! ${includeHashtags ? '#Innovation #TechTrends #SocialMedia' : ''}`,
      viralScore: Math.floor(Math.random() * 30) + 70,
      hashtags: includeHashtags ? ['#Innovation', '#TechTrends', '#SocialMedia'] : [],
      platform,
      recommendations: {
        bestPostTime: '14:00-16:00 UTC',
        expectedReach: Math.floor(Math.random() * 5000) + 1000,
        engagementPrediction: {
          likes: Math.floor(Math.random() * 500) + 100,
          retweets: Math.floor(Math.random() * 100) + 20,
          comments: Math.floor(Math.random() * 50) + 10
        }
      }
    };

    // Update usage tracking
    await supabase
      .from('usage_tracking')
      .upsert({
        user_id: req.user.id,
        month: currentMonth,
        posts_generated: postsGenerated + 1
      }, {
        onConflict: 'user_id,month'
      });

    res.json(mockContent);
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

// Analytics endpoints
app.get('/api/analytics/overview', verifyToken, async (req, res) => {
  try {
    // Mock analytics data
    const analytics = {
      totalPosts: Math.floor(Math.random() * 50) + 10,
      totalEngagement: Math.floor(Math.random() * 1000) + 200,
      totalImpressions: Math.floor(Math.random() * 10000) + 2000,
      avgViralScore: Math.floor(Math.random() * 20) + 70,
      weeklyGrowth: '+12.5%'
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/analytics/performance', verifyToken, async (req, res) => {
  try {
    // Mock performance data
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
    console.error('Error fetching performance data:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// Trends endpoints
app.get('/api/trends', verifyToken, async (req, res) => {
  try {
    const { platform = 'twitter', limit = 20, location = '1' } = req.query;

    // Mock trends data
    const trends = Array.from({ length: parseInt(limit) }, (_, i) => ({
      id: i + 1,
      keyword: `Trend Topic ${i + 1}`,
      category: ['Technology', 'Business', 'Entertainment', 'Sports'][i % 4],
      trendScore: Math.floor(Math.random() * 30) + 70,
      volume: Math.floor(Math.random() * 100000) + 10000,
      growth: `+${Math.floor(Math.random() * 50) + 10}%`,
      platforms: [platform],
      relatedHashtags: [`#trend${i + 1}`, `#${platform}`, '#viral'],
      peakTime: '14:00-16:00 UTC',
      demographics: {
        age: '18-34',
        interests: ['technology', 'social media']
      }
    }));

    res.json(trends);
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

app.get('/api/trends/locations', verifyToken, async (req, res) => {
  try {
    const locations = [
      { name: "Worldwide", woeid: 1 },
      { name: "United States", woeid: 23424977 },
      { name: "United Kingdom", woeid: 23424975 },
      { name: "Canada", woeid: 23424775 },
      { name: "Australia", woeid: 23424748 },
      { name: "Germany", woeid: 23424829 },
      { name: "France", woeid: 23424819 },
      { name: "Japan", woeid: 23424856 }
    ];

    res.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Posts endpoints
app.get('/api/posts', verifyToken, async (req, res) => {
  try {
    // Mock posts data
    const posts = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      content: `This is a sample post ${i + 1} with some engaging content about trending topics.`,
      platform: ['twitter', 'linkedin', 'instagram'][i % 3],
      viralScore: Math.floor(Math.random() * 30) + 70,
      engagement: {
        likes: Math.floor(Math.random() * 500) + 50,
        retweets: Math.floor(Math.random() * 100) + 10,
        comments: Math.floor(Math.random() * 50) + 5,
        shares: Math.floor(Math.random() * 25) + 2
      },
      hashtags: ['#trending', '#viral', '#socialmedia'],
      status: ['published', 'scheduled', 'draft'][i % 3],
      scheduledFor: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
    }));

    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// User endpoints
app.get('/api/user/streak', verifyToken, async (req, res) => {
  try {
    // Mock streak data
    const streakData = {
      currentStreak: Math.floor(Math.random() * 10) + 1,
      longestStreak: Math.floor(Math.random() * 20) + 5,
      lastPostDate: new Date().toISOString(),
      streakData: Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return {
          date: date.toISOString().split('T')[0],
          posted: Math.random() > 0.3,
          postCount: Math.floor(Math.random() * 3)
        };
      }).reverse()
    };

    res.json(streakData);
  } catch (error) {
    console.error('Error fetching streak data:', error);
    res.status(500).json({ error: 'Failed to fetch streak data' });
  }
});

// Stripe webhook handler
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        await handleSubscriptionChange(subscription);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handleCheckoutCompleted(session) {
  const userId = session.metadata.user_id;
  const customerId = session.customer;
  
  // Get the subscription from Stripe
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1
  });

  if (subscriptions.data.length > 0) {
    const subscription = subscriptions.data[0];
    
    // Update or create subscription in database
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        plan: 'pro',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      }, {
        onConflict: 'user_id'
      });

    // Update user premium status
    await supabase
      .from('users')
      .update({ is_premium: true })
      .eq('id', userId);
  }
}

async function handleSubscriptionChange(subscription) {
  const customerId = subscription.customer;
  
  // Find user by customer ID
  const { data: userSubscription } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (userSubscription) {
    const isActive = subscription.status === 'active';
    
    // Update subscription in database
    await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end
      })
      .eq('stripe_customer_id', customerId);

    // Update user premium status
    await supabase
      .from('users')
      .update({ is_premium: isActive })
      .eq('id', userSubscription.user_id);
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});