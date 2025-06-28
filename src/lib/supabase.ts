import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔄 [SUPABASE] Initializing client with:', {
	url: supabaseUrl ? 'SET' : 'MISSING',
	key: supabaseAnonKey ? 'SET' : 'MISSING',
	actualUrl: supabaseUrl // Show actual URL for debugging
});

if (!supabaseUrl || !supabaseAnonKey) {
	console.error('❌ [SUPABASE] Missing environment variables:', {
		VITE_SUPABASE_URL: !!supabaseUrl,
		VITE_SUPABASE_ANON_KEY: !!supabaseAnonKey
	});
	throw new Error("Missing Supabase environment variables");
}

// Validate URL format
try {
	new URL(supabaseUrl);
} catch (error) {
	console.error('❌ [SUPABASE] Invalid Supabase URL format:', supabaseUrl);
	throw new Error("Invalid Supabase URL format");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true,
		flowType: 'pkce',
		storage: window.localStorage, // Explicitly use localStorage for session persistence
		storageKey: 'trendcraft-auth-token', // Custom storage key
		debug: false // Set to true for debugging auth issues
	},
	global: {
		headers: {
			'X-Client-Info': 'trendcraft-web'
		}
	},
	db: {
		schema: 'public'
	},
	realtime: {
		params: {
			eventsPerSecond: 10
		}
	}
});

// Test connection on initialization
supabase.from('users').select('count').limit(1).then(
	({ data, error }) => {
		if (error) {
			console.error('❌ [SUPABASE] Connection test failed:', error);
		} else {
			console.log('✅ [SUPABASE] Connection test successful');
		}
	}
).catch(error => {
	console.error('❌ [SUPABASE] Connection test error:', error);
});

console.log('✅ [SUPABASE] Client initialized successfully');

// Database types
export interface User {
	id: string;
	email: string;
	username: string;
	full_name?: string;
	avatar_url?: string;
	bio?: string;
	is_active: boolean;
	is_premium: boolean;
	last_login_at?: string;
	created_at: string;
	updated_at: string;
}

export interface UserSocialAccount {
	id: string;
	user_id: string;
	platform: string;
	platform_user_id: string;
	platform_username: string;
	platform_display_name?: string;
	access_token?: string;
	refresh_token?: string;
	token_expires_at?: string;
	follower_count?: number;
	following_count?: number;
	is_connected: boolean;
	last_sync_at?: string;
	created_at: string;
	updated_at: string;
}

export interface Post {
	id: string;
	user_id: string;
	content: string;
	platform: string;
	status: string;
	viral_score?: number;
	hashtags?: string[];
	target_audience?: string;
	tone?: string;
	trend_analysis?: string;
	context_data?: any;
	ai_recommendations?: any;
	scheduled_for?: string;
	published_at?: string;
	platform_post_ids?: any;
	media_urls?: string[];
	created_at: string;
	updated_at: string;
}

export interface UserStreak {
	id: string;
	user_id: string;
	date: string;
	posted: boolean;
	post_count: number;
	created_at: string;
}

export interface UserSettings {
	id: string;
	user_id: string;
	email_notifications: boolean;
	push_notifications: boolean;
	trend_alerts: boolean;
	performance_reports: boolean;
	theme: string;
	language: string;
	timezone: string;
	default_platform: string;
	default_tone: string;
	preferred_hashtag_count: number;
	profile_public: boolean;
	analytics_sharing: boolean;
	created_at: string;
	updated_at: string;
}