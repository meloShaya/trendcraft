import express from "express";
import expressWs from "express-ws";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ElevenLabsClient } from "elevenlabs";
import { WebSocket as WsClient } from "ws";
// import * as fs from "fs";
import path from 'path';
import os from 'os';
import fs from "fs";
import { Buffer } from "buffer";
import fetch from "node-fetch";
import FormData from 'form-data';

// Load environment variable
dotenv.config();

const app = express();
expressWs(app); // Initialize express-ws middleware
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
	console.error("FATAL ERROR: JWT_SECRET is not defined in your .env file.");
	console.error(
		"The server cannot start without a secret key for signing tokens."
	);
	process.exit(1);
}
console.log("[OK] JWT_SECRET loaded successfully.");

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// Initialize ElevenLabs client
let elevenLabsClient = null;
if (process.env.ELEVENLABS_API_KEY) {
	elevenLabsClient = new ElevenLabsClient({
		apiKey: process.env.ELEVENLABS_API_KEY,
	});
	console.log("[OK] ElevenLabs API key loaded successfully.");
} else {
	console.warn(
		"[WARNING] ELEVENLABS_API_KEY not found in environment variables."
	);
}

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
			voice: "/api/voice/*",
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
			avatar: "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop",
		},
		createdAt: new Date("2024-01-01"),
	},
];

let posts = [
	{
		id: 1,
		userId: 1,
		content:
			"🚀 Just discovered the future of content creation with AI! The possibilities are endless when you combine creativity with technology. What's your take on AI-powered social media? #AI #ContentCreation #TechTrends",
		platform: "twitter",
		viralScore: 87,
		engagement: { likes: 342, retweets: 89, comments: 23, shares: 45 },
		hashtags: ["#AI", "#ContentCreation", "#TechTrends"],
		status: "published",
		scheduledFor: new Date(),
		createdAt: new Date("2024-01-15"),
		performance: { impressions: 12500, reach: 8900, clickThrough: 156 },
	},
	{
		id: 2,
		userId: 1,
		content:
			"💡 Hot take: The best social media strategy isn't about posting more—it's about posting smarter. Data-driven content creation is the game changer we've been waiting for! #SocialMediaStrategy #DataDriven #MarketingTips",
		platform: "twitter",
		viralScore: 92,
		engagement: { likes: 567, retweets: 143, comments: 67, shares: 89 },
		hashtags: ["#SocialMediaStrategy", "#DataDriven", "#MarketingTips"],
		status: "published",
		scheduledFor: new Date(Date.now() - 86400000),
		createdAt: new Date("2024-01-14"),
		performance: { impressions: 18300, reach: 14200, clickThrough: 234 },
	},
];

// Load supported locations for Twitter trends
let supportedLocations = [];
try {
	const locationsData = fs.readFileSync(path.join(process.cwd(), 'server', 'X_trends_supported_locations.json'), 'utf8');
	supportedLocations = JSON.parse(locationsData);
	console.log(`[OK] Loaded ${supportedLocations.length} supported locations for Twitter trends`);
} catch (error) {
	console.error('[ERROR] Failed to load supported locations:', error.message);
	// Fallback to default locations
	supportedLocations = [
		{ name: "Worldwide", woeid: 1 },
		{ name: "United States", woeid: 23424977 },
		{ name: "United Kingdom", woeid: 23424975 },
		{ name: "Canada", woeid: 23424775 }
	];
}

