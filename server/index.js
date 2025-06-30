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
import path from "path";
import os from "os";
import fs from "fs";
import { Buffer } from "buffer";
import fetch from "node-fetch";
import FormData from "form-data";
import FirecrawlApp from "@mendable/firecrawl-js";
import { supabase } from "./supabaseClient.js";
import Stripe from "stripe";

// Load environment variable
dotenv.config();

const app = express();
expressWs(app); // Initialize express-ws middleware
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

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

// Initialize Firecrawl client
let firecrawlClient = null;
if (process.env.FIRECRAWL_API_KEY) {
	firecrawlClient = new FirecrawlApp({
		apiKey: process.env.FIRECRAWL_API_KEY,
	});
	console.log("[OK] Firecrawl API key loaded successfully.");
} else {
	console.warn(
		"[WARNING] FIRECRAWL_API_KEY not found in environment variables."
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
			subscription: "/api/subscription",
			billing: "/api/billing/*",
		},
	});
});

// Load supported locations for Twitter trends
let supportedLocations = [];
try {
	const locationsData = fs.readFileSync(
		path.join(process.cwd(), "server", "X_trends_supported_locations.json"),
		"utf8"
	);
	supportedLocations = JSON.parse(locationsData);
	console.log(
		`[OK] Loaded ${supportedLocations.length} supported locations for Twitter trends`
	);
} catch (error) {
	console.error("[ERROR] Failed to load supported locations:", error.message);
	// Fallback to default locations
	supportedLocations = [
		{ name: "Worldwide", woeid: 1 },
		{ name: "United States", woeid: 23424977 },
		{ name: "United Kingdom", woeid: 23424975 },
		{ name: "Canada", woeid: 23424775 },
	];
}

// Function to get location name by woeid
const getLocationNameByWoeid = (woeid) => {
	const location = supportedLocations.find(
		(loc) => loc.woeid.toString() === woeid.toString()
	);
	return location ? location.name : "Worldwide";
};

