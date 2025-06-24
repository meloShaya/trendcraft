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
import FormData from 'form-data';
import fetch from 'node-fetch';

// Load environment variables
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

// websocket handler
app.ws("/api/voice/stream", (ws, req) => {
  console.log("Client connected to server WebSocket");
  
  // Buffer to collect audio chunks
  let audioBuffer = [];
  let isProcessing = false;
  
  // Configuration
  const BUFFER_SIZE_THRESHOLD = 16384; // Process when buffer reaches this size (in bytes)
  const BUFFER_TIME_THRESHOLD = 2000; // Or process every 2 seconds
  let bufferTimer = null;
  
  // Function to process accumulated audio
  async function processAudioBuffer() {
    if (audioBuffer.length === 0 || isProcessing) return;
    
    isProcessing = true;
    console.log(`Processing ${audioBuffer.length} audio chunks`);
    
    try {
      // Combine all audio chunks into a single buffer
      const combinedBuffer = Buffer.concat(audioBuffer);
      
      // Clear the buffer for new audio
      audioBuffer = [];
      
      // Create form data for ElevenLabs API
      const formData = new FormData();
      formData.append('audio', combinedBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      formData.append('model_id', 'scribe_v1');
      
      // Optional parameters
      formData.append('language_code', 'en'); // Adjust as needed
      formData.append('speaker_diarization', 'false');
      formData.append('audio_events', 'false');
      
      // Send to ElevenLabs HTTP API
      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Send transcription back to client
      if (ws.readyState === ws.OPEN && result.text) {
        ws.send(JSON.stringify({
          type: 'transcription',
          text: result.text,
          language: result.detected_language,
          confidence: result.confidence
        }));
      }
      
    } catch (error) {
      console.error('Error processing audio:', error);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process audio'
        }));
      }
    } finally {
      isProcessing = false;
    }
  }
  
  // Handle incoming audio data from client
  ws.onmessage = (msg) => {
    try {
      // Add audio chunk to buffer
      audioBuffer.push(Buffer.from(msg.data));
      
      // Calculate total buffer size
      const totalBufferSize = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
      
      // Process if buffer is large enough
      if (totalBufferSize >= BUFFER_SIZE_THRESHOLD) {
        if (bufferTimer) {
          clearTimeout(bufferTimer);
          bufferTimer = null;
        }
        processAudioBuffer();
      } else {
        // Set timer to process buffer after time threshold
        if (!bufferTimer) {
          bufferTimer = setTimeout(() => {
            bufferTimer = null;
            processAudioBuffer();
          }, BUFFER_TIME_THRESHOLD);
        }
      }
      
    } catch (error) {
      console.error('Error handling audio message:', error);
    }
  };
  
  // Handle client disconnect
  ws.onclose = () => {
    console.log("Client disconnected from server WebSocket");
    
    // Clear any pending timer
    if (bufferTimer) {
      clearTimeout(bufferTimer);
      bufferTimer = null;
    }
    
    // Process any remaining audio in buffer
    if (audioBuffer.length > 0) {
      processAudioBuffer();
    }
  };
  
  // Handle WebSocket errors
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to speech-to-text service'
  }));
});
// --- END OF FIX ---

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

// Platform-specific actor configurations with correct input structures
const PLATFORM_ACTORS = {
	twitter: {
		actorId:
			process.env.TWITTER_TRENDS_ACTOR_ID ||
			"apify/twitter-trends-scraper",
		input: { location: "United States", maxTrends: 20 },
	},
	instagram: {
		actorId: "easyapi/instagram-posts-scraper",
		input: {
			usernames: ["trending", "viral", "popular"], // Instagram usernames to scrape
			maxPosts: 20,
			skipPinnedPosts: true,
		},
	},
	tiktok: {
		actorId: "novi/fast-tiktok-api",
		input: {
			scrapingType: "TREND", // Use TREND scraping type
			targetCountry: "United Kingdom",
			keyword: "viral", // For search-based trending
			limitResult: 10,
		},
	},
	facebook: {
		actorId: "apify/facebook-posts-scraper", // Placeholder
		input: { query: "trending", maxResults: 20 },
	},
	youtube: {
		actorId: "apify/youtube-scraper", // Placeholder
		input: { searchKeywords: "trending", maxResults: 20 },
	},
};