// Enhanced function to fetch trends from RapidAPI (Twitter only)
const fetchTrendsFromRapidAPI = async (platform = "twitter", location = "1") => {
	try {
		console.log(`Fetching REAL trends for platform: ${platform}, location: ${location} via RapidAPI`);

		// Only Twitter is supported via RapidAPI
		if (platform !== "twitter") {
			console.log(`Platform ${platform} not supported by RapidAPI - returning empty array`);
			return [];
		}

		const rapidApiKey = process.env.X_RapidAPI_Key;
		if (!rapidApiKey) {
			console.log("X_RapidAPI_Key not found - cannot fetch real data");
			return [];
		}

		const options = {
			method: 'GET',
			url: 'https://twitter-x.p.rapidapi.com/trends/',
			params: { woeid: location },
			headers: {
				'x-rapidapi-key': rapidApiKey,
				'x-rapidapi-host': 'twitter-x.p.rapidapi.com'
			}
		};

		console.log(`Calling RapidAPI with options:`, { ...options, headers: { ...options.headers, 'x-rapidapi-key': '[HIDDEN]' } });

		const response = await axios.request(options);
		const trendsData = response.data;

		if (!trendsData || !Array.isArray(trendsData.trends)) {
			console.log('No valid trends data received from RapidAPI:', trendsData);
			return [];
		}

		console.log(`Retrieved ${trendsData.trends.length} raw trends from RapidAPI for ${platform}`);

		// Transform RapidAPI data to our format
		const transformedTrends = trendsData.trends.map((trend, index) => {
			const keyword = trend.name || trend.query || 'Unknown';
			const volume = trend.tweet_volume || Math.floor(Math.random() * 50000) + 1000;
			
			return {
				id: index + 1,
				keyword: cleanKeyword(keyword),
				category: categorizeKeyword(keyword),
				trendScore: calculateTrendScore(volume, platform),
				volume: volume,
				growth: calculateGrowthFromVolume(volume),
				platforms: [platform],
				relatedHashtags: extractHashtagsFromText(keyword),
				peakTime: "14:00-16:00 UTC", // Default peak time
				demographics: {
					age: "18-34",
					interests: generateInterestsFromKeyword(keyword)
				}
			};
		});

		console.log(`Successfully transformed ${transformedTrends.length} REAL trends for ${platform}`);
		return transformedTrends;

	} catch (error) {
		console.error(`Error fetching trends from RapidAPI:`, {
			error: error.response?.data || error.message,
			platform,
			location,
			status: error.response?.status,
		});
		return [];
	}
};

