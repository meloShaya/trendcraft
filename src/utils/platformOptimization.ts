export interface PlatformLimits {
  maxCharacters: number;
  maxHashtags: number;
  optimalHashtags: number;
  supportsVideo: boolean;
  supportsImages: boolean;
  supportsLinks: boolean;
}

export interface PlatformOptimization {
  limits: PlatformLimits;
  visualSuggestions: string[];
  hashtagStrategy: string;
  ctaSuggestions: string[];
  contentTips: string[];
}

export const PLATFORM_CONFIGS: Record<string, PlatformOptimization> = {
  twitter: {
    limits: {
      maxCharacters: 280,
      maxHashtags: 5,
      optimalHashtags: 2,
      supportsVideo: true,
      supportsImages: true,
      supportsLinks: true
    },
    visualSuggestions: [
      "Add eye-catching images or GIFs",
      "Use thread format for longer content",
      "Include charts or infographics for data",
      "Consider video content for higher engagement"
    ],
    hashtagStrategy: "Use 1-2 highly relevant hashtags. Avoid hashtag stuffing.",
    ctaSuggestions: [
      "Retweet if you agree",
      "What's your take? Reply below",
      "Share your thoughts 👇",
      "Tag someone who needs to see this",
      "Follow for more insights like this"
    ],
    contentTips: [
      "Keep it concise and punchy",
      "Start with a hook in the first line",
      "Use emojis sparingly but effectively",
      "Ask questions to drive engagement"
    ]
  },
  linkedin: {
    limits: {
      maxCharacters: 3000,
      maxHashtags: 10,
      optimalHashtags: 3,
      supportsVideo: true,
      supportsImages: true,
      supportsLinks: true
    },
    visualSuggestions: [
      "Add professional headshots or team photos",
      "Include industry-relevant infographics",
      "Share behind-the-scenes content",
      "Use carousel posts for step-by-step content"
    ],
    hashtagStrategy: "Use 3-5 industry-specific hashtags. Mix popular and niche tags.",
    ctaSuggestions: [
      "What's your experience with this?",
      "Share your thoughts in the comments",
      "Connect with me for more insights",
      "Save this post for later reference",
      "Follow for professional updates"
    ],
    contentTips: [
      "Lead with value and insights",
      "Share personal experiences and lessons",
      "Use professional tone with personality",
      "Include industry statistics or trends"
    ]
  },
  instagram: {
    limits: {
      maxCharacters: 2200,
      maxHashtags: 30,
      optimalHashtags: 11,
      supportsVideo: true,
      supportsImages: true,
      supportsLinks: false
    },
    visualSuggestions: [
      "High-quality, visually appealing images are essential",
      "Use consistent color palette and filters",
      "Create carousel posts for storytelling",
      "Consider Reels for trending content",
      "Use Stories for behind-the-scenes content"
    ],
    hashtagStrategy: "Use 8-15 hashtags. Mix trending, niche, and branded hashtags.",
    ctaSuggestions: [
      "Link in bio for more info",
      "Double tap if you agree ❤️",
      "Save this post for later",
      "Share to your Stories",
      "Tag a friend who needs this"
    ],
    contentTips: [
      "Visual content is king - invest in quality images",
      "Tell stories through captions",
      "Use emojis to break up text",
      "Engage with your community in comments"
    ]
  },
  facebook: {
    limits: {
      maxCharacters: 63206,
      maxHashtags: 10,
      optimalHashtags: 2,
      supportsVideo: true,
      supportsImages: true,
      supportsLinks: true
    },
    visualSuggestions: [
      "Use high-quality images or videos",
      "Create engaging cover photos",
      "Share user-generated content",
      "Use Facebook Live for real-time engagement"
    ],
    hashtagStrategy: "Use 1-3 hashtags. Focus on community and local hashtags.",
    ctaSuggestions: [
      "Share your thoughts below",
      "Like and share if you agree",
      "Visit our website for more",
      "Join our community",
      "Follow our page for updates"
    ],
    contentTips: [
      "Longer-form content performs well",
      "Focus on community building",
      "Share valuable, shareable content",
      "Use Facebook Groups for niche audiences"
    ]
  },
  tiktok: {
    limits: {
      maxCharacters: 2200,
      maxHashtags: 20,
      optimalHashtags: 5,
      supportsVideo: true,
      supportsImages: false,
      supportsLinks: false
    },
    visualSuggestions: [
      "Vertical video format is essential (9:16 ratio)",
      "Hook viewers in the first 3 seconds",
      "Use trending sounds and music",
      "Add text overlays for key points",
      "Keep videos under 60 seconds for best performance"
    ],
    hashtagStrategy: "Use 3-7 hashtags. Mix trending challenges with niche content tags.",
    ctaSuggestions: [
      "Follow for more tips like this",
      "Duet this if you agree",
      "Try this and tag us",
      "Share your results below",
      "Which one are you? Comment below"
    ],
    contentTips: [
      "Video content only - make it engaging",
      "Jump on trending sounds and challenges",
      "Keep it authentic and entertaining",
      "Use captions for accessibility"
    ]
  }
};

