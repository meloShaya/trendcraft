import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL; // Use the same URL as frontend
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 [SERVER] Supabase configuration:', {
	url: supabaseUrl ? 'SET' : 'MISSING',
	serviceKey: supabaseServiceRoleKey ? 'SET' : 'MISSING',
	actualUrl: supabaseUrl // Show actual URL for debugging
});

if (!supabaseUrl || !supabaseServiceRoleKey) {
	console.error('❌ [SERVER] Missing Supabase environment variables:', {
		VITE_SUPABASE_URL: !!supabaseUrl,
		SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceRoleKey
	});
	throw new Error("Missing Supabase environment variables");
}

// Validate URL format
try {
	new URL(supabaseUrl);
	if (!supabaseUrl.includes('supabase.co')) {
		throw new Error('Invalid Supabase URL format');
	}
} catch (error) {
	console.error('❌ [SERVER] Invalid Supabase URL format:', supabaseUrl);
	throw new Error("Invalid Supabase URL format");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
		detectSessionInUrl: false
	},
	global: {
		headers: {
			'X-Client-Info': 'trendcraft-server'
		}
	}
});

// Test connection on initialization
supabase.from('users').select('count').limit(1).then(
	({ data, error }) => {
		if (error) {
			console.error('❌ [SERVER] Supabase connection test failed:', error);
		} else {
			console.log('✅ [SERVER] Supabase connection test successful');
		}
	}
).catch(error => {
	console.error('❌ [SERVER] Supabase connection test error:', error);
});

console.log('✅ [SERVER] Supabase client initialized successfully');