// Enhanced function to search for trend context using Firecrawl
const searchTrendContext = async (topic, locationWoeid = "1") => {
	if (!firecrawlClient) {
		console.log("Firecrawl not configured - skipping context search");
		return null;
	}

	try {
		// Get location name from woeid
		const locationName = getLocationNameByWoeid(locationWoeid);

		console.log(
			`🔍 Searching for context: "${topic}" in location: ${locationName} (woeid: ${locationWoeid})`
		);

		// Create location-specific search query
		const searchQuery =
			locationName === "Worldwide"
				? `${topic} trending social media news`
				: `${topic} trending ${locationName} social media news`;

		const searchOptions = {
			limit: 5,
			tbs: "qdr:d", // Past 24 hours
			scrapeOptions: {
				formats: ["markdown"],
				extract: {
					schema: {
						type: "object",
						properties: {
							title: {
								type: "string",
								description: "The title of the article",
							},
							main_content: {
								type: "string",
								description: "The main content of the article",
							},
							summary: {
								type: "string",
								description: "A brief summary of the article",
							},
						},
						required: ["title", "main_content"],
					},
				},
			},
		};

		// Add location parameter if not worldwide
		if (locationName !== "Worldwide") {
			searchOptions.location = locationName;
		}

		const searchResult = await firecrawlClient.search(
			searchQuery,
			searchOptions
		);

		if (
			!searchResult ||
			!searchResult.data ||
			searchResult.data.length === 0
		) {
			console.log("No search results found from Firecrawl");
			return null;
		}

		// Process and summarize the search results
		const contextSummary = searchResult.data.map((result) => ({
			title: result.title || result.extract?.title || "No title",
			url: result.url || "",
			content: result.markdown
				? result.markdown.substring(0, 500)
				: (result.extract?.main_content || "No content").substring(
						0,
						500
				  ),
			extract: result.extract || {},
		}));

		console.log(
			`✅ Found ${contextSummary.length} context sources for "${topic}" in ${locationName}`
		);

		return {
			topic,
			location: locationName,
			sources: contextSummary,
			searchQuery,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		console.error("Error searching for trend context:", error);
		return null;
	}
};

// Enhanced function to fetch trends from RapidAPI (Twitter only)
const fetchTrendsFromRapidAPI = async (
	platform = "twitter",
	location = "1"
) => {
	try {
		console.log(
			`Fetching REAL trends for platform: ${platform}, location: ${location} via RapidAPI`
		);

		// Only Twitter is supported via RapidAPI
		if (platform !== "twitter") {
			console.log(
				`Platform ${platform} not supported by RapidAPI - returning empty array`
			);
			return [];
		}

		const rapidApiKey = process.env.X_RapidAPI_Key;
		if (!rapidApiKey) {
			console.log("X_RapidAPI_Key not found - cannot fetch real data");
			return [];
		}

		const options = {
			method: "GET",
			url: "https://twitter-x.p.rapidapi.com/trends/",
			params: { woeid: location },
			headers: {
				"x-rapidapi-key": rapidApiKey,
				"x-rapidapi-host": "twitter-x.p.rapidapi.com",
			},
		};

		console.log(`Calling RapidAPI with options:`, {
			...options,
			headers: { ...options.headers, "x-rapidapi-key": "[HIDDEN]" },
		});

		const response = await axios.request(options);
		const apiData = response.data;

		console.log("Raw API response structure:", {
			isArray: Array.isArray(apiData),
			length: apiData?.length,
			firstItemKeys: apiData?.[0] ? Object.keys(apiData[0]) : "N/A",
			trendsLength: apiData?.[0]?.trends?.length || "N/A",
		});

		// Extract trends from the nested structure
		// API returns: [{ trends: [...], as_of: "...", created_at: "...", locations: [...] }]
		if (!Array.isArray(apiData) || apiData.length === 0) {
			console.log("Invalid API response structure:", apiData);
			return [];
		}

		const trendsContainer = apiData[0];
		if (!trendsContainer || !Array.isArray(trendsContainer.trends)) {
			console.log(
				"No trends array found in API response:",
				trendsContainer
			);
			return [];
		}

		const rawTrends = trendsContainer.trends;
		const asOfTime = trendsContainer.as_of; // Get the actual timestamp from API

		console.log(
			`Retrieved ${rawTrends.length} raw trends from RapidAPI for ${platform}`
		);
		console.log("Sample trend data:", rawTrends.slice(0, 3));
		console.log("Trends as_of time:", asOfTime);

		// Transform RapidAPI data to our format
		const transformedTrends = rawTrends.map((trend, index) => {
			const keyword = trend.name || trend.query || "Unknown";
			// Use actual tweet_volume from API, fallback to 0 if null
			const volume = trend.tweet_volume || 0;

			console.log(
				`Processing trend ${
					index + 1
				}: "${keyword}" with volume: ${volume}`
			);

			return {
				id: index + 1,
				keyword: cleanKeyword(keyword),
				category: categorizeKeyword(keyword),
				trendScore: calculateTrendScore(volume, platform),
				volume: volume,
				growth: calculateGrowthFromVolume(volume),
				platforms: [platform],
				relatedHashtags: extractHashtagsFromText(keyword),
				peakTime: formatPeakTime(asOfTime), // Use dynamic time from API
				demographics: {
					age: "18-34",
					interests: generateInterestsFromKeyword(keyword),
				},
			};
		});

		// Filter out trends with "Unknown" keywords
		const validTrends = transformedTrends.filter(
			(trend) =>
				trend.keyword &&
				trend.keyword !== "Unknown" &&
				trend.keyword.length > 0
		);

		console.log(
			`Successfully transformed ${validTrends.length} valid trends for ${platform}`
		);
		return validTrends;
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

// Function to store trends in database
const storeTrendsInDatabase = async (trends, platform, location) => {
	try {
		const locationName = getLocationNameByWoeid(location);
		
		for (const trend of trends) {
			const { error } = await supabase
				.from('trends')
				.upsert({
					keyword: trend.keyword,
					platform: platform,
					location_woeid: location.toString(),
					location_name: locationName,
					category: trend.category,
					trend_score: trend.trendScore,
					volume: trend.volume,
					growth_percentage: trend.growth,
					related_hashtags: trend.relatedHashtags,
					peak_time: trend.peakTime,
					demographics: trend.demographics,
					expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
				}, {
					onConflict: 'keyword,platform,location_woeid'
				});
			
			if (error) {
				console.error('Error storing trend in database:', error);
			}
		}
		
		console.log(`✅ Stored ${trends.length} trends in database for ${platform} - ${locationName}`);
	} catch (error) {
		console.error('Error storing trends in database:', error);
	}
};

// Function to get trends from database
const getTrendsFromDatabase = async (platform, location, limit = 20) => {
	try {
		const { data, error } = await supabase
			.from('trends')
			.select('*')
			.eq('platform', platform)
			.eq('location_woeid', location.toString())
			.gt('expires_at', new Date().toISOString())
			.order('trend_score', { ascending: false })
			.limit(limit);

		if (error) {
			console.error('Error fetching trends from database:', error);
			return [];
		}

		if (!data || data.length === 0) {
			console.log(`No cached trends found in database for ${platform} - ${location}`);
			return [];
		}

		// Transform database data to frontend format
		const transformedTrends = data.map((trend, index) => ({
			id: index + 1,
			keyword: trend.keyword,
			category: trend.category,
			trendScore: trend.trend_score,
			volume: trend.volume,
			growth: trend.growth_percentage,
			platforms: [trend.platform],
			relatedHashtags: trend.related_hashtags || [],
			peakTime: trend.peak_time,
			demographics: trend.demographics || { age: "18-34", interests: [] },
		}));

		console.log(`✅ Retrieved ${transformedTrends.length} cached trends from database`);
		return transformedTrends;
	} catch (error) {
		console.error('Error getting trends from database:', error);
		return [];
	}
};

// Helper function to format peak time from API timestamp
const formatPeakTime = (asOfTime) => {
	if (!asOfTime) {
		return "14:00-16:00 UTC"; // Fallback
	}

	try {
		const date = new Date(asOfTime);
		const hours = date.getUTCHours();
		const startHour = String(hours).padStart(2, "0");
		const endHour = String((hours + 2) % 24).padStart(2, "0");
		return `${startHour}:00-${endHour}:00 UTC`;
	} catch (error) {
		console.error("Error formatting peak time:", error);
		return "14:00-16:00 UTC"; // Fallback
	}
};

// Helper functions for data processing
const cleanKeyword = (keyword) => {
	if (!keyword || typeof keyword !== "string") return null;

	// Remove URL encoding and clean up the keyword
	let cleaned = decodeURIComponent(keyword);

	// Remove hashtags and @ symbols for cleaner display
	cleaned = cleaned.replace(/^[#@]+/, "");

	// Limit length and trim
	cleaned = cleaned.substring(0, 100).trim();

	return cleaned.length > 0 ? cleaned : null;
};

const categorizeKeyword = (keyword) => {
	const lowerKeyword = keyword.toLowerCase();

	if (
		lowerKeyword.includes("tech") ||
		lowerKeyword.includes("ai") ||
		lowerKeyword.includes("crypto") ||
		lowerKeyword.includes("cyber")
	) {
		return "Technology";
	} else if (
		lowerKeyword.includes("sport") ||
		lowerKeyword.includes("game") ||
		lowerKeyword.includes("football") ||
		lowerKeyword.includes("olympic")
	) {
		return "Sports";
	} else if (
		lowerKeyword.includes("music") ||
		lowerKeyword.includes("movie") ||
		lowerKeyword.includes("celebrity") ||
		lowerKeyword.includes("birthday")
	) {
		return "Entertainment";
	} else if (
		lowerKeyword.includes("politic") ||
		lowerKeyword.includes("election") ||
		lowerKeyword.includes("government")
	) {
		return "Politics";
	} else if (
		lowerKeyword.includes("business") ||
		lowerKeyword.includes("market") ||
		lowerKeyword.includes("economy")
	) {
		return "Business";
	} else if (
		lowerKeyword.includes("news") ||
		lowerKeyword.includes("breaking")
	) {
		return "News";
	}

	return "General";
};

const generateInterestsFromKeyword = (keyword) => {
	const category = categorizeKeyword(keyword);
	const interestMap = {
		Technology: ["innovation", "startups", "gadgets"],
		Sports: ["athletics", "competition", "fitness"],
		Entertainment: ["movies", "music", "celebrities"],
		Politics: ["current events", "governance", "policy"],
		Business: ["entrepreneurship", "finance", "marketing"],
		News: ["current events", "breaking news", "journalism"],
		General: ["trending topics", "social media", "culture"],
	};

	return interestMap[category] || interestMap["General"];
};

const extractHashtagsFromText = (text) => {
	if (!text || typeof text !== "string") return [];

	// First, try to find existing hashtags
	const hashtagRegex = /#[\w]+/g;
	const matches = text.match(hashtagRegex) || [];

	// If hashtags found, return them
	if (matches.length > 0) {
		return matches.slice(0, 5);
	}

	// If no hashtags found, generate some based on the text
	const words = text
		.split(" ")
		.filter((word) => word.length > 3)
		.filter((word) => !word.includes("http"))
		.filter((word) => !/^\d+$/.test(word)); // Remove pure numbers

	return words
		.slice(0, 3)
		.map((word) => `#${word.replace(/[^a-zA-Z0-9]/g, "")}`);
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
			else if (volume > 0) score = 55;
			break;
		default:
			score = Math.min(50 + volume / 1000, 95);
	}

	return Math.round(score);
};

// Enhanced AI Content Generation with Three-Step Process
const generateContentWithAI = async (
	topic,
	platform,
	tone,
	targetAudience,
	includeHashtags,
	isAnalysisOnly = false,
	locationWoeid = "1" // Add location parameter
) => {
	try {
		const platformConfig =
			PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;

		// Step 1: Search for real-world context using Firecrawl (if available)
		let contextData = null;
		if (firecrawlClient && !isAnalysisOnly) {
			console.log("Step 1: Searching for trend context...");
			contextData = await searchTrendContext(topic, locationWoeid);
		}

		// Step 2: Trend Analysis with context
		const locationName = getLocationNameByWoeid(locationWoeid);
		let analysisPrompt = `Analyze the social media trend "${topic}"`;

		if (contextData && contextData.sources.length > 0) {
			analysisPrompt += ` based on these recent sources from ${contextData.location}:\n\n`;
			contextData.sources.forEach((source, index) => {
				analysisPrompt += `Source ${index + 1}: ${
					source.title
				}\n${source.content.substring(0, 200)}...\n\n`;
			});
			analysisPrompt += `What is the core emotion, the key talking points, and the general sentiment around "${topic}" in ${contextData.location}? Provide a brief, one-sentence analysis focusing on why this topic is trending and what makes it engaging.`;
		} else {
			analysisPrompt += ` in ${locationName}. What is the core emotion, the key talking points, and the general sentiment? Provide a brief, one-sentence analysis focusing on why this topic is trending and what makes it engaging.`;
		}

		console.log("Step 2: Analyzing trend with context...");
		const analysisResult = await model.generateContent(analysisPrompt);
		const trendAnalysis = analysisResult.response.text().trim();
		console.log("Trend Analysis:", trendAnalysis);

		// If only analysis is requested, return early
		if (isAnalysisOnly) {
			return { analysis: trendAnalysis, context: contextData };
		}

		// Step 3: Enhanced Content Generation with Viral Hooks and Context
		const enhancedPrompt = createEnhancedSystemPrompt(
			topic,
			platform,
			tone,
			targetAudience,
			includeHashtags,
			trendAnalysis,
			contextData,
			locationName
		);

		console.log("Step 3: Generating viral content with context...");
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
			content =
				content.substring(0, platformConfig.maxCharacters - 3) + "...";
		}

		const viralScore = calculateEnhancedViralScore(
			content,
			platform,
			trendAnalysis,
			contextData
		);
		const hashtagRegex = /#[\w]+/g;
		const hashtags = content.match(hashtagRegex) || [];

		const recommendations = generatePlatformRecommendations(
			platform,
			topic,
			viralScore
		);

		return {
			content,
			viralScore,
			hashtags,
			platform,
			recommendations,
			trendAnalysis,
			contextData,
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

		const platformConfig =
			PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;
		const fallbackContent = generateFallbackContent(
			topic,
			platform,
			tone,
			platformConfig
		);

		return fallbackContent;
	}
};

// Enhanced system prompt with viral hooks, trend analysis, and real-world context
const createEnhancedSystemPrompt = (
	topic,
	platform,
	tone,
	targetAudience,
	includeHashtags,
	trendAnalysis,
	contextData,
	locationName
) => {
	const platformConfig =
		PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;

	let contextSection = "";
	if (contextData && contextData.sources.length > 0) {
		contextSection = `
REAL-WORLD CONTEXT FROM ${contextData.location.toUpperCase()}:
${contextData.sources
	.map(
		(source, index) =>
			`• ${source.title}: ${source.content.substring(0, 150)}...`
	)
	.join("\n")}

`;
	}

	return `You are TrendCraft AI, an expert viral content generator. Your ONLY job is to generate ONE piece of ready-to-publish content for ${platform}.

TREND ANALYSIS CONTEXT: ${trendAnalysis}

${contextSection}LOCATION CONTEXT: This content is for ${locationName} audience. Consider local culture, language nuances, and regional relevance.

CRITICAL RULES - FOLLOW EXACTLY:
1. Generate ONLY the final content text - no explanations, no options, no meta-commentary
2. Do NOT include phrases like "Here's a post", "Option 1", "Tweet 1", "**Option**", or any similar introductory text
3. Do NOT provide multiple versions or choices - generate exactly ONE piece of content
4. Do NOT explain what you're doing or why
5. The response should be ONLY the content that can be directly posted to ${platform}
6. Maximum ${
		platformConfig.maxCharacters
	} characters - strictly enforce this limit
7. Use ${tone} tone throughout
8. Target audience: ${targetAudience || "general audience"}
9. ${
		includeHashtags
			? `Include ${platformConfig.optimalHashtags} relevant hashtags`
			: "Do not include hashtags"
	}

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
${
	platform === "twitter"
		? `
- Keep under 280 characters
- Be punchy and engaging
- Include 1-2 hashtags maximum if requested
- Use engaging questions or calls for interaction
- Consider emojis sparingly but effectively`
		: ""
}

${
	platform === "linkedin"
		? `
- Professional tone with personal insights
- Can be longer form (up to 3000 characters)
- Include 3-5 industry hashtags if requested
- Focus on value and professional growth
- Include professional experiences or lessons`
		: ""
}

${
	platform === "instagram"
		? `
- Visual-first approach
- Use 8-15 hashtags if requested
- Include emojis and line breaks for readability
- Focus on lifestyle and visual appeal
- Include "link in bio" style CTAs`
		: ""
}

${
	platform === "facebook"
		? `
- Community-focused content
- Can be longer form
- Use 1-3 hashtags if requested
- Focus on shareable, valuable content
- Encourage community interaction`
		: ""
}

${
	platform === "tiktok"
		? `
- Video-first content description
- Use 3-7 hashtags including trending ones if requested
- Focus on entertainment and trends
- Include challenge or duet CTAs
- Keep descriptions engaging and fun`
		: ""
}

TOPIC: ${topic}
LOCATION: ${locationName}

Generate the viral content now - ONLY the content, nothing else:`;
};

// Enhanced viral score calculation with context bonus
const calculateEnhancedViralScore = (
	content,
	platform,
	trendAnalysis,
	contextData
) => {
	let score = 50;
	const platformConfig =
		PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;

	// Content length optimization
	const contentLength = content.length;
	const optimalLength = platformConfig.maxCharacters * 0.7;

	if (contentLength <= optimalLength) {
		score += 10;
	} else if (contentLength <= platformConfig.maxCharacters) {
		score += 5;
	}

	// Viral indicators
	const viralWords = [
		"secret",
		"truth",
		"shocking",
		"unbelievable",
		"amazing",
		"incredible",
		"mind-blowing",
	];
	const emotionalWords = [
		"love",
		"hate",
		"excited",
		"angry",
		"surprised",
		"happy",
		"sad",
	];
	const urgencyWords = [
		"now",
		"today",
		"breaking",
		"just",
		"immediately",
		"urgent",
	];

	viralWords.forEach((word) => {
		if (content.toLowerCase().includes(word)) score += 3;
	});

	emotionalWords.forEach((word) => {
		if (content.toLowerCase().includes(word)) score += 2;
	});

	urgencyWords.forEach((word) => {
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
			if (content.match(/\b(insight|experience|professional|career)\b/gi))
				score += 8;
			if (content.includes("?")) score += 6;
			if (content.match(/\b(tips|advice|lessons)\b/gi)) score += 10;
			break;
		case "instagram":
			if (content.match(/[❤️😍🔥✨💯]/g)) score += 12;
			if (content.includes("link in bio")) score += 8;
			if (content.match(/\b(save|share|tag)\b/gi)) score += 6;
			break;
		case "facebook":
			if (content.match(/\b(share|community|family|friends)\b/gi))
				score += 8;
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

	// Context bonus - if we have real-world context, boost the score
	if (contextData && contextData.sources && contextData.sources.length > 0) {
		score += 10; // Bonus for having real-world context
		console.log("Applied context bonus: +10 points");
	}

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
				threadSuggestion:
					"Consider creating a thread for more detailed insights",
				visualTip:
					"Add an eye-catching image or GIF to increase engagement by 150%",
			};
		case "linkedin":
			return {
				...baseRecommendations,
				networkingTip:
					"Tag relevant industry professionals to increase reach",
				professionalTip:
					"Share a personal experience to make it more relatable",
			};
		case "instagram":
			return {
				...baseRecommendations,
				visualTip:
					"High-quality visuals are essential - consider professional photography",
				storyTip:
					"Share behind-the-scenes content in Stories for authenticity",
			};
		case "facebook":
			return {
				...baseRecommendations,
				communityTip:
					"Post in relevant Facebook Groups to expand reach",
				engagementTip:
					"Ask questions to encourage comments and discussions",
			};
		case "tiktok":
			return {
				...baseRecommendations,
				videoTip:
					"Hook viewers in the first 3 seconds with a compelling opening",
				trendTip: "Use trending sounds to increase discoverability",
			};
		default:
			return baseRecommendations;
	}
};

const getVisualSuggestions = (platform) => {
	const suggestions = {
		twitter: [
			"Eye-catching images",
			"GIFs",
			"Charts/infographics",
			"Short videos",
		],
		linkedin: [
			"Professional headshots",
			"Industry infographics",
			"Behind-the-scenes",
			"Carousel posts",
		],
		instagram: [
			"High-quality photos",
			"Consistent filters",
			"Carousel posts",
			"Reels",
			"Stories",
		],
		facebook: [
			"Engaging images",
			"User-generated content",
			"Facebook Live",
			"Event photos",
		],
		tiktok: [
			"Vertical videos (9:16)",
			"Trending effects",
			"Text overlays",
			"Quick cuts",
		],
	};
	return suggestions[platform] || suggestions.twitter;
};

const getCTASuggestions = (platform) => {
	const ctas = {
		twitter: [
			"Retweet if you agree",
			"What's your take?",
			"Share your thoughts 👇",
			"Tag someone who needs this",
		],
		linkedin: [
			"Share your experience",
			"Connect for more insights",
			"What's your take on this?",
			"Follow for updates",
		],
		instagram: [
			"Link in bio",
			"Double tap if you agree ❤️",
			"Save for later",
			"Tag a friend",
			"Share to Stories",
		],
		facebook: [
			"Share if you agree",
			"Join our community",
			"What do you think?",
			"Like and share",
		],
		tiktok: [
			"Duet this",
			"Try this challenge",
			"Follow for more",
			"Which one are you?",
			"Comment below",
		],
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

	const hashtagPool = [
		`#${topic.replace(/\s+/g, "")}`,
		"#Innovation",
		"#TechTrends",
		"#DigitalTransformation",
	];
	const selectedHashtags = hashtagPool.slice(
		0,
		platformConfig.optimalHashtags
	);
	content += ` ${selectedHashtags.join(" ")}`;

	if (content.length > platformConfig.maxCharacters) {
		content =
			content.substring(0, platformConfig.maxCharacters - 3) + "...";
	}

	const viralScore = Math.floor(Math.random() * 30) + 70;

	return {
		content,
		viralScore,
		hashtags: selectedHashtags,
		platform,
		recommendations: generatePlatformRecommendations(
			platform,
			topic,
			viralScore
		),
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

// Helper function to get or create user subscription
const getUserSubscription = async (userId) => {
	try {
		const { data, error } = await supabase
			.from('subscriptions')
			.select('*')
			.eq('user_id', userId)
			.single();

		if (error && error.code !== 'PGRST116') {
			console.error('Error fetching subscription:', error);
			return null;
		}

		if (!data) {
			// Create default free subscription
			const { data: newSub, error: createError } = await supabase
				.from('subscriptions')
				.insert({
					user_id: userId,
					plan: 'free',
					status: 'active'
				})
				.select()
				.single();

			if (createError) {
				console.error('Error creating subscription:', createError);
				return null;
			}

			return newSub;
		}

		return data;
	} catch (error) {
		console.error('Error in getUserSubscription:', error);
		return null;
	}
};

// Helper function to get or create user usage
const getUserUsage = async (userId) => {
	try {
		const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
		
		const { data, error } = await supabase
			.from('usage_tracking')
			.select('*')
			.eq('user_id', userId)
			.eq('month', currentMonth)
			.single();

		if (error && error.code !== 'PGRST116') {
			console.error('Error fetching usage:', error);
			return null;
		}

		if (!data) {
			// Create default usage record
			const { data: newUsage, error: createError } = await supabase
				.from('usage_tracking')
				.insert({
					user_id: userId,
					month: currentMonth,
					posts_generated: 0,
					images_generated: 0,
					videos_generated: 0
				})
				.select()
				.single();

			if (createError) {
				console.error('Error creating usage:', createError);
				return null;
			}

			return newUsage;
		}

		return data;
	} catch (error) {
		console.error('Error in getUserUsage:', error);
		return null;
	}
};

// Health check endpoint
app.get("/api/health", (req, res) => {
	res.json({ status: "OK", message: "TrendCraft API is running" });
});

// Email/password login using Supabase
app.post("/api/auth/login", async (req, res) => {
	const { email, password } = req.body;
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});
	if (error) return res.status(401).json({ error: error.message });
	// Fetch user profile
	const { data: userProfile, error: userError } = await supabase
		.from("users")
		.select("*")
		.eq("id", data.user.id)
		.single();
	if (userError) return res.status(500).json({ error: userError.message });
	res.json({ token: data.session.access_token, user: userProfile });
});

// Registration using Supabase
app.post("/api/auth/register", async (req, res) => {
	const { username, email, password } = req.body;
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: { data: { username } },
	});
	if (error) return res.status(400).json({ error: error.message });
	// Create user profile in 'users' table
	await supabase
		.from("users")
		.insert([{ id: data.user.id, email, username }]);
	res.json({
		token: data.session?.access_token,
		user: { id: data.user.id, email, username },
	});
});

// Social OAuth login (Google, Twitter, Facebook)
app.get("/api/auth/oauth/:provider", async (req, res) => {
	const { provider } = req.params;
	const redirectTo = req.query.redirectTo || "http://localhost:5173";
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider,
		options: { redirectTo },
	});
	if (error) return res.status(400).json({ error: error.message });
	res.redirect(data.url);
});

// Enhanced Trends Routes with database caching and API fallback
app.get("/api/trends", authenticateToken, async (req, res) => {
	try {
		const { platform = "twitter", limit = 20, location = "1" } = req.query;

		console.log(
			`API: Fetching trends for platform: ${platform}, location: ${location}, limit: ${limit}`
		);

		// Step 1: Try to get trends from database first
		let trends = await getTrendsFromDatabase(platform, location, parseInt(limit));

		// Step 2: If no cached trends found, fetch from external API and cache them
		if (!trends || trends.length === 0) {
			console.log('No cached trends found, fetching from external API...');
			
			// Fetch from external API
			const apiTrends = await fetchTrendsFromRapidAPI(platform, location);
			
			if (apiTrends && apiTrends.length > 0) {
				// Store in database for future requests
				await storeTrendsInDatabase(apiTrends, platform, location);
				trends = apiTrends.slice(0, parseInt(limit));
			} else {
				trends = [];
			}
		}

		console.log(
			`API: Returning ${trends.length} trends for ${platform}`
		);
		res.json(trends);
	} catch (error) {
		console.error("Error in /api/trends:", error);
		res.status(500).json({ error: "Failed to fetch trends" });
	}
});

// Get supported locations for trends
app.get("/api/trends/locations", authenticateToken, (req, res) => {
	res.json(supportedLocations);
});

// Enhanced Content Routes with three-step AI generation and location context
app.post("/api/content/generate", authenticateToken, async (req, res) => {
	const {
		topic,
		platform,
		tone,
		includeHashtags,
		targetAudience,
		isAnalysisOnly,
		locationWoeid,
	} = req.body;
	
	try {
		// Check usage limits for free users
		const subscription = await getUserSubscription(req.user.id);
		const usage = await getUserUsage(req.user.id);
		
		if (subscription?.plan === 'free' && usage?.posts_generated >= 10) {
			return res.status(403).json({ 
				error: "Monthly post limit reached. Upgrade to Pro for unlimited posts.",
				code: "USAGE_LIMIT_EXCEEDED"
			});
		}
		
		const generatedContent = await generateContentWithAI(
			topic,
			platform,
			tone,
			targetAudience,
			includeHashtags,
			isAnalysisOnly,
			locationWoeid
		);
		
		// Update usage count if not analysis only
		if (!isAnalysisOnly && usage) {
			await supabase
				.from('usage_tracking')
				.update({ 
					posts_generated: usage.posts_generated + 1 
				})
				.eq('id', usage.id);
		}
		
		res.json(generatedContent);
	} catch (error) {
		console.error('Error generating content:', error);
		res.status(500).json({ error: "Failed to generate content" });
	}
});

// Media generation endpoints
app.post("/api/generate-image", authenticateToken, async (req, res) => {
	try {
		const { prompt } = req.body;
		
		// Check if user has premium access
		const subscription = await getUserSubscription(req.user.id);
		if (subscription?.plan !== 'pro') {
			return res.status(403).json({ 
				error: "Image generation requires Pro subscription",
				code: "PREMIUM_REQUIRED"
			});
		}
		
		// TODO: Implement Google AI image generation
		// For now, return a placeholder
		res.json({
			image_url: 'https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop',
			prompt: prompt
		});
	} catch (error) {
		console.error('Error generating image:', error);
		res.status(500).json({ error: "Failed to generate image" });
	}
});

app.post("/api/generate-video", authenticateToken, async (req, res) => {
	try {
		const { script, background_url, replica_id, video_name } = req.body;
		
		// Check if user has premium access
		const subscription = await getUserSubscription(req.user.id);
		if (subscription?.plan !== 'pro') {
			return res.status(403).json({ 
				error: "Video generation requires Pro subscription",
				code: "PREMIUM_REQUIRED"
			});
		}
		
		// Tavus AI API call
		const options = {
			method: 'POST',
			headers: {
				'x-api-key': process.env.TAVUS_API_KEY || '',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				background_url: background_url || "",
				replica_id: replica_id || "",
				script: script,
				video_name: video_name || `video_${Date.now()}`
			})
		};

		const response = await fetch('https://tavusapi.com/v2/videos', options);
		const data = await response.json();
		
		if (response.ok) {
			res.json(data);
		} else {
			// Return placeholder for now
			res.json({
				video_url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
				video_id: `placeholder_${Date.now()}`
			});
		}
	} catch (error) {
		console.error('Error generating video:', error);
		res.status(500).json({ error: "Failed to generate video" });
	}
});