// STRICT data transformation - ONLY use real API data, NO fallbacks
const transformTrendData = (apifyData, platform = "twitter") => {
	if (!apifyData || !Array.isArray(apifyData) || apifyData.length === 0) {
		console.log(`No valid data received for ${platform}:`, apifyData);
		return [];
	}

	console.log(
		`Transforming ${apifyData.length} REAL items for platform: ${platform}`
	);
	console.log("Sample raw data:", JSON.stringify(apifyData[0], null, 2));

	const transformedTrends = [];

	for (let index = 0; index < apifyData.length; index++) {
		const item = apifyData[index];
		let trendData = null;

		// Platform-specific data extraction from REAL API responses ONLY
		switch (platform) {
			case "twitter":
				// Extract ONLY real Twitter trend data
				if (item.trend || item.name || item.query) {
					const keyword = item.trend || item.name || item.query;

					trendData = {
						keyword: cleanKeyword(keyword),
						category: item.category || "General", // Default to 'General' instead of null
						volume: item.tweet_volume || item.volume || 0,
						growth:
							item.growth ||
							calculateGrowthFromVolume(
								item.tweet_volume || item.volume || 0
							),
						hashtags:
							item.hashtags || extractHashtagsFromText(keyword),
						peakTime: item.peak_time || null, // No fallback
						demographics: item.demographics || {
							age: "N/A",
							interests: [],
						}, // Default demographics object
					};
				}
				break;

			case "instagram":
				// Extract from Instagram post data
				if (item.caption || item.hashtags) {
					const keyword =
						extractKeywordFromCaption(item.caption) ||
						(item.hashtags && item.hashtags[0]
							? item.hashtags[0].replace("#", "")
							: null);

					if (keyword) {
						trendData = {
							keyword: cleanKeyword(keyword),
							category: "General", // Default category instead of null
							volume:
								item.likeCount ||
								item.likes_count ||
								item.likes ||
								0,
							growth: calculateGrowthFromEngagement(
								item.likeCount,
								item.commentsCount
							),
							hashtags:
								item.hashtags ||
								extractHashtagsFromText(item.caption),
							peakTime: null, // No real peak time data from Instagram API
							demographics: { age: "N/A", interests: [] }, // Default demographics object
						};
					}
				}
				break;

			case "tiktok":
				// Extract from TikTok video data
				if (item.desc || item.description || item.title) {
					const keyword = extractKeywordFromDescription(
						item.desc || item.description || item.title
					);

					if (keyword) {
						trendData = {
							keyword: cleanKeyword(keyword),
							category: "General", // Default category instead of null
							volume:
								item.playCount ||
								item.play_count ||
								item.diggCount ||
								item.digg_count ||
								0,
							growth: calculateGrowthFromViews(
								item.playCount || item.play_count || 0
							),
							hashtags:
								item.hashtags ||
								extractHashtagsFromText(
									item.desc || item.description
								),
							peakTime: null, // No real peak time data
							demographics: { age: "N/A", interests: [] }, // Default demographics object
						};
					}
				}
				break;

			case "facebook":
				if (item.text || item.message) {
					const keyword = extractKeywordFromText(
						item.text || item.message
					);

					if (keyword) {
						trendData = {
							keyword: cleanKeyword(keyword),
							category: "General", // Default category instead of null
							volume:
								(item.reactions || 0) +
								(item.shares || 0) +
								(item.comments || 0),
							growth: calculateGrowthFromEngagement(
								item.reactions,
								item.comments
							),
							hashtags: extractHashtagsFromText(
								item.text || item.message
							),
							peakTime: null,
							demographics: { age: "N/A", interests: [] }, // Default demographics object
						};
					}
				}
				break;

			case "youtube":
				if (item.title) {
					const keyword = extractKeywordFromTitle(item.title);

					if (keyword) {
						trendData = {
							keyword: cleanKeyword(keyword),
							category: "General", // Default category instead of null
							volume: item.viewCount || item.view_count || 0,
							growth: calculateGrowthFromViews(
								item.viewCount || item.view_count || 0
							),
							hashtags:
								item.tags ||
								extractHashtagsFromText(item.title),
							peakTime: null,
							demographics: { age: "N/A", interests: [] }, // Default demographics object
						};
					}
				}
				break;
		}

		// Only add if we have real data
		if (trendData && trendData.keyword && trendData.keyword !== "Unknown") {
			const trendScore = calculateTrendScore(trendData.volume, platform);

			transformedTrends.push({
				id: transformedTrends.length + 1,
				keyword: trendData.keyword,
				category: trendData.category, // Now always has a value
				trendScore,
				volume: trendData.volume,
				growth: trendData.growth,
				platforms: [platform],
				relatedHashtags: trendData.hashtags.slice(0, 5),
				peakTime: trendData.peakTime, // Can be null
				demographics: trendData.demographics, // Now always has a valid object
			});
		}
	}

	console.log(
		`Successfully transformed ${transformedTrends.length} REAL trends for ${platform}`
	);
	return transformedTrends;
};

