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
    console.error("The server cannot start without a secret key for signing tokens.");
    process.exit(1);
}
console.log("[OK] JWT_SECRET loaded successfully.");

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// Middleware
app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);
app.use(express.json());

// Root route for backend
app.get("/", (req, res) => {
    res.json({
        message: "TrendCraft API Server",
        version: "1.0.0",
        endpoints: {
            health: "/api/health",
            auth: "/api/auth/*",
            trends: "/api/trends",
            content: "/api/content/*",
            posts: "/api/posts",
            analytics: "/api/analytics/*",
            user: "/api/user/*",
        },
    });
});

// Mock Data Store
let users = [ 
    { 
        id: 1, 
        username: "demo", 
        email: "demo@trendcraft.ai", 
        password: bcrypt.hashSync("demo123", 10), 
        profile: { 
            name: "Demo User", 
            bio: "Content creator exploring AI-powered social media", 
            avatar: "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop" 
        }, 
        createdAt: new Date("2024-01-01") 
    } 
];

let posts = [ 
    { 
        id: 1, 
        userId: 1, 
        content: "🚀 Just discovered the future of content creation with AI! The possibilities are endless when you combine creativity with technology. What's your take on AI-powered social media? #AI #ContentCreation #TechTrends", 
        platform: "twitter", 
        viralScore: 87, 
        engagement: { likes: 342, retweets: 89, comments: 23, shares: 45 }, 
        hashtags: ["#AI", "#ContentCreation", "#TechTrends"], 
        status: "published", 
        scheduledFor: new Date(), 
        createdAt: new Date("2024-01-15"), 
        performance: { impressions: 12500, reach: 8900, clickThrough: 156 } 
    }, 
    { 
        id: 2, 
        userId: 1, 
        content: "💡 Hot take: The best social media strategy isn't about posting more—it's about posting smarter. Data-driven content creation is the game changer we've been waiting for! #SocialMediaStrategy #DataDriven #MarketingTips", 
        platform: "twitter", 
        viralScore: 92, 
        engagement: { likes: 567, retweets: 143, comments: 67, shares: 89 }, 
        hashtags: ["#SocialMediaStrategy", "#DataDriven", "#MarketingTips"], 
        status: "published", 
        scheduledFor: new Date(Date.now() - 86400000), 
        createdAt: new Date("2024-01-14"), 
        performance: { impressions: 18300, reach: 14200, clickThrough: 234 } 
    } 
];

// Platform-specific actor configurations
const PLATFORM_ACTORS = {
    twitter: {
        actorId: process.env.TWITTER_TRENDS_ACTOR_ID || 'apify/twitter-trends-scraper',
        input: { location: "United States", maxTrends: 20 }
    },
    instagram: {
        actorId: 'easyapi/instagram-posts-scraper',
        input: { hashtag: "trending", maxResults: 20, sortBy: "recent" }
    },
    tiktok: {
        actorId: 'novi/fast-tiktok-api',
        input: { hashtag: "trending", maxResults: 20, sortBy: "popular" }
    },
    facebook: {
        actorId: 'apify/facebook-posts-scraper', // Placeholder
        input: { query: "trending", maxResults: 20 }
    },
    youtube: {
        actorId: 'apify/youtube-scraper', // Placeholder
        input: { searchKeywords: "trending", maxResults: 20 }
    }
};