// Helper functions for data processing
const cleanKeyword = (keyword) => {
	if (!keyword || typeof keyword !== "string") return "Unknown";
	const cleaned = keyword.replace(/[#@]/g, "").substring(0, 100).trim();
	return cleaned.length > 0 ? cleaned : "Unknown";
};

const categorizeKeyword = (keyword) => {
	const lowerKeyword = keyword.toLowerCase();
	
	if (lowerKeyword.includes('tech') || lowerKeyword.includes('ai') || lowerKeyword.includes('crypto')) {
		return 'Technology';
	} else if (lowerKeyword.includes('sport') || lowerKeyword.includes('game') || lowerKeyword.includes('football')) {
		return 'Sports';
	} else if (lowerKeyword.includes('music') || lowerKeyword.includes('movie') || lowerKeyword.includes('celebrity')) {
		return 'Entertainment';
	} else if (lowerKeyword.includes('politic') || lowerKeyword.includes('election') || lowerKeyword.includes('government')) {
		return 'Politics';
	} else if (lowerKeyword.includes('business') || lowerKeyword.includes('market') || lowerKeyword.includes('economy')) {
		return 'Business';
	}
	
	return 'General';
};

const generateInterestsFromKeyword = (keyword) => {
	const category = categorizeKeyword(keyword);
	const interestMap = {
		'Technology': ['innovation', 'startups', 'gadgets'],
		'Sports': ['athletics', 'competition', 'fitness'],
		'Entertainment': ['movies', 'music', 'celebrities'],
		'Politics': ['current events', 'governance', 'policy'],
		'Business': ['entrepreneurship', 'finance', 'marketing'],
		'General': ['trending topics', 'social media', 'culture']
	};
	
	return interestMap[category] || interestMap['General'];
};

const extractHashtagsFromText = (text) => {
	if (!text || typeof text !== "string") return [];
	const hashtagRegex = /#[\w]+/g;
	const matches = text.match(hashtagRegex) || [];
	
	// If no hashtags found, generate some based on the text
	if (matches.length === 0) {
		const words = text.split(' ').filter(word => word.length > 3);
		return words.slice(0, 3).map(word => `#${word.replace(/[^a-zA-Z0-9]/g, '')}`);
	}
	
	return matches.slice(0, 5);
};

const calculateGrowthFromVolume = (volume) => {
	if (!volume || volume === 0) return "+0%";
	if (volume > 100000) return "+50%";
	if (volume > 50000) return "+35%";
	if (volume > 10000) return "+25%";
	if (volume > 1000) return "+15%";
	return "+5%";
};

const calculateTrendScore = (volume, platform) => {
	if (!volume || volume === 0) return 50;

	let score = 50; // Base score

	switch (platform) {
		case "twitter":
			if (volume > 100000) score = 95;
			else if (volume > 50000) score = 85;
			else if (volume > 10000) score = 75;
			else if (volume > 1000) score = 65;
			break;
		default:
			score = Math.min(50 + volume / 1000, 95);
	}

	return Math.round(score);
};

// Enhanced AI Content Generation with Two-Step Process
const generateContentWithAI = async (
	topic,
	platform,
	tone,
	targetAudience,
	includeHashtags,
	isAnalysisOnly = false
) => {
	try {
		const platformConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;

		// Step 1: Trend Analysis
		const analysisPrompt = `Analyze the social media trend "${topic}". What is the core emotion, the key talking points, and the general sentiment? Provide a brief, one-sentence analysis focusing on why this topic is trending and what makes it engaging.`;
		
		console.log('Step 1: Analyzing trend...');
		const analysisResult = await model.generateContent(analysisPrompt);
		const trendAnalysis = analysisResult.response.text().trim();
		console.log('Trend Analysis:', trendAnalysis);

		// If only analysis is requested, return early
		if (isAnalysisOnly) {
			return { analysis: trendAnalysis };
		}

		// Step 2: Enhanced Content Generation with Viral Hooks
		const enhancedPrompt = createEnhancedSystemPrompt(
			topic,
			platform,
			tone,
			targetAudience,
			includeHashtags,
			trendAnalysis
		);

		console.log('Step 2: Generating viral content...');
		const result = await model.generateContent(enhancedPrompt);
		const response = await result.response;
		let content = response.text().trim();

		// Clean up any remaining unwanted prefixes or formatting
		content = content
			.replace(/^\*\*.*?\*\*\s*/g, "")
			.replace(/^Here's.*?:\s*/gi, "")
			.replace(/^Option \d+.*?:\s*/gi, "")
			.replace(/^\d+\.\s*/g, "")
			.replace(/^-\s*/g, "")
			.replace(/^\*\s*/g, "")
			.trim();

		// Ensure content doesn't exceed platform limits
		if (content.length > platformConfig.maxCharacters) {
			content = content.substring(0, platformConfig.maxCharacters - 3) + "...";
		}

		const viralScore = calculateEnhancedViralScore(content, platform, trendAnalysis);
		const hashtagRegex = /#[\w]+/g;
		const hashtags = content.match(hashtagRegex) || [];

		const recommendations = generatePlatformRecommendations(platform, topic, viralScore);

		return {
			content,
			viralScore,
			hashtags,
			platform,
			recommendations,
			trendAnalysis,
			platformOptimization: {
				characterCount: content.length,
				characterLimit: platformConfig.maxCharacters,
				hashtagCount: hashtags.length,
				optimalHashtags: platformConfig.optimalHashtags,
				visualSuggestions: getVisualSuggestions(platform),
				ctaSuggestions: getCTASuggestions(platform),
			},
		};
	} catch (error) {
		console.error("Error generating content with Gemini AI:", error);

		const platformConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;
		const fallbackContent = generateFallbackContent(topic, platform, tone, platformConfig);

		return fallbackContent;
	}
};

// Enhanced system prompt with viral hooks and trend analysis
const createEnhancedSystemPrompt = (topic, platform, tone, targetAudience, includeHashtags, trendAnalysis) => {
	const platformConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;

	return `You are TrendCraft AI, an expert viral content generator. Your ONLY job is to generate ONE piece of ready-to-publish content for ${platform}.

TREND ANALYSIS CONTEXT: ${trendAnalysis}

CRITICAL RULES - FOLLOW EXACTLY:
1. Generate ONLY the final content text - no explanations, no options, no meta-commentary
2. Do NOT include phrases like "Here's a post", "Option 1", "Tweet 1", "**Option**", or any similar introductory text
3. Do NOT provide multiple versions or choices - generate exactly ONE piece of content
4. Do NOT explain what you're doing or why
5. The response should be ONLY the content that can be directly posted to ${platform}
6. Maximum ${platformConfig.maxCharacters} characters - strictly enforce this limit
7. Use ${tone} tone throughout
8. Target audience: ${targetAudience || "general audience"}
9. ${includeHashtags ? `Include ${platformConfig.optimalHashtags} relevant hashtags` : "Do not include hashtags"}

VIRAL CONTENT HOOKS - Use ONE of these proven techniques:
- Bold Claims: "This will change everything you know about..."
- Surprising Statistics: "Did you know that 90% of people don't know..."
- Relatable Problems: "We've all been there when..."
- Curiosity Gaps: "The one thing about ${topic} that changed everything"
- Controversy: "Unpopular opinion:" or "Hot take:"
- Secrets: "The secret to ${topic} that nobody talks about"
- Urgency: "This is happening right now and you need to know"
- Personal Stories: "I used to think ${topic} was..."

VIRAL INDICATORS - Include these elements:
- Emotional words: amazing, incredible, mind-blowing, shocking, unbelievable
- Urgency words: now, today, immediately, breaking, just discovered
- Social proof: "everyone is talking about", "going viral", "trending"
- Numbers and specifics: exact percentages, timeframes, quantities

PLATFORM-SPECIFIC REQUIREMENTS FOR ${platform.toUpperCase()}:
${platform === "twitter" ? `
- Keep under 280 characters
- Be punchy and engaging
- Include 1-2 hashtags maximum if requested
- Use engaging questions or calls for interaction
- Consider emojis sparingly but effectively` : ""}

${platform === "linkedin" ? `
- Professional tone with personal insights
- Can be longer form (up to 3000 characters)
- Include 3-5 industry hashtags if requested
- Focus on value and professional growth
- Include professional experiences or lessons` : ""}

${platform === "instagram" ? `
- Visual-first approach
- Use 8-15 hashtags if requested
- Include emojis and line breaks for readability
- Focus on lifestyle and visual appeal
- Include "link in bio" style CTAs` : ""}

${platform === "facebook" ? `
- Community-focused content
- Can be longer form
- Use 1-3 hashtags if requested
- Focus on shareable, valuable content
- Encourage community interaction` : ""}

${platform === "tiktok" ? `
- Video-first content description
- Use 3-7 hashtags including trending ones if requested
- Focus on entertainment and trends
- Include challenge or duet CTAs
- Keep descriptions engaging and fun` : ""}

TOPIC: ${topic}

Generate the viral content now - ONLY the content, nothing else:`;
};

// Enhanced viral score calculation
const calculateEnhancedViralScore = (content, platform, trendAnalysis) => {
	let score = 50;
	const platformConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;

	// Content length optimization
	const contentLength = content.length;
	const optimalLength = platformConfig.maxCharacters * 0.7;

	if (contentLength <= optimalLength) {
		score += 10;
	} else if (contentLength <= platformConfig.maxCharacters) {
		score += 5;
	}

	// Viral indicators
	const viralWords = ['secret', 'truth', 'shocking', 'unbelievable', 'amazing', 'incredible', 'mind-blowing'];
	const emotionalWords = ['love', 'hate', 'excited', 'angry', 'surprised', 'happy', 'sad'];
	const urgencyWords = ['now', 'today', 'breaking', 'just', 'immediately', 'urgent'];

	viralWords.forEach(word => {
		if (content.toLowerCase().includes(word)) score += 3;
	});

	emotionalWords.forEach(word => {
		if (content.toLowerCase().includes(word)) score += 2;
	});

	urgencyWords.forEach(word => {
		if (content.toLowerCase().includes(word)) score += 2;
	});

	// Platform-specific bonuses
	switch (platform) {
		case "twitter":
			if (content.includes("?")) score += 8;
			if (content.match(/[🔥💡🚀✨⭐]/g)) score += 10;
			if (content.match(/\b(thread|🧵)\b/gi)) score += 5;
			break;
		case "linkedin":
			if (content.match(/\b(insight|experience|professional|career)\b/gi)) score += 8;
			if (content.includes("?")) score += 6;
			if (content.match(/\b(tips|advice|lessons)\b/gi)) score += 10;
			break;
		case "instagram":
			if (content.match(/[❤️😍🔥✨💯]/g)) score += 12;
			if (content.includes("link in bio")) score += 8;
			if (content.match(/\b(save|share|tag)\b/gi)) score += 6;
			break;
		case "facebook":
			if (content.match(/\b(share|community|family|friends)\b/gi)) score += 8;
			if (content.includes("?")) score += 7;
			break;
		case "tiktok":
			if (content.match(/\b(challenge|trend|viral|fyp)\b/gi)) score += 12;
			if (content.match(/[🔥💯✨🎵]/g)) score += 10;
			break;
	}

	// Hashtag bonus
	if (content.includes("#")) score += 6;

	// Viral content patterns
	if (content.match(/\b(new|breaking|exclusive|first)\b/gi)) score += 8;
	if (content.match(/\b(tips|secrets|hacks|tricks)\b/gi)) score += 10;

	// Trend analysis bonus
	if (trendAnalysis && trendAnalysis.length > 0) {
		score += 5; // Bonus for having trend analysis
	}

	return Math.min(score, 100);
};

// Platform configurations
const PLATFORM_CONFIGS = {
	twitter: {
		maxCharacters: 280,
		optimalHashtags: 2,
		maxHashtags: 5,
		visualEmphasis: "images_gifs",
		ctaStyle: "engagement_focused",
	},
	linkedin: {
		maxCharacters: 3000,
		optimalHashtags: 3,
		maxHashtags: 10,
		visualEmphasis: "professional_content",
		ctaStyle: "professional_networking",
	},
	instagram: {
		maxCharacters: 2200,
		optimalHashtags: 11,
		maxHashtags: 30,
		visualEmphasis: "high_quality_visuals",
		ctaStyle: "visual_engagement",
	},
	facebook: {
		maxCharacters: 63206,
		optimalHashtags: 2,
		maxHashtags: 10,
		visualEmphasis: "community_content",
		ctaStyle: "community_building",
	},
	tiktok: {
		maxCharacters: 2200,
		optimalHashtags: 5,
		maxHashtags: 20,
		visualEmphasis: "video_content",
		ctaStyle: "trend_participation",
	},
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
		},
	};

	switch (platform) {
		case "twitter":
			return {
				...baseRecommendations,
				threadSuggestion: "Consider creating a thread for more detailed insights",
				visualTip: "Add an eye-catching image or GIF to increase engagement by 150%",
			};
		case "linkedin":
			return {
				...baseRecommendations,
				networkingTip: "Tag relevant industry professionals to increase reach",
				professionalTip: "Share a personal experience to make it more relatable",
			};
		case "instagram":
			return {
				...baseRecommendations,
				visualTip: "High-quality visuals are essential - consider professional photography",
				storyTip: "Share behind-the-scenes content in Stories for authenticity",
			};
		case "facebook":
			return {
				...baseRecommendations,
				communityTip: "Post in relevant Facebook Groups to expand reach",
				engagementTip: "Ask questions to encourage comments and discussions",
			};
		case "tiktok":
			return {
				...baseRecommendations,
				videoTip: "Hook viewers in the first 3 seconds with a compelling opening",
				trendTip: "Use trending sounds to increase discoverability",
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
		tiktok: ["Vertical videos (9:16)", "Trending effects", "Text overlays", "Quick cuts"],
	};
	return suggestions[platform] || suggestions.twitter;
};

const getCTASuggestions = (platform) => {
	const ctas = {
		twitter: ["Retweet if you agree", "What's your take?", "Share your thoughts 👇", "Tag someone who needs this"],
		linkedin: ["Share your experience", "Connect for more insights", "What's your take on this?", "Follow for updates"],
		instagram: ["Link in bio", "Double tap if you agree ❤️", "Save for later", "Tag a friend", "Share to Stories"],
		facebook: ["Share if you agree", "Join our community", "What do you think?", "Like and share"],
		tiktok: ["Duet this", "Try this challenge", "Follow for more", "Which one are you?", "Comment below"],
	};
	return ctas[platform] || ctas.twitter;
};

const generateFallbackContent = (topic, platform, tone, platformConfig) => {
	const toneTemplates = {
		professional: [
			`Exploring the future of ${topic}. Key insights for professionals.`,
			`${topic} is transforming industries. Here's what leaders need to know.`,
			`Breaking down ${topic}: Strategic considerations for decision makers.`,
		],
		casual: [
			`Just discovered something cool about ${topic}! 🤔 What do you think?`,
			`${topic} is everywhere these days! Anyone else fascinated by this?`,
			`Hot take on ${topic}: It's changing everything and I'm here for it! 🔥`,
		],
		humorous: [
			`${topic} be like: "I'm about to change your whole career" 😅`,
			`Me trying to explain ${topic} to my friends: *gestures wildly* ✨`,
			`${topic} really said "hold my beer" to traditional methods 🍺`,
		],
	};

	const templates = toneTemplates[tone] || toneTemplates.professional;
	let content = templates[Math.floor(Math.random() * templates.length)];

	const ctas = getCTASuggestions(platform);
	const cta = ctas[Math.floor(Math.random() * ctas.length)];
	content += ` ${cta}`;

	const hashtagPool = [`#${topic.replace(/\s+/g, "")}`, "#Innovation", "#TechTrends", "#DigitalTransformation"];
	const selectedHashtags = hashtagPool.slice(0, platformConfig.optimalHashtags);
	content += ` ${selectedHashtags.join(" ")}`;

	if (content.length > platformConfig.maxCharacters) {
		content = content.substring(0, platformConfig.maxCharacters - 3) + "...";
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
			ctaSuggestions: getCTASuggestions(platform),
		},
	};
};

const getBestPostTime = (platform) => {
	const times = {
		twitter: "14:00-16:00 UTC",
		linkedin: "08:00-10:00 UTC",
		instagram: "11:00-13:00 UTC",
		facebook: "13:00-15:00 UTC",
		tiktok: "18:00-20:00 UTC",
		youtube: "19:00-21:00 UTC",
	};
	return times[platform] || "14:00-16:00 UTC";
};

// Posting Streak Data Store
let userStreaks = new Map();

// Initialize streak data for a user
const initializeUserStreak = (userId) => {
	if (!userStreaks.has(userId)) {
		const today = new Date();
		const streakData = [];
		
		// Generate last 30 days of data
		for (let i = 29; i >= 0; i--) {
			const date = new Date(today);
			date.setDate(date.getDate() - i);
			streakData.push({
				date: date.toISOString().split('T')[0],
				posted: Math.random() > 0.7, // 30% chance of posting
				postCount: Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0
			});
		}
		
		userStreaks.set(userId, {
			currentStreak: calculateCurrentStreak(streakData),
			longestStreak: calculateLongestStreak(streakData),
			lastPostDate: getLastPostDate(streakData),
			streakData
		});
	}
	return userStreaks.get(userId);
};

const calculateCurrentStreak = (streakData) => {
	let streak = 0;
	for (let i = streakData.length - 1; i >= 0; i--) {
		if (streakData[i].posted) {
			streak++;
		} else {
			break;
		}
	}
	return streak;
};

const calculateLongestStreak = (streakData) => {
	let maxStreak = 0;
	let currentStreak = 0;
	
	for (const day of streakData) {
		if (day.posted) {
			currentStreak++;
			maxStreak = Math.max(maxStreak, currentStreak);
		} else {
			currentStreak = 0;
		}
	}
	
	return maxStreak;
};

const getLastPostDate = (streakData) => {
	for (let i = streakData.length - 1; i >= 0; i--) {
		if (streakData[i].posted) {
			return streakData[i].date;
		}
	}
	return null;
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
	const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
		expiresIn: "24h",
	});
	res.json({
		token,
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			profile: user.profile,
		},
	});
});

