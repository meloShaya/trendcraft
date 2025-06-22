import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from 'axios';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load environment variables
dotenv.config();

// Robust JWT Secret Handling
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in your .env file.");
    process.exit(1);
}
console.log("[OK] JWT_SECRET loaded successfully.");

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// Middleware
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// Helper function to transform Apify trend data
const transformTrendData = (apifyData, platform = "twitter") => {
    if (!apifyData || !Array.isArray(apifyData)) { return []; }
    return apifyData.map((item, index) => {
        const keyword = item.trend || item.hashtag || item.topic || item.name || `Trend ${index + 1}`;
        const volume = item.volume || item.posts || item.mentions || Math.floor(Math.random() * 100000) + 10000;
        const growth = item.growth || item.change || `+${Math.floor(Math.random() * 50) + 5}%`;
        return {
            id: index + 1, keyword: keyword.replace("#", ""), category: item.category || "General", trendScore: item.score || Math.floor(Math.random() * 30) + 70, volume: typeof volume === "number" ? volume : parseInt(volume) || Math.floor(Math.random() * 100000) + 10000, growth: growth, platforms: [platform], relatedHashtags: item.hashtags || [`#${keyword.replace("#", "")}`, "#trending", "#viral"], peakTime: item.peakTime || "14:00-16:00 UTC", demographics: { age: item.demographics?.age || "25-34", interests: item.demographics?.interests || ["Technology", "Social Media", "Trends"] },
        };
    });
};

// REWRITTEN Helper function to fetch trends from Apify using the standard 2-step process
const fetchTrendsFromApify = async (platform = "twitter") => {
    try {
        console.log(`Fetching trends for platform: ${platform} via direct API call`);
        let actorId, actorInput;

        if (platform === "twitter" || platform === "x") {
            actorId = process.env.TWITTER_TRENDS_ACTOR_ID;
            actorInput = { location: "Worldwide", maxTrends: 20 };
        } else {
            actorId = process.env.SOCIAL_INSIGHT_ACTOR_ID;
            actorInput = { platform: platform, maxResults: 20, sortBy: "trending" };
        }
        
        const safeActorId = actorId.replace('/', '~');
        const token = process.env.APIFY_API_TOKEN;

        // --- THIS IS THE FIX ---

        // STEP 1: Start the actor run
        const startRunUrl = `https://api.apify.com/v2/acts/${safeActorId}/runs?token=${token}`;
        console.log(`Calling Apify API Step 1: POST to start run...`);
        
        const startResponse = await axios.post(startRunUrl, actorInput, {
            headers: { 'Content-Type': 'application/json' }
        });

        const runId = startResponse.data.data.id;
        const datasetId = startResponse.data.data.defaultDatasetId;
        console.log(`Actor run started successfully. Run ID: ${runId}`);

        // STEP 2: Fetch the results from the run's dataset
        // Note: We poll for the run status until it's finished. A real production app might use webhooks.
        // For this app, we will just wait and then fetch the dataset directly. A simple GET will suffice.
        const getResultsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`;
        
        // We need to wait a bit for the actor to finish. Let's try fetching after a delay.
        // A simple but effective method for this use case is to poll.
        let items = [];
        let runStatus = 'RUNNING';
        let attempts = 0;
        
        while (runStatus !== 'SUCCEEDED' && attempts < 15) { // Poll for max 30 seconds
            const statusUrl = `https://api.apify.com/v2/acts/${safeActorId}/runs/${runId}?token=${token}`;
            const statusResponse = await axios.get(statusUrl);
            runStatus = statusResponse.data.data.status;
            
            if (runStatus === 'SUCCEEDED') {
                console.log('Run finished. Fetching results...');
                const resultsResponse = await axios.get(getResultsUrl);
                items = resultsResponse.data;
                break;
            } else if (runStatus === 'FAILED' || runStatus === 'ABORTED') {
                 console.error(`Actor run ${runStatus}.`);
                 break;
            }
            
            console.log(`Run status: ${runStatus}. Waiting...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before polling again
            attempts++;
        }

        if (items.length === 0) {
             console.log("Could not retrieve items after polling. Either the run failed or took too long.");
        }
        // --- END OF FIX ---
        
        console.log(`Retrieved ${items.length} items from Apify`);
        return transformTrendData(items, platform);

    } catch (error) {
        console.error("Error during Apify 2-step process:", error.response ? error.response.data : error.message);
        return [];
    }
};


// Helper function to generate content with Gemini AI
const generateContentWithAI = async (
    topic,
    platform,
    tone,
    targetAudience,
    includeHashtags
) => {
    try {
        const prompt = `
You are an expert social media content creator. Generate engaging ${platform} content based on the following requirements:

Topic: ${topic}
Platform: ${platform}
Tone: ${tone}
Target Audience: ${targetAudience || "general audience"}
Include Hashtags: ${includeHashtags ? "Yes" : "No"}

Generate only the content text, nothing else.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();
        const viralScore = calculateViralScore(content, platform);
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
                    comments: Math.floor(viralScore * 0.9),
                },
            },
        };
    } catch (error) {
        console.error("Error generating content with Gemini AI:", error);
        const toneTemplates = { professional: [`Exploring the future of ${topic}.`], casual: [`Just discovered something cool about ${topic}!`], humorous: [`${topic} be like: "I'm about to change your whole career"`]};
        const templates = toneTemplates[tone] || toneTemplates.professional;
        const content = templates[Math.floor(Math.random() * templates.length)];
        const hashtagPool = [`#${topic.replace(/\s+/g, "")}`, "#Innovation", "#TechTrends"];
        const selectedHashtags = includeHashtags ? hashtagPool.slice(0, 2) : [];
        const finalContent = includeHashtags ? `${content} ${selectedHashtags.join(" ")}` : content;
        const viralScore = Math.floor(Math.random() * 30) + 70;
        return { content: finalContent, viralScore, hashtags: selectedHashtags, platform, recommendations: { bestPostTime: getBestPostTime(platform), expectedReach: Math.floor(Math.random() * 5000) + 1000, engagementPrediction: { likes: Math.floor(viralScore * 5.2), retweets: Math.floor(viralScore * 1.8), comments: Math.floor(viralScore * 0.9) } } };
    }
};

