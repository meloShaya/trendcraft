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

// Middleware
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());


// --- START OF FIXES ---

// Platform-specific actor configurations with correct input structures
const PLATFORM_ACTORS = {
    twitter: {
        actorId: process.env.TWITTER_TRENDS_ACTOR_ID || 'apify/twitter-trends-scraper',
        input: { location: "United States", limit: 10 } // Changed maxTrends to limit for consistency
    },
    instagram: {
        actorId: 'easyapi/instagram-posts-scraper',
        input: {
            usernames: ["trending", "viral", "popular"],
            maxPosts: 10,
            skipPinnedPosts: true
        }
    },
    tiktok: {
        // FIX #1: Corrected TikTok actor input fields
        actorId: 'novi/fast-tiktok-api',
        input: {
            type: "TREND", // Changed from scrapingType
            country: "US",    // Changed from targetCountry, used standard country code
            limit: 10         // Changed from limitResult
        }
    },
    facebook: {
        actorId: 'apify/facebook-posts-scraper',
        input: { query: "trending", maxResults: 20 }
    },
    youtube: {
        actorId: 'apify/youtube-scraper',
        input: { searchKeywords: "trending", maxResults: 20 }
    }
};

// STRICT data transformation - ONLY use real API data, NO fallbacks
const transformTrendData = (apifyData, platform = "twitter") => {
    if (!apifyData || !Array.isArray(apifyData) || apifyData.length === 0) {
        return [];
    }

    console.log(`Transforming ${apifyData.length} REAL items for platform: ${platform}`);
    const transformedTrends = [];

    for (const item of apifyData) {
        let trendData = null;

        switch (platform) {
            case 'twitter':
                // FIX #2: Added 'item.topic' to correctly identify Twitter trends
                if (item.topic || item.trend || item.name || item.query) {
                    const keyword = item.topic || item.trend || item.name || item.query;
                    trendData = {
                        keyword: cleanKeyword(keyword),
                        category: item.category || 'General',
                        volume: parseTwitterVolume(item.tweet_volume || item.volume),
                        growth: '+0%', // Twitter API doesn't provide growth data
                    };
                }
                break;
            
            case 'tiktok':
                 if (item.desc || item.title) {
                    trendData = {
                        keyword: cleanKeyword(item.desc || item.title),
                        category: 'General',
                        volume: item.playCount || item.diggCount || 0,
                        growth: '+0%', // TikTok API doesn't provide growth data
                    };
                }
                break;

            // ... other platform cases
        }

        if (trendData && trendData.keyword) {
            transformedTrends.push({
                id: transformedTrends.length + 1,
                keyword: trendData.keyword,
                category: trendData.category,
                trendScore: calculateTrendScore(trendData.volume, platform),
                volume: trendData.volume,
                growth: trendData.growth,
                platforms: [platform],
                relatedHashtags: [trendData.keyword.replace(/\s+/g, '')],
                peakTime: 'N/A',
                demographics: { age: 'N/A', interests: [] }
            });
        }
    }

    console.log(`Successfully transformed ${transformedTrends.length} REAL trends for ${platform}`);
    return transformedTrends;
};


// Helper function for cleaning keywords
const cleanKeyword = (keyword) => {
    if (!keyword || typeof keyword !== 'string') return null;
    return keyword.replace(/[#@]/g, '').trim();
};

// Helper function to parse Twitter's volume string (e.g., "15.2K tweets")
const parseTwitterVolume = (volumeStr) => {
    if (!volumeStr) return 0;
    if (typeof volumeStr === 'number') return volumeStr;
    if (typeof volumeStr !== 'string') return 0;

    const lowerCaseVolume = volumeStr.toLowerCase();
    if (lowerCaseVolume.includes('under')) return 5000; // Assign a base value

    const num = parseFloat(lowerCaseVolume.replace(/[^0-9.]/g, ''));
    if (lowerCaseVolume.includes('k')) return num * 1000;
    if (lowerCaseVolume.includes('m')) return num * 1000000;
    
    return num;
};

// --- END OF FIXES ---


// Enhanced function to fetch trends from Apify using platform-specific actors
const fetchTrendsFromApify = async (platform = "twitter") => {
    try {
        console.log(`Fetching REAL trends for platform: ${platform} via direct API call`);
        
        const platformConfig = PLATFORM_ACTORS[platform];
        if (!platformConfig) {
            console.log(`No actor configuration found for platform: ${platform}`);
            return [];
        }

        const actorId = platformConfig.actorId;
        const actorInput = platformConfig.input;
        const safeActorId = actorId.replace('/', '~');
        const token = process.env.APIFY_API_TOKEN;

        if (!token) {
            console.log('APIFY_API_TOKEN not found - cannot fetch real data');
            return [];
        }

        const startRunUrl = `https://api.apify.com/v2/acts/${safeActorId}/runs?token=${token}`;
        console.log(`Actor ID: ${actorId}`);
        console.log(`Input:`, JSON.stringify(actorInput, null, 2));
        
        const startResponse = await axios.post(startRunUrl, actorInput, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        const runId = startResponse.data.data.id;
        const datasetId = startResponse.data.data.defaultDatasetId;
        console.log(`Actor run started. Run ID: ${runId}, Dataset ID: ${datasetId}`);

        let items = [];
        let runStatus = 'RUNNING';
        let attempts = 0;
        const maxAttempts = 30;
        
        while (runStatus !== 'SUCCEEDED' && attempts < maxAttempts) {
            const statusUrl = `https://api.apify.com/v2/acts/${safeActorId}/runs/${runId}?token=${token}`;
            
            try {
                const statusResponse = await axios.get(statusUrl, { timeout: 5000 });
                runStatus = statusResponse.data.data.status;
                
                if (runStatus === 'SUCCEEDED') {
                    console.log('Actor run completed successfully. Fetching results...');
                    const getResultsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`;
                    const resultsResponse = await axios.get(getResultsUrl, { timeout: 15000 });
                    items = resultsResponse.data;
                    break;
                } else if (runStatus === 'FAILED' || runStatus === 'ABORTED') {
                    console.error(`Actor run ${runStatus} for platform ${platform}`);
                    return [];
                }
                
                console.log(`Run status: ${runStatus}. Attempt ${attempts + 1}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                attempts++;
            } catch (pollError) {
                console.error('Error polling run status:', pollError.message);
                return [];
            }
        }

        if (!items || items.length === 0) {
            console.log(`No items retrieved for ${platform} - returning empty array`);
            return [];
        }

        console.log(`Retrieved ${items.length} raw items from Apify for ${platform}`);
        return transformTrendData(items, platform);

    } catch (error) {
        console.error(`Error fetching trends from Apify direct API:`, {
            error: error.response?.data || error.message,
            platform,
            status: error.response?.status
        });
        return [];
    }
};

// ... Rest of your application code ...
// (calculateTrendScore, generateContentWithAI, all routes, etc.)
const calculateTrendScore = (volume, platform) => { /* ... */ return 85; }
const generateContentWithAI = async (topic, platform, tone, targetAudience, includeHashtags) => { /* ... */ return {content: "Generated content", viralScore: 85}; }
app.get("/api/trends", authenticateToken, async (req, res) => {
    try {
        const { platform = "twitter", limit = 20 } = req.query;
        let trends = await fetchTrendsFromApify(platform);
        if (!trends || trends.length === 0) {
            return res.json([]);
        }
        res.json(trends.slice(0, parseInt(limit)));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trends' });
    }
});
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
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = { id: 1, email: "demo@trendcraft.ai", password: bcrypt.hashSync("demo123", 10)};
    if (user.email !== email || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user });
});


// Start server
app.listen(PORT, () => {
    console.log(`🚀 TrendCraft API server running on http://localhost:${PORT}`);
});
