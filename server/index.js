import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from 'axios';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in your .env file.");
    process.exit(1);
}
console.log("[OK] JWT_SECRET loaded successfully.");

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// --- HELPER FUNCTIONS & MIDDLEWARE (DECLARED FIRST) ---

// Platform-specific actor configurations
const PLATFORM_ACTORS = {
    twitter: {
        actorId: process.env.TWITTER_TRENDS_ACTOR_ID || 'apify/twitter-trends-scraper',
        input: { location: "United States", limit: 10 }
    },
    tiktok: {
        actorId: 'novi/fast-tiktok-api',
        input: { type: "TREND", country: "US", limit: 20 }
    },
    // ... other platforms
};

const cleanKeyword = (keyword) => {
    if (!keyword || typeof keyword !== 'string') return null;
    return keyword.replace(/[#@]/g, '').trim();
};

const parseTwitterVolume = (volumeStr) => {
    if (!volumeStr) return 0;
    if (typeof volumeStr === 'number') return volumeStr;
    const lowerCaseVolume = String(volumeStr).toLowerCase();
    if (lowerCaseVolume.includes('under')) return 5000;
    const num = parseFloat(lowerCaseVolume.replace(/[^0-9.]/g, ''));
    if (lowerCaseVolume.includes('k')) return num * 1000;
    if (lowerCaseVolume.includes('m')) return num * 1000000;
    return num;
};

const calculateTrendScore = (volume, platform) => {
    if (!volume || volume === 0) return 50;
    let score = 50 + Math.log10(volume) * 5;
    return Math.min(Math.round(score), 99);
};

const transformTrendData = (apifyData, platform) => {
    if (!apifyData || !Array.isArray(apifyData) || apifyData.length === 0) return [];
    const transformedTrends = [];
    for (const item of apifyData) {
        let trendData = null;
        switch (platform) {
            case 'twitter':
                if (item.topic || item.trend || item.name || item.query) {
                    trendData = {
                        keyword: cleanKeyword(item.topic || item.trend || item.name || item.query),
                        volume: parseTwitterVolume(item.tweet_volume || item.volume),
                    };
                }
                break;
            case 'tiktok':
                if (item.desc || item.title) {
                    trendData = {
                        keyword: cleanKeyword(item.desc || item.title),
                        volume: item.playCount || item.diggCount || 0,
                    };
                }
                break;
        }
        if (trendData && trendData.keyword) {
            transformedTrends.push({
                id: transformedTrends.length + 1,
                keyword: trendData.keyword,
                category: 'General',
                trendScore: calculateTrendScore(trendData.volume, platform),
                volume: trendData.volume,
                growth: '+0%',
                platforms: [platform],
                relatedHashtags: [trendData.keyword.replace(/\s+/g, '')],
                peakTime: 'N/A',
                demographics: { age: 'N/A', interests: [] }
            });
        }
    }
    console.log(`Successfully transformed ${transformedTrends.length} trends for ${platform}`);
    return transformedTrends;
};

const fetchTrendsFromApify = async (platform) => {
    const platformConfig = PLATFORM_ACTORS[platform];
    if (!platformConfig) {
        console.log(`No actor config for platform: ${platform}`);
        return [];
    }
    try {
        const { actorId, input: actorInput } = platformConfig;
        const safeActorId = actorId.replace('/', '~');
        const token = process.env.APIFY_API_TOKEN;
        if (!token) return [];

        const startRunUrl = `https://api.apify.com/v2/acts/${safeActorId}/runs?token=${token}`;
        const startResponse = await axios.post(startRunUrl, actorInput, { headers: { 'Content-Type': 'application/json' } });
        const { id: runId, defaultDatasetId: datasetId } = startResponse.data.data;
        console.log(`Actor run started. Run ID: ${runId}`);

        let attempts = 0;
        while (attempts < 30) {
            const statusUrl = `https://api.apify.com/v2/acts/${safeActorId}/runs/${runId}?token=${token}`;
            const statusResponse = await axios.get(statusUrl);
            const { status } = statusResponse.data.data;

            if (status === 'SUCCEEDED') {
                const getResultsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`;
                const resultsResponse = await axios.get(getResultsUrl);
                console.log(`Retrieved ${resultsResponse.data.length} raw items for ${platform}`);
                return transformTrendData(resultsResponse.data, platform);
            }
            if (status === 'FAILED' || status === 'ABORTED') {
                console.error(`Actor run ${status} for platform ${platform}`);
                return [];
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
        }
        console.error(`Actor run timed out for platform ${platform}`);
        return [];
    } catch (error) {
        console.error(`Error fetching trends for ${platform}:`, error.response?.data || error.message);
        return [];
    }
};

const generateContentWithAI = async (topic, platform, tone, targetAudience, includeHashtags) => {
    // ... your full generateContentWithAI logic ...
    return { content: `Generated content for ${topic} on ${platform}.`, viralScore: 80, hashtags: [`#${topic}`] };
};

// Auth Middleware - Declared before use
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Access token required" });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
};


// --- MIDDLEWARE & ROUTES ---

// Mock Data Store (In production, use a real database)
let users = [ { id: 1, username: "demo", email: "demo@trendcraft.ai", password: bcrypt.hashSync("demo123", 10), profile: { name: "Demo User", bio: "Content creator exploring AI-powered social media", avatar: "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop" }, createdAt: new Date("2024-01-01") } ];
let posts = [ { id: 1, userId: 1, content: "🚀 Just discovered the future of content creation with AI! The possibilities are endless when you combine creativity with technology. What's your take on AI-powered social media? #AI #ContentCreation #TechTrends", platform: "twitter", viralScore: 87, engagement: { likes: 342, retweets: 89, comments: 23, shares: 45 }, hashtags: ["#AI", "#ContentCreation", "#TechTrends"], status: "published", scheduledFor: new Date(), createdAt: new Date("2024-01-15"), performance: { impressions: 12500, reach: 8900, clickThrough: 156 } }, { id: 2, userId: 1, content: "💡 Hot take: The best social media strategy isn't about posting more—it's about posting smarter. Data-driven content creation is the game changer we've been waiting for! #SocialMediaStrategy #DataDriven #MarketingTips", platform: "twitter", viralScore: 92, engagement: { likes: 567, retweets: 143, comments: 67, shares: 89 }, hashtags: ["#SocialMediaStrategy", "#DataDriven", "#MarketingTips"], status: "published", scheduledFor: new Date(Date.now() - 86400000), createdAt: new Date("2024-01-14"), performance: { impressions: 18300, reach: 14200, clickThrough: 234 } } ];

app.use(express.json());

// Auth Routes
app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = users.find((u) => u.email === email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user });
});

// All other routes now use pre-declared functions
app.get("/api/trends", authenticateToken, async (req, res) => {
    const { platform = "twitter", limit = 20 } = req.query;
    const trends = await fetchTrendsFromApify(platform);
    res.json(trends.slice(0, parseInt(limit)));
});

app.post("/api/content/generate", authenticateToken, async (req, res) => {
    const { topic, platform, tone, includeHashtags, targetAudience } = req.body;
    const generatedContent = await generateContentWithAI(topic, platform, tone, targetAudience, includeHashtags);
    res.json(generatedContent);
});

// ... and so on for all your other routes (posts, analytics, etc.)


// Start server
app.listen(PORT, () => {
    console.log(`🚀 TrendCraft API server running on http://localhost:${PORT}`);
});