// Helper functions for data extraction and processing
const extractKeywordFromCaption = (caption) => {
	if (!caption || typeof caption !== "string") return null;
	// Extract first meaningful word or phrase from caption
	const words = caption
		.split(" ")
		.filter(
			(word) =>
				word.length > 3 &&
				!word.startsWith("#") &&
				!word.startsWith("@")
		)
		.slice(0, 3);
	return words.length > 0 ? words.join(" ") : null;
};

const extractKeywordFromDescription = (description) => {
	if (!description || typeof description !== "string") return null;
	// Extract meaningful content from TikTok description
	const words = description
		.split(" ")
		.filter(
			(word) =>
				word.length > 3 &&
				!word.startsWith("#") &&
				!word.startsWith("@")
		)
		.slice(0, 3);
	return words.length > 0 ? words.join(" ") : null;
};

const extractKeywordFromText = (text) => {
	if (!text || typeof text !== "string") return null;
	const words = text
		.split(" ")
		.filter(
			(word) =>
				word.length > 3 &&
				!word.startsWith("#") &&
				!word.startsWith("@")
		)
		.slice(0, 3);
	return words.length > 0 ? words.join(" ") : null;
};

const extractKeywordFromTitle = (title) => {
	if (!title || typeof title !== "string") return null;
	const words = title
		.split(" ")
		.filter((word) => word.length > 3)
		.slice(0, 4);
	return words.length > 0 ? words.join(" ") : null;
};

const extractHashtagsFromText = (text) => {
	if (!text || typeof text !== "string") return [];
	const hashtagRegex = /#[\w]+/g;
	const matches = text.match(hashtagRegex) || [];
	return matches.slice(0, 5); // Limit to 5 hashtags
};