// Enhanced helper function to transform platform-specific data
const transformTrendData = (apifyData, platform = "twitter") => {
    if (!apifyData || !Array.isArray(apifyData)) {
        console.log("Invalid Apify data received:", apifyData);
        return [];
    }

    return apifyData.map((item, index) => {
        let keyword, volume, growth, category, hashtags, peakTime, demographics;

        // Platform-specific data extraction
        switch (platform) {
            case 'twitter':
                keyword = item.trend || item.name || item.query || `Trend ${index + 1}`;
                volume = item.tweet_volume || item.volume || Math.floor(Math.random() * 100000) + 10000;
                growth = item.growth || `+${Math.floor(Math.random() * 50) + 5}%`;
                category = item.category || 'General';
                hashtags = item.hashtags || [`#${keyword.replace('#', '')}`, '#trending', '#viral'];
                peakTime = item.peak_time || '14:00-16:00 UTC';
                demographics = {
                    age: item.demographics?.age || '25-34',
                    interests: item.demographics?.interests || ['Technology', 'Social Media', 'Trends']
                };
                break;

            case 'instagram':
                keyword = item.hashtag || item.caption?.substring(0, 50) || `Trend ${index + 1}`;
                volume = item.likes_count || item.comments_count || Math.floor(Math.random() * 50000) + 5000;
                growth = `+${Math.floor(Math.random() * 40) + 10}%`;
                category = 'Lifestyle';
                hashtags = item.hashtags || [`#${keyword.replace('#', '')}`, '#instagram', '#viral'];
                peakTime = '11:00-13:00 UTC';
                demographics = {
                    age: '18-34',
                    interests: ['Lifestyle', 'Fashion', 'Photography']
                };
                break;

            case 'tiktok':
                keyword = item.desc || item.hashtag || `Trend ${index + 1}`;
                volume = item.play_count || item.digg_count || Math.floor(Math.random() * 200000) + 20000;
                growth = `+${Math.floor(Math.random() * 60) + 15}%`;
                category = 'Entertainment';
                hashtags = item.hashtags || [`#${keyword.replace('#', '')}`, '#fyp', '#viral'];
                peakTime = '18:00-20:00 UTC';
                demographics = {
                    age: '16-24',
                    interests: ['Entertainment', 'Music', 'Dance']
                };
                break;

            case 'facebook':
                keyword = item.text?.substring(0, 50) || `Trend ${index + 1}`;
                volume = item.reactions || item.shares || Math.floor(Math.random() * 30000) + 3000;
                growth = `+${Math.floor(Math.random() * 35) + 8}%`;
                category = 'Community';
                hashtags = [`#${keyword.replace('#', '')}`, '#facebook', '#community'];
                peakTime = '13:00-15:00 UTC';
                demographics = {
                    age: '25-45',
                    interests: ['Community', 'Family', 'Local News']
                };
                break;

            case 'youtube':
                keyword = item.title?.substring(0, 50) || `Trend ${index + 1}`;
                volume = item.view_count || Math.floor(Math.random() * 500000) + 50000;
                growth = `+${Math.floor(Math.random() * 45) + 12}%`;
                category = 'Video Content';
                hashtags = [`#${keyword.replace('#', '')}`, '#youtube', '#video'];
                peakTime = '19:00-21:00 UTC';
                demographics = {
                    age: '18-35',
                    interests: ['Video Content', 'Entertainment', 'Education']
                };
                break;

            default:
                keyword = item.trend || item.name || `Trend ${index + 1}`;
                volume = Math.floor(Math.random() * 100000) + 10000;
                growth = `+${Math.floor(Math.random() * 50) + 5}%`;
                category = 'General';
                hashtags = [`#${keyword.replace('#', '')}`, '#trending'];
                peakTime = '14:00-16:00 UTC';
                demographics = {
                    age: '25-34',
                    interests: ['General']
                };
        }

        return {
            id: index + 1,
            keyword: keyword.replace('#', '').substring(0, 100), // Limit keyword length
            category,
            trendScore: Math.floor(Math.random() * 30) + 70, // Random score between 70-100
            volume: typeof volume === 'number' ? volume : parseInt(volume) || Math.floor(Math.random() * 100000) + 10000,
            growth,
            platforms: [platform],
            relatedHashtags: hashtags.slice(0, 5), // Limit to 5 hashtags
            peakTime,
            demographics
        };
    });
};