// Subscription management endpoints
app.get("/api/subscription", authenticateToken, async (req, res) => {
	try {
		const subscription = await getUserSubscription(req.user.id);
		res.json(subscription);
	} catch (error) {
		console.error('Error fetching subscription:', error);
		res.status(500).json({ error: "Failed to fetch subscription" });
	}
});

app.get("/api/usage", authenticateToken, async (req, res) => {
	try {
		const usage = await getUserUsage(req.user.id);
		res.json(usage);
	} catch (error) {
		console.error('Error fetching usage:', error);
		res.status(500).json({ error: "Failed to fetch usage" });
	}
});

// Stripe checkout session
app.post("/api/create-checkout-session", authenticateToken, async (req, res) => {
	try {
		const { plan } = req.body;
		
		if (plan !== 'pro') {
			return res.status(400).json({ error: "Invalid plan" });
		}
		
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: [
				{
					price_data: {
						currency: 'usd',
						product_data: {
							name: 'TrendCraft Pro',
							description: 'Unlimited posts, AI image/video generation, voice chat, and more',
						},
						unit_amount: 2900, // $29.00
						recurring: {
							interval: 'month',
						},
					},
					quantity: 1,
				},
			],
			mode: 'subscription',
			success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/generate`,
			client_reference_id: req.user.id,
			metadata: {
				user_id: req.user.id,
				plan: plan
			}
		});

		res.json({ url: session.url });
	} catch (error) {
		console.error('Error creating checkout session:', error);
		res.status(500).json({ error: "Failed to create checkout session" });
	}
});

// Stripe billing portal
app.post("/api/billing-portal", authenticateToken, async (req, res) => {
	try {
		const subscription = await getUserSubscription(req.user.id);
		
		if (!subscription?.stripe_customer_id) {
			return res.status(400).json({ error: "No customer found" });
		}
		
		const session = await stripe.billingPortal.sessions.create({
			customer: subscription.stripe_customer_id,
			return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings`,
		});

		res.json({ url: session.url });
	} catch (error) {
		console.error('Error creating billing portal session:', error);
		res.status(500).json({ error: "Failed to create billing portal session" });
	}
});