// Enhanced Trends Routes with RapidAPI and location support
app.get("/api/trends", authenticateToken, async (req, res) => {
	try {
		const { platform = "twitter", limit = 20, location = "1" } = req.query;

		console.log(`API: Fetching REAL trends for platform: ${platform}, location: ${location}, limit: ${limit}`);

		// Fetch ONLY real data from RapidAPI for Twitter, empty for others
		let trends = await fetchTrendsFromRapidAPI(platform, location);

		// If no real data available, return empty array
		if (!trends || trends.length === 0) {
			console.log(`No real trends data available for ${platform} - returning empty array`);
			return res.json([]);
		}

		// Limit results
		const limitedTrends = trends.slice(0, parseInt(limit));

		console.log(`API: Returning ${limitedTrends.length} REAL trends for ${platform}`);
		res.json(limitedTrends);
	} catch (error) {
		console.error("Error in /api/trends:", error);
		res.status(500).json({ error: "Failed to fetch trends" });
	}
});

// Get supported locations for trends
app.get("/api/trends/locations", authenticateToken, (req, res) => {
	res.json(supportedLocations);
});

// Enhanced Content Routes with two-step AI generation
app.post("/api/content/generate", authenticateToken, async (req, res) => {
	const { topic, platform, tone, includeHashtags, targetAudience, isAnalysisOnly } = req.body;
	const generatedContent = await generateContentWithAI(
		topic,
		platform,
		tone,
		targetAudience,
		includeHashtags,
		isAnalysisOnly
	);
	res.json(generatedContent);
});