// Enhanced function to fetch trends from Apify using platform-specific actors
const fetchTrendsFromApify = async (platform = "twitter") => {
    try {
        console.log(`Fetching trends for platform: ${platform} via Apify API`);
        
        const platformConfig = PLATFORM_ACTORS[platform];
        if (!platformConfig) {
            console.log(`No actor configuration found for platform: ${platform}, using fallback data`);
            return getFallbackTrends(platform);
        }

        const actorId = platformConfig.actorId;
        const actorInput = platformConfig.input;
        const safeActorId = actorId.replace('/', '~');
        const token = process.env.APIFY_API_TOKEN;

        if (!token) {
            console.log('APIFY_API_TOKEN not found, using fallback data');
            return getFallbackTrends(platform);
        }

        // Start the actor run
        const startRunUrl = `https://api.apify.com/v2/acts/${safeActorId}/runs?token=${token}`;
        console.log(`Starting Apify actor run for ${platform}...`);
        
        const startResponse = await axios.post(startRunUrl, actorInput, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000 // 10 second timeout
        });

        const runId = startResponse.data.data.id;
        const datasetId = startResponse.data.data.defaultDatasetId;
        console.log(`Actor run started. Run ID: ${runId}, Dataset ID: ${datasetId}`);

        // Poll for completion with timeout
        let items = [];
        let runStatus = 'RUNNING';
        let attempts = 0;
        const maxAttempts = 15; // Max 30 seconds
        
        while (runStatus !== 'SUCCEEDED' && attempts < maxAttempts) {
            const statusUrl = `https://api.apify.com/v2/acts/${safeActorId}/runs/${runId}?token=${token}`;
            
            try {
                const statusResponse = await axios.get(statusUrl, { timeout: 5000 });
                runStatus = statusResponse.data.data.status;
                
                if (runStatus === 'SUCCEEDED') {
                    console.log('Actor run completed successfully. Fetching results...');
                    const getResultsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`;
                    const resultsResponse = await axios.get(getResultsUrl, { timeout: 10000 });
                    items = resultsResponse.data;
                    break;
                } else if (runStatus === 'FAILED' || runStatus === 'ABORTED') {
                    console.error(`Actor run ${runStatus} for platform ${platform}`);
                    break;
                }
                
                console.log(`Run status: ${runStatus}. Attempt ${attempts + 1}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                attempts++;
            } catch (pollError) {
                console.error('Error polling run status:', pollError.message);
                break;
            }
        }

        if (items.length === 0) {
            console.log(`No items retrieved for ${platform}, using fallback data`);
            return getFallbackTrends(platform);
        }

        console.log(`Retrieved ${items.length} items from Apify for ${platform}`);
        return transformTrendData(items, platform);

    } catch (error) {
        console.error(`Error fetching trends from Apify for ${platform}:`, error.message);
        return getFallbackTrends(platform);
    }
};

// Fallback trends data for each platform
const getFallbackTrends = (platform) => {
    const fallbackData = {
        twitter: [
            { keyword: "AI Revolution", category: "Technology", volume: 125000, growth: "+23%" },
            { keyword: "Climate Action", category: "Environment", volume: 87000, growth: "+15%" },
            { keyword: "Remote Work", category: "Business", volume: 95000, growth: "+18%" }
        ],
        instagram: [
            { keyword: "Sustainable Fashion", category: "Lifestyle", volume: 65000, growth: "+28%" },
            { keyword: "Wellness Journey", category: "Health", volume: 78000, growth: "+22%" },
            { keyword: "Travel Photography", category: "Travel", volume: 92000, growth: "+31%" }
        ],
        tiktok: [
            { keyword: "Dance Challenge", category: "Entertainment", volume: 250000, growth: "+45%" },
            { keyword: "Cooking Hacks", category: "Food", volume: 180000, growth: "+38%" },
            { keyword: "Study Tips", category: "Education", volume: 120000, growth: "+25%" }
        ],
        facebook: [
            { keyword: "Community Events", category: "Community", volume: 45000, growth: "+12%" },
            { keyword: "Local Business", category: "Business", volume: 38000, growth: "+16%" },
            { keyword: "Family Recipes", category: "Food", volume: 52000, growth: "+19%" }
        ],
        youtube: [
            { keyword: "Tech Reviews", category: "Technology", volume: 320000, growth: "+27%" },
            { keyword: "DIY Projects", category: "Lifestyle", volume: 280000, growth: "+33%" },
            { keyword: "Gaming Tutorials", category: "Gaming", volume: 450000, growth: "+41%" }
        ]
    };

    const platformData = fallbackData[platform] || fallbackData.twitter;
    
    return platformData.map((item, index) => ({
        id: index + 1,
        keyword: item.keyword,
        category: item.category,
        trendScore: Math.floor(Math.random() * 30) + 70,
        volume: item.volume,
        growth: item.growth,
        platforms: [platform],
        relatedHashtags: [`#${item.keyword.replace(/\s+/g, '')}`, '#trending', '#viral'],
        peakTime: getBestPostTime(platform),
        demographics: {
            age: platform === 'tiktok' ? '16-24' : platform === 'facebook' ? '25-45' : '18-34',
            interests: [item.category, 'Social Media', 'Trends']
        }
    }));
};