// Stripe webhook
app.post("/api/stripe-webhook", express.raw({ type: 'application/json' }), async (req, res) => {
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
		res.status(500).json({ error: "Webhook handler failed" });
	}
});

const handleCheckoutCompleted = async (session) => {
	const userId = session.client_reference_id;
	const customerId = session.customer;
	const subscriptionId = session.subscription;

	await supabase
		.from('subscriptions')
		.upsert({
			user_id: userId,
			stripe_customer_id: customerId,
			stripe_subscription_id: subscriptionId,
			plan: 'pro',
			status: 'active'
		}, {
			onConflict: 'user_id'
		});
};

const handleSubscriptionChange = async (subscription) => {
	await supabase
		.from('subscriptions')
		.update({
			status: subscription.status,
			current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
			current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
			cancel_at_period_end: subscription.cancel_at_period_end
		})
		.eq('stripe_subscription_id', subscription.id);
};

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
app.get("/api/posts", authenticateToken, async (req, res) => {
	const { data, error } = await supabase
		.from("posts")
		.select("*")
		.eq("user_id", req.user.id)
		.order("created_at", { ascending: false });
	if (error) return res.status(500).json({ error: error.message });
	res.json(data);
});

app.post("/api/posts", authenticateToken, async (req, res) => {
	const post = { ...req.body, user_id: req.user.id };
	const { data, error } = await supabase
		.from("posts")
		.insert([post])
		.select("*")
		.single();
	if (error) return res.status(500).json({ error: error.message });
	res.json(data);
});