const cleanKeyword = (keyword) => {
	if (!keyword || typeof keyword !== "string") return null;
	const cleaned = keyword.replace(/[#@]/g, "").substring(0, 100).trim();
	return cleaned.length > 0 ? cleaned : null;
};

const calculateGrowthFromVolume = (volume) => {
	if (!volume || volume === 0) return "+0%";
	if (volume > 100000) return "+50%";
	if (volume > 50000) return "+35%";
	if (volume > 10000) return "+25%";
	if (volume > 1000) return "+15%";
	return "+5%";
};

const calculateGrowthFromEngagement = (likes, comments) => {
	const total = (likes || 0) + (comments || 0);
	if (total === 0) return "+0%";
	if (total > 10000) return "+40%";
	if (total > 5000) return "+30%";
	if (total > 1000) return "+20%";
	return "+10%";
};

const calculateGrowthFromViews = (views) => {
	if (!views || views === 0) return "+0%";
	if (views > 1000000) return "+60%";
	if (views > 500000) return "+45%";
	if (views > 100000) return "+30%";
	if (views > 10000) return "+20%";
	return "+10%";
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
		case "instagram":
			if (volume > 50000) score = 95;
			else if (volume > 20000) score = 85;
			else if (volume > 5000) score = 75;
			else if (volume > 1000) score = 65;
			break;
		case "tiktok":
			if (volume > 1000000) score = 95;
			else if (volume > 500000) score = 85;
			else if (volume > 100000) score = 75;
			else if (volume > 10000) score = 65;
			break;
		default:
			score = Math.min(50 + volume / 1000, 95);
	}

	return Math.round(score);
};

// Enhanced function to fetch trends from Apify using platform-specific actors
const fetchTrendsFromApify = async (platform = "twitter") => {
	try {
		console.log(
			`Fetching REAL trends for platform: ${platform} via direct API call`
		);

		const platformConfig = PLATFORM_ACTORS[platform];
		if (!platformConfig) {
			console.log(
				`No actor configuration found for platform: ${platform}`
			);
			return [];
		}

		const actorId = platformConfig.actorId;
		const actorInput = platformConfig.input;
		const safeActorId = actorId.replace("/", "~");
		const token = process.env.APIFY_API_TOKEN;

		if (!token) {
			console.log("APIFY_API_TOKEN not found - cannot fetch real data");
			return [];
		}

		// Start the actor run with correct input structure
		const startRunUrl = `https://api.apify.com/v2/acts/${safeActorId}/runs?token=${token}`;
		console.log(`Calling Apify API Step 1: POST to start run...`);
		console.log(`Actor ID: ${actorId}`);
		console.log(`Input:`, JSON.stringify(actorInput, null, 2));

		const startResponse = await axios.post(
			startRunUrl,
			{
				input: actorInput, // Wrap input in 'input' object as required by Apify
			},
			{
				headers: { "Content-Type": "application/json" },
				timeout: 15000,
			}
		);

		const runId = startResponse.data.data.id;
		const datasetId = startResponse.data.data.defaultDatasetId;
		console.log(
			`Actor run started. Run ID: ${runId}, Dataset ID: ${datasetId}`
		);

		// Poll for completion with extended timeout for real data
		let items = [];
		let runStatus = "RUNNING";
		let attempts = 0;
		const maxAttempts = 30; // Extended to 60 seconds for real API calls

		while (runStatus !== "SUCCEEDED" && attempts < maxAttempts) {
			const statusUrl = `https://api.apify.com/v2/acts/${safeActorId}/runs/${runId}?token=${token}`;

			try {
				const statusResponse = await axios.get(statusUrl, {
					timeout: 5000,
				});
				runStatus = statusResponse.data.data.status;

				if (runStatus === "SUCCEEDED") {
					console.log(
						"Actor run completed successfully. Fetching results..."
					);
					const getResultsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`;
					const resultsResponse = await axios.get(getResultsUrl, {
						timeout: 15000,
					});
					items = resultsResponse.data;
					break;
				} else if (runStatus === "FAILED" || runStatus === "ABORTED") {
					console.error(
						`Actor run ${runStatus} for platform ${platform}`
					);
					return [];
				}

				console.log(
					`Run status: ${runStatus}. Attempt ${
						attempts + 1
					}/${maxAttempts}`
				);
				await new Promise((resolve) => setTimeout(resolve, 2000));
				attempts++;
			} catch (pollError) {
				console.error("Error polling run status:", pollError.message);
				return [];
			}
		}

		if (!items || items.length === 0) {
			console.log(
				`No items retrieved for ${platform} - returning empty array`
			);
			return [];
		}

		console.log(
			`Retrieved ${items.length} raw items from Apify for ${platform}`
		);
		console.log("Sample raw item:", JSON.stringify(items[0], null, 2));

		// Transform ONLY real data - no fallbacks
		const transformedTrends = transformTrendData(items, platform);

		if (transformedTrends.length === 0) {
			console.log(`No valid trends extracted from ${platform} data`);
		}

		return transformedTrends;
	} catch (error) {
		console.error(`Error fetching trends from Apify direct API:`, {
			error: error.response?.data || error.message,
			platform,
			status: error.response?.status,
		});
		return []; // Return empty array instead of fallback
	}
};

// Platform-specific optimization configurations
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

// ROBUST SYSTEM PROMPT
const createRobustSystemPrompt = (
	topic,
	platform,
	tone,
	targetAudience,
	includeHashtags
) => {
	const platformConfig =
		PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;

	return `You are TrendCraft AI, an expert social media content generator. Your ONLY job is to generate ONE piece of ready-to-publish content for ${platform}.

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
		const platformConfig =
			PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;

		const prompt = createRobustSystemPrompt(
			topic,
			platform,
			tone,
			targetAudience,
			includeHashtags
		);

		const result = await model.generateContent(prompt);
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

		const viralScore = calculateViralScore(content, platform);
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

const calculateViralScore = (content, platform) => {
	let score = 50;
	const platformConfig =
		PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter;

	const contentLength = content.length;
	const optimalLength = platformConfig.maxCharacters * 0.7;

	if (contentLength <= optimalLength) {
		score += 10;
	} else if (contentLength <= platformConfig.maxCharacters) {
		score += 5;
	}

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

	if (content.includes("#")) score += 6;
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

// Enhanced Trends Routes with platform support - REAL DATA ONLY
app.get("/api/trends", authenticateToken, async (req, res) => {
	try {
		const { platform = "twitter", limit = 20 } = req.query;

		console.log(
			`API: Fetching REAL trends for platform: ${platform}, limit: ${limit}`
		);

		// Fetch ONLY real data from Apify - NO fallbacks whatsoever
		let trends = await fetchTrendsFromApify(platform);

		// If no real data available, return empty array - NO FALLBACKS
		if (!trends || trends.length === 0) {
			console.log(
				`No real trends data available for ${platform} - returning empty array`
			);
			return res.json([]);
		}

		// Limit results
		const limitedTrends = trends.slice(0, parseInt(limit));

		console.log(
			`API: Returning ${limitedTrends.length} REAL trends for ${platform}`
		);
		res.json(limitedTrends);
	} catch (error) {
		console.error("Error in /api/trends:", error);
		res.status(500).json({ error: "Failed to fetch trends" });
	}
});

// Enhanced Content Routes with platform optimization
app.post("/api/content/generate", authenticateToken, async (req, res) => {
	const { topic, platform, tone, includeHashtags, targetAudience } = req.body;
	const generatedContent = await generateContentWithAI(
		topic,
		platform,
		tone,
		targetAudience,
		includeHashtags
	);
	res.json(generatedContent);
});

// Voice AI Routes
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
	res.json(
		userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
	);
});

// Analytics Routes
app.get("/api/analytics/overview", authenticateToken, (req, res) => {
	const userPosts = posts.filter((p) => p.userId === req.user.id);
	const totalEngagement = userPosts.reduce(
		(sum, post) =>
			sum +
			post.engagement.likes +
			post.engagement.retweets +
			post.engagement.comments,
		0
	);
	const totalImpressions = userPosts.reduce(
		(sum, post) => sum + (post.performance?.impressions || 0),
		0
	);
	const avgViralScore =
		userPosts.length > 0
			? userPosts.reduce((sum, post) => sum + post.viralScore, 0) /
			  userPosts.length
			: 0;
	res.json({
		totalPosts: userPosts.length,
		totalEngagement,
		totalImpressions,
		avgViralScore: Math.round(avgViralScore),
		weeklyGrowth: "+12.5%",
		topPerformingPost:
			userPosts.sort((a, b) => b.viralScore - a.viralScore)[0] || null,
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
		`🕷️ Apify: ${
			process.env.APIFY_API_TOKEN
				? "Configured - REAL DATA ONLY"
				: "Not configured - NO FALLBACKS"
		}`
	);
	console.log(
		`🎤 ElevenLabs: ${
			process.env.ELEVENLABS_API_KEY ? "Configured" : "Not configured"
		}`
	);
	console.log("✅ Server started successfully!");
});