export const validateContentLength = (content: string, platform: string): {
  isValid: boolean;
  currentLength: number;
  maxLength: number;
  suggestion?: string;
} => {
  const config = PLATFORM_CONFIGS[platform];
  if (!config) {
    return { isValid: true, currentLength: content.length, maxLength: 0 };
  }

  const currentLength = content.length;
  const maxLength = config.limits.maxCharacters;
  const isValid = currentLength <= maxLength;

  let suggestion;
  if (!isValid) {
    const excess = currentLength - maxLength;
    suggestion = `Content is ${excess} characters too long. Consider shortening or splitting into multiple posts.`;
  } else if (currentLength > maxLength * 0.9) {
    suggestion = `Content is near the character limit. Consider keeping some room for engagement.`;
  }

  return { isValid, currentLength, maxLength, suggestion };
};

export const generateOptimalHashtags = (
  topic: string,
  platform: string,
  category?: string
): string[] => {
  const config = PLATFORM_CONFIGS[platform];
  if (!config) return [];

  const baseHashtags = [`#${topic.replace(/\s+/g, '')}`];
  
  // Platform-specific hashtag pools
  const hashtagPools: Record<string, string[]> = {
    twitter: ['#trending', '#viral', '#tech', '#innovation', '#socialmedia'],
    linkedin: ['#professional', '#career', '#business', '#leadership', '#industry'],
    instagram: ['#instagood', '#photooftheday', '#love', '#beautiful', '#happy', '#follow', '#like4like'],
    facebook: ['#community', '#local', '#family', '#friends', '#share'],
    tiktok: ['#fyp', '#foryou', '#viral', '#trending', '#challenge']
  };

  // Category-specific hashtags
  const categoryHashtags: Record<string, string[]> = {
    technology: ['#tech', '#innovation', '#AI', '#digital', '#future'],
    business: ['#business', '#entrepreneur', '#startup', '#success', '#growth'],
    health: ['#health', '#wellness', '#fitness', '#lifestyle', '#selfcare'],
    entertainment: ['#entertainment', '#fun', '#music', '#movies', '#celebrity'],
    environment: ['#environment', '#sustainability', '#green', '#climate', '#eco']
  };

  const platformPool = hashtagPools[platform] || [];
  const categoryPool = category ? categoryHashtags[category.toLowerCase()] || [] : [];
  
  // Combine and select optimal number
  const allHashtags = [...baseHashtags, ...platformPool, ...categoryPool];
  const uniqueHashtags = [...new Set(allHashtags)];
  
  return uniqueHashtags.slice(0, config.limits.optimalHashtags);
};

export const generatePlatformSpecificCTA = (platform: string, topic: string): string => {
  const config = PLATFORM_CONFIGS[platform];
  if (!config || config.ctaSuggestions.length === 0) return '';

  // Select a random CTA from the platform's suggestions
  const randomIndex = Math.floor(Math.random() * config.ctaSuggestions.length);
  return config.ctaSuggestions[randomIndex];
};

export const getVisualContentSuggestions = (platform: string): string[] => {
  const config = PLATFORM_CONFIGS[platform];
  return config ? config.visualSuggestions : [];
};

export const getPlatformContentTips = (platform: string): string[] => {
  const config = PLATFORM_CONFIGS[platform];
  return config ? config.contentTips : [];
};