app.put("/api/posts/:id", authenticateToken, async (req, res) => {
	const { id } = req.params;
	const { data, error } = await supabase
		.from("posts")
		.update(req.body)
		.eq("id", id)
		.eq("user_id", req.user.id)
		.select("*")
		.single();
	if (error) return res.status(500).json({ error: error.message });
	res.json(data);
});

app.delete("/api/posts/:id", authenticateToken, async (req, res) => {
	const { id } = req.params;
	const { error } = await supabase
		.from("posts")
		.delete()
		.eq("id", id)
		.eq("user_id", req.user.id);
	if (error) return res.status(500).json({ error: error.message });
	res.json({ success: true });
});

// Analytics Routes
app.get("/api/analytics/overview", authenticateToken, async (req, res) => {
	const { data: posts, error } = await supabase
		.from("posts")
		.select("*")
		.eq("user_id", req.user.id);
	if (error) return res.status(500).json({ error: error.message });
	const totalEngagement = posts.reduce(
		(sum, post) =>
			sum +
			(post.engagement?.likes || 0) +
			(post.engagement?.retweets || 0) +
			(post.engagement?.comments || 0),
		0
	);
	const totalImpressions = posts.reduce(
		(sum, post) => sum + (post.performance?.impressions || 0),
		0
	);
	const avgViralScore =
		posts.length > 0
			? posts.reduce((sum, post) => sum + (post.viral_score || 0), 0) /
			  posts.length
			: 0;
	res.json({
		totalPosts: posts.length,
		totalEngagement,
		totalImpressions,
		avgViralScore: Math.round(avgViralScore),
		weeklyGrowth: "+12.5%",
		topPerformingPost:
			posts.sort(
				(a, b) => (b.viral_score || 0) - (a.viral_score || 0)
			)[0] || null,
	});
});