// Platform-specific optimization configurations
const PLATFORM_CONFIGS = {
    twitter: {
        maxCharacters: 280,
        optimalHashtags: 2,
        maxHashtags: 5,
        visualEmphasis: "images_gifs",
        ctaStyle: "engagement_focused"
    },
    linkedin: {
        maxCharacters: 3000,
        optimalHashtags: 3,
        maxHashtags: 10,
        visualEmphasis: "professional_content",
        ctaStyle: "professional_networking"
    },
    instagram: {
        maxCharacters: 2200,
        optimalHashtags: 11,
        maxHashtags: 30,
        visualEmphasis: "high_quality_visuals",
        ctaStyle: "visual_engagement"
    },
    facebook: {
        maxCharacters: 63206,
        optimalHashtags: 2,
        maxHashtags: 10,
        visualEmphasis: "community_content",
        ctaStyle: "community_building"
    },
    tiktok: {
        maxCharacters: 2200,
        optimalHashtags: 5,
        maxHashtags: 20,
        visualEmphasis: "video_content",
        ctaStyle: "trend_participation"
    }
};

// ROBUST SYSTEM PROMPT
const createRobustSystemPrompt = (topic, platform, tone, targetAudience, includeHashtags) => {
    const platformConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;
    
    return `You are TrendCraft AI, an expert social media content generator. Your ONLY job is to generate ONE piece of ready-to-publish content for ${platform}.

CRITICAL RULES - FOLLOW EXACTLY:
1. Generate ONLY the final content text - no explanations, no options, no meta-commentary
2. Do NOT include phrases like "Here's a post", "Option 1", "Tweet 1", "**Option**", or any similar introductory text
3. Do NOT provide multiple versions or choices - generate exactly ONE piece of content
4. Do NOT explain what you're doing or why
5. The response should be ONLY the content that can be directly posted to ${platform}
6. Maximum ${platformConfig.maxCharacters} characters - strictly enforce this limit
7. Use ${tone} tone throughout
8. Target audience: ${targetAudience || 'general audience'}
9. ${includeHashtags ? `Include ${platformConfig.optimalHashtags} relevant hashtags` : 'Do not include hashtags'}

PLATFORM-SPECIFIC REQUIREMENTS FOR ${platform.toUpperCase()}:
${platform === 'twitter' ? `
- Keep under 280 characters
- Be punchy and engaging
- Include 1-2 hashtags maximum if requested
- Use engaging questions or calls for interaction
- Consider emojis sparingly but effectively` : ''}

${platform === 'linkedin' ? `
- Professional tone with personal insights
- Can be longer form (up to 3000 characters)
- Include 3-5 industry hashtags if requested
- Focus on value and professional growth
- Include professional experiences or lessons` : ''}

${platform === 'instagram' ? `
- Visual-first approach
- Use 8-15 hashtags if requested
- Include emojis and line breaks for readability
- Focus on lifestyle and visual appeal
- Include "link in bio" style CTAs` : ''}

${platform === 'facebook' ? `
- Community-focused content
- Can be longer form
- Use 1-3 hashtags if requested
- Focus on shareable, valuable content
- Encourage community interaction` : ''}

${platform === 'tiktok' ? `
- Video-first content description
- Use 3-7 hashtags including trending ones if requested
- Focus on entertainment and trends
- Include challenge or duet CTAs
- Keep descriptions engaging and fun` : ''}

TOPIC: ${topic}

Generate the content now - ONLY the content, nothing else:`;
};