// Helper function to calculate viral score
const calculateViralScore = (content, platform) => {
    let score = 50;
    if (platform === "twitter" && content.length <= 280) score += 10;
    if (content.includes("?")) score += 5;
    if (content.match(/[🔥💡🚀✨⭐]/g)) score += 10;
    if (content.includes("#")) score += 8;
    return Math.min(score, 100);
};

// Helper function to get best posting time by platform
const getBestPostTime = (platform) => {
    const times = { twitter: "14:00-16:00 UTC", instagram: "11:00-13:00 UTC", linkedin: "08:00-10:00 UTC" };
    return times[platform] || "14:00-16:00 UTC";
};

// Auth Middleware
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

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({ status: "OK", message: "TrendCraft API is running" });
});

// Auth Routes
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = users.find((u) => u.email === email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, profile: user.profile } });
});

// Trends Routes
app.get("/api/trends", authenticateToken, async (req, res) => {
    const { category, limit = 10, platform = "twitter" } = req.query;
    let trends = await fetchTrendsFromApify(platform);
    if (category && category !== 'all') {
        trends = trends.filter(t => t.category.toLowerCase() === category.toLowerCase());
    }
    res.json(trends.slice(0, parseInt(limit)));
});

// Content Routes
app.post("/api/content/generate", authenticateToken, async (req, res) => {
    const { topic, platform, tone, includeHashtags, targetAudience } = req.body;
    const generatedContent = await generateContentWithAI(topic, platform, tone, targetAudience, includeHashtags);
    res.json(generatedContent);
});

// Posts Routes
app.get("/api/posts", authenticateToken, (req, res) => {
    const userPosts = posts.filter((p) => p.userId === req.user.id);
    res.json(userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Analytics Routes
app.get("/api/analytics/overview", authenticateToken, (req, res) => {
    const userPosts = posts.filter(p => p.userId === req.user.id);
    const totalEngagement = userPosts.reduce((sum, post) => sum + post.engagement.likes + post.engagement.retweets + post.engagement.comments, 0);
    const totalImpressions = userPosts.reduce((sum, post) => sum + (post.performance?.impressions || 0), 0);
    const avgViralScore = userPosts.length > 0 ? userPosts.reduce((sum, post) => sum + post.viralScore, 0) / userPosts.length : 0;
    res.json({ totalPosts: userPosts.length, totalEngagement, totalImpressions, avgViralScore: Math.round(avgViralScore), weeklyGrowth: '+12.5%', topPerformingPost: userPosts.sort((a, b) => b.viralScore - a.viralScore)[0] || null });
});

// Add missing analytics performance route
app.get("/api/analytics/performance", authenticateToken, (req, res) => {
    // Generate mock performance data for the last 30 days
    const performanceData = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        performanceData.push({
            date: date.toISOString().split('T')[0],
            impressions: Math.floor(Math.random() * 5000) + 1000,
            engagement: Math.floor(Math.random() * 500) + 100,
            clicks: Math.floor(Math.random() * 200) + 50,
            reach: Math.floor(Math.random() * 3000) + 800
        });
    }
    
    res.json(performanceData);
});

// The final app.listen call
app.listen(PORT, () => {
    console.log(`🚀 TrendCraft API server running on http://localhost:${PORT}`);
    console.log(`🎯 Frontend should run on: http://localhost:5173`);
    console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? "Configured" : "Not configured"}`);
    console.log(`🕷️ Apify: Using direct API calls via axios.`);
});