app.get("/api/analytics/performance", authenticateToken, async (req, res) => {
	const { data: analytics, error } = await supabase
		.from("post_analytics")
		.select("*")
		.eq("user_id", req.user.id)
		.order("date", { ascending: true });
	if (error) return res.status(500).json({ error: error.message });
	res.json(analytics);
});

// User Streak Routes
app.get("/api/user/streak", authenticateToken, async (req, res) => {
	// Fetch streak data for the user from user_streaks table
	const { data: streakRows, error } = await supabase
		.from("user_streaks")
		.select("*")
		.eq("user_id", req.user.id)
		.order("date", { ascending: true });
	if (error) return res.status(500).json({ error: error.message });
	// Calculate streaks
	let currentStreak = 0,
		longestStreak = 0,
		lastPostDate = null;
	let tempStreak = 0;
	for (let i = 0; i < streakRows.length; i++) {
		if (streakRows[i].posted) {
			tempStreak++;
			if (tempStreak > longestStreak) longestStreak = tempStreak;
			lastPostDate = streakRows[i].date;
		} else {
			tempStreak = 0;
		}
	}
	currentStreak = tempStreak;
	res.json({
		currentStreak,
		longestStreak,
		lastPostDate,
		streakData: streakRows,
	});
});

app.post("/api/user/streak/update", authenticateToken, async (req, res) => {
	const today = new Date().toISOString().split("T")[0];
	// Upsert today's streak row
	const { error } = await supabase
		.from("user_streaks")
		.upsert(
			{ user_id: req.user.id, date: today, posted: true, post_count: 1 },
			{ onConflict: ["user_id", "date"] }
		);
	if (error) return res.status(500).json({ error: error.message });
	// Return updated streak data
	const { data: streakRows } = await supabase
		.from("user_streaks")
		.select("*")
		.eq("user_id", req.user.id)
		.order("date", { ascending: true });
	// Calculate streaks
	let currentStreak = 0,
		longestStreak = 0,
		lastPostDate = null;
	let tempStreak = 0;
	for (let i = 0; i < streakRows.length; i++) {
		if (streakRows[i].posted) {
			tempStreak++;
			if (tempStreak > longestStreak) longestStreak = tempStreak;
			lastPostDate = streakRows[i].date;
		} else {
			tempStreak = 0;
		}
	}
	currentStreak = tempStreak;
	res.json({
		currentStreak,
		longestStreak,
		lastPostDate,
		streakData: streakRows,
	});
});

// Start server
app.listen(PORT, () => {
	console.log(`🚀 TrendCraft API server running on http://localhost:${PORT}`);
	console.log(`🎯 Frontend should run on: http://localhost:5173`);
	console.log(
		`🤖 Gemini AI: ${
			process.env.GEMINI_API_KEY ? "Configured" : "Not configured"
		}`
	);
	console.log(
		`🕷️ RapidAPI: ${
			process.env.X_RapidAPI_Key
				? "Configured - REAL DATA WITH DB CACHING"
				: "Not configured - NO FALLBACKS"
		}`
	);
	console.log(
		`🔍 Firecrawl: ${
			process.env.FIRECRAWL_API_KEY
				? "Configured - ENHANCED CONTEXT"
				: "Not configured"
		}`
	);
	console.log(
		`🎤 ElevenLabs: ${
			process.env.ELEVENLABS_API_KEY ? "Configured" : "Not configured"
		}`
	);
	console.log(
		`💳 Stripe: ${
			process.env.STRIPE_SECRET_KEY ? "Configured" : "Not configured"
		}`
	);
	console.log("✅ Server started successfully!");
});