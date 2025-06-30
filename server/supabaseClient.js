import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

// Use the correct environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 [SERVER] Supabase configuration:', {
	url: supabaseUrl ? 'SET' : 'MISSING',
	serviceKey: supabaseServiceRoleKey ? 'SET' : 'MISSING',
	actualUrl: supabaseUrl // Show actual URL for debugging
});

if (!supabaseUrl || !supabaseServiceRoleKey) {
	console.error('❌ [SERVER] Missing Supabase environment variables:', {
		SUPABASE_URL: !!process.env.SUPABASE_URL,
		VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
		SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceRoleKey
	});
	throw new Error("Missing Supabase environment variables");
}

// Validate URL format - must be the API URL, not database URL
try {
	new URL(supabaseUrl);
	if (!supabaseUrl.includes('supabase.co') || supabaseUrl.includes('postgresql://')) {
		throw new Error('Invalid Supabase URL format - must be API URL (https://xxx.supabase.co), not database URL');
	}
} catch (error) {
	console.error('❌ [SERVER] Invalid Supabase URL format:', supabaseUrl);
	console.error('Expected format: https://your-project.supabase.co');
	console.error('Received format:', supabaseUrl);
	throw new Error("Invalid Supabase URL format - must be API URL, not database URL");
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