// Enhanced helper function to generate content with platform optimization
const generateContentWithAI = async (
    topic,
    platform,
    tone,
    targetAudience,
    includeHashtags
) => {
    try {
        const platformConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;
        
        const prompt = createRobustSystemPrompt(topic, platform, tone, targetAudience, includeHashtags);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let content = response.text().trim();
        
        // Clean up any remaining unwanted prefixes or formatting
        content = content
            .replace(/^\*\*.*?\*\*\s*/g, '')
            .replace(/^Here's.*?:\s*/gi, '')
            .replace(/^Option \d+.*?:\s*/gi, '')
            .replace(/^\d+\.\s*/g, '')
            .replace(/^-\s*/g, '')
            .replace(/^\*\s*/g, '')
            .trim();
        
        // Ensure content doesn't exceed platform limits
        if (content.length > platformConfig.maxCharacters) {
            content = content.substring(0, platformConfig.maxCharacters - 3) + '...';
        }
        
        const viralScore = calculateViralScore(content, platform);
        const hashtagRegex = /#[\w]+/g;
        const hashtags = content.match(hashtagRegex) || [];

        const recommendations = generatePlatformRecommendations(platform, topic, viralScore);

        return {
            content,
            viralScore,
            hashtags,
            platform,
            recommendations,
            platformOptimization: {
                characterCount: content.length,
                characterLimit: platformConfig.maxCharacters,
                hashtagCount: hashtags.length,
                optimalHashtags: platformConfig.optimalHashtags,
                visualSuggestions: getVisualSuggestions(platform),
                ctaSuggestions: getCTASuggestions(platform)
            }
        };
    } catch (error) {
        console.error("Error generating content with Gemini AI:", error);
        
        const platformConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;
        const fallbackContent = generateFallbackContent(topic, platform, tone, platformConfig);
        
        return fallbackContent;
    }
};

// Helper function to generate platform-specific recommendations
const generatePlatformRecommendations = (platform, topic, viralScore) => {
    const baseRecommendations = {
        bestPostTime: getBestPostTime(platform),
        expectedReach: Math.floor(Math.random() * 5000) + 1000,
        engagementPrediction: {
            likes: Math.floor(viralScore * 5.2),
            retweets: Math.floor(viralScore * 1.8),
            comments: Math.floor(viralScore * 0.9),
        }
    };

    switch (platform) {
        case 'twitter':
            return {
                ...baseRecommendations,
                threadSuggestion: "Consider creating a thread for more detailed insights",
                visualTip: "Add an eye-catching image or GIF to increase engagement by 150%"
            };
        case 'linkedin':
            return {
                ...baseRecommendations,
                networkingTip: "Tag relevant industry professionals to increase reach",
                professionalTip: "Share a personal experience to make it more relatable"
            };
        case 'instagram':
            return {
                ...baseRecommendations,
                visualTip: "High-quality visuals are essential - consider professional photography",
                storyTip: "Share behind-the-scenes content in Stories for authenticity"
            };
        case 'facebook':
            return {
                ...baseRecommendations,
                communityTip: "Post in relevant Facebook Groups to expand reach",
                engagementTip: "Ask questions to encourage comments and discussions"
            };
        case 'tiktok':
            return {
                ...baseRecommendations,
                videoTip: "Hook viewers in the first 3 seconds with a compelling opening",
                trendTip: "Use trending sounds to increase discoverability"
            };
        default:
            return baseRecommendations;
    }
};

const getVisualSuggestions = (platform) => {
    const suggestions = {
        twitter: ["Eye-catching images", "GIFs", "Charts/infographics", "Short videos"],
        linkedin: ["Professional headshots", "Industry infographics", "Behind-the-scenes", "Carousel posts"],
        instagram: ["High-quality photos", "Consistent filters", "Carousel posts", "Reels", "Stories"],
        facebook: ["Engaging images", "User-generated content", "Facebook Live", "Event photos"],
        tiktok: ["Vertical videos (9:16)", "Trending effects", "Text overlays", "Quick cuts"]
    };
    return suggestions[platform] || suggestions.twitter;
};

const getCTASuggestions = (platform) => {
    const ctas = {
        twitter: ["Retweet if you agree", "What's your take?", "Share your thoughts 👇", "Tag someone who needs this"],
        linkedin: ["Share your experience", "Connect for more insights", "What's your take on this?", "Follow for updates"],
        instagram: ["Link in bio", "Double tap if you agree ❤️", "Save for later", "Tag a friend", "Share to Stories"],
        facebook: ["Share if you agree", "Join our community", "What do you think?", "Like and share"],
        tiktok: ["Duet this", "Try this challenge", "Follow for more", "Which one are you?", "Comment below"]
    };
    return ctas[platform] || ctas.twitter;
};

const generateFallbackContent = (topic, platform, tone, platformConfig) => {
    const toneTemplates = {
        professional: [
            `Exploring the future of ${topic}. Key insights for professionals.`,
            `${topic} is transforming industries. Here's what leaders need to know.`,
            `Breaking down ${topic}: Strategic considerations for decision makers.`
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
    let content = templates[Math.floor(Math.random() * templates.length)];
    
    const ctas = getCTASuggestions(platform);
    const cta = ctas[Math.floor(Math.random() * ctas.length)];
    content += ` ${cta}`;
    
    const hashtagPool = [`#${topic.replace(/\s+/g, '')}`, '#Innovation', '#TechTrends', '#DigitalTransformation'];
    const selectedHashtags = hashtagPool.slice(0, platformConfig.optimalHashtags);
    content += ` ${selectedHashtags.join(' ')}`;
    
    if (content.length > platformConfig.maxCharacters) {
        content = content.substring(0, platformConfig.maxCharacters - 3) + '...';
    }
    
    const viralScore = Math.floor(Math.random() * 30) + 70;
    
    return {
        content,
        viralScore,
        hashtags: selectedHashtags,
        platform,
        recommendations: generatePlatformRecommendations(platform, topic, viralScore),
        platformOptimization: {
            characterCount: content.length,
            characterLimit: platformConfig.maxCharacters,
            hashtagCount: selectedHashtags.length,
            optimalHashtags: platformConfig.optimalHashtags,
            visualSuggestions: getVisualSuggestions(platform),
            ctaSuggestions: getCTASuggestions(platform)
        }
    };
};

const calculateViralScore = (content, platform) => {
    let score = 50;
    const platformConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;
    
    const contentLength = content.length;
    const optimalLength = platformConfig.maxCharacters * 0.7;
    
    if (contentLength <= optimalLength) {
        score += 10;
    } else if (contentLength <= platformConfig.maxCharacters) {
        score += 5;
    }
    
    switch (platform) {
        case 'twitter':
            if (content.includes('?')) score += 8;
            if (content.match(/[🔥💡🚀✨⭐]/g)) score += 10;
            if (content.match(/\b(thread|🧵)\b/gi)) score += 5;
            break;
        case 'linkedin':
            if (content.match(/\b(insight|experience|professional|career)\b/gi)) score += 8;
            if (content.includes('?')) score += 6;
            if (content.match(/\b(tips|advice|lessons)\b/gi)) score += 10;
            break;
        case 'instagram':
            if (content.match(/[❤️😍🔥✨💯]/g)) score += 12;
            if (content.includes('link in bio')) score += 8;
            if (content.match(/\b(save|share|tag)\b/gi)) score += 6;
            break;
        case 'facebook':
            if (content.match(/\b(share|community|family|friends)\b/gi)) score += 8;
            if (content.includes('?')) score += 7;
            break;
        case 'tiktok':
            if (content.match(/\b(challenge|trend|viral|fyp)\b/gi)) score += 12;
            if (content.match(/[🔥💯✨🎵]/g)) score += 10;
            break;
    }
    
    if (content.includes('#')) score += 6;
    if (content.match(/\b(new|breaking|exclusive|first)\b/gi)) score += 8;
    if (content.match(/\b(tips|secrets|hacks|tricks)\b/gi)) score += 10;
    
    return Math.min(score, 100);
};

const getBestPostTime = (platform) => {
    const times = { 
        twitter: "14:00-16:00 UTC", 
        linkedin: "08:00-10:00 UTC", 
        instagram: "11:00-13:00 UTC", 
        facebook: "13:00-15:00 UTC",
        tiktok: "18:00-20:00 UTC",
        youtube: "19:00-21:00 UTC"
    };
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

// Enhanced Trends Routes with platform support
app.get("/api/trends", authenticateToken, async (req, res) => {
    try {
        const { platform = "twitter", limit = 20 } = req.query;
        
        console.log(`API: Fetching trends for platform: ${platform}, limit: ${limit}`);
        
        let trends = await fetchTrendsFromApify(platform);
        
        // Limit results
        const limitedTrends = trends.slice(0, parseInt(limit));
        
        console.log(`API: Returning ${limitedTrends.length} trends for ${platform}`);
        res.json(limitedTrends);
    } catch (error) {
        console.error('Error in /api/trends:', error);
        res.status(500).json({ error: 'Failed to fetch trends' });
    }
});

// Enhanced Content Routes with platform optimization
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

app.get("/api/analytics/performance", authenticateToken, (req, res) => {
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TrendCraft API server running on http://localhost:${PORT}`);
    console.log(`🎯 Frontend should run on: http://localhost:5173`);
    console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? "Configured" : "Not configured"}`);
    console.log(`🕷️ Apify: ${process.env.APIFY_API_TOKEN ? "Configured" : "Using fallback data"}`);
    console.log('✅ Server started successfully!');
});