// Voice AI Routes (keeping existing implementation)
app.post("/api/voice/text-to-speech", authenticateToken, async (req, res) => {
	try {
		const { text, voice = "Rachel" } = req.body;

		if (!elevenLabsClient) {
			return res.status(500).json({ error: "ElevenLabs not configured" });
		}

		const audio = await elevenLabsClient.generate({
			voice,
			text,
			model_id: "eleven_monolingual_v1",
		});

		// Convert audio stream to base64
		const chunks = [];
		for await (const chunk of audio) {
			chunks.push(chunk);
		}
		const audioBuffer = Buffer.concat(chunks);
		const audioBase64 = audioBuffer.toString("base64");

		res.json({ audio: audioBase64 });
	} catch (error) {
		console.error("Error generating speech:", error);
		res.status(500).json({ error: "Failed to generate speech" });
	}
});

app.post("/api/voice/speech-to-text", authenticateToken, async (req, res) => {
	try {
		const { audio } = req.body;

		// For now, return a placeholder response
		// In a real implementation, you would use a speech-to-text service
		res.json({ text: "Speech-to-text functionality coming soon" });
	} catch (error) {
		console.error("Error transcribing speech:", error);
		res.status(500).json({ error: "Failed to transcribe speech" });
	}
});

// Posts Routes
app.get("/api/posts", authenticateToken, (req, res) => {
	const userPosts = posts.filter((p) => p.userId === req.user.id);
	res.json(userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Analytics Routes
app.get("/api/analytics/overview", authenticateToken, (req, res) => {
	const userPosts = posts.filter((p) => p.userId === req.user.id);
	const totalEngagement = userPosts.reduce(
		(sum, post) => sum + post.engagement.likes + post.engagement.retweets + post.engagement.comments,
		0
	);
	const totalImpressions = userPosts.reduce((sum, post) => sum + (post.performance?.impressions || 0), 0);
	const avgViralScore =
		userPosts.length > 0
			? userPosts.reduce((sum, post) => sum + post.viralScore, 0) / userPosts.length
			: 0;
	res.json({
		totalPosts: userPosts.length,
		totalEngagement,
		totalImpressions,
		avgViralScore: Math.round(avgViralScore),
		weeklyGrowth: "+12.5%",
		topPerformingPost: userPosts.sort((a, b) => b.viralScore - a.viralScore)[0] || null,
	});
});

app.get("/api/analytics/performance", authenticateToken, (req, res) => {
	const performanceData = [];
	const today = new Date();

	for (let i = 29; i >= 0; i--) {
		const date = new Date(today);
		date.setDate(date.getDate() - i);

		performanceData.push({
			date: date.toISOString().split("T")[0],
			impressions: Math.floor(Math.random() * 5000) + 1000,
			engagement: Math.floor(Math.random() * 500) + 100,
			clicks: Math.floor(Math.random() * 200) + 50,
			reach: Math.floor(Math.random() * 3000) + 800,
		});
	}

	res.json(performanceData);
});

// User Streak Routes
app.get("/api/user/streak", authenticateToken, (req, res) => {
	const streakData = initializeUserStreak(req.user.id);
	res.json(streakData);
});

app.post("/api/user/streak/update", authenticateToken, (req, res) => {
	const userId = req.user.id;
	const streakData = initializeUserStreak(userId);
	
	// Mark today as posted
	const today = new Date().toISOString().split('T')[0];
	const todayData = streakData.streakData.find(d => d.date === today);
	
	if (todayData) {
		todayData.posted = true;
		todayData.postCount += 1;
	} else {
		// Add today's data if not exists
		streakData.streakData.push({
			date: today,
			posted: true,
			postCount: 1
		});
	}
	
	// Recalculate streaks
	streakData.currentStreak = calculateCurrentStreak(streakData.streakData);
	streakData.longestStreak = calculateLongestStreak(streakData.streakData);
	streakData.lastPostDate = today;
	
	userStreaks.set(userId, streakData);
	res.json(streakData);
});

// Start server
app.listen(PORT, () => {
	console.log(`🚀 TrendCraft API server running on http://localhost:${PORT}`);
	console.log(`🎯 Frontend should run on: http://localhost:5173`);
	console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? "Configured" : "Not configured"}`);
	console.log(`🕷️ RapidAPI: ${process.env.X_RapidAPI_Key ? "Configured - REAL DATA ONLY" : "Not configured - NO FALLBACKS"}`);
	console.log(`🎤 ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? "Configured" : "Not configured"}`);
	console.log("✅ Server started successfully!");
});