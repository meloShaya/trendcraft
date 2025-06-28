import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

interface User {
	id: string;
	username: string;
	email: string;
	full_name: string | null;
	bio: string | null;
	avatar_url: string | null;
	is_active: boolean | null;
	is_premium: boolean | null;
	last_login_at: string | null;
	created_at: string | null;
	updated_at: string | null;
}

interface AuthContextType {
	user: User | null;
	token: string | null;
	login: (email: string, password: string) => Promise<void>;
	register: (
		username: string,
		email: string,
		password: string
	) => Promise<void>;
	logout: () => void;
	loading: boolean;
	socialLogin: (provider: "google" | "twitter" | "facebook") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		// Check for existing session on app load
		const initializeAuth = async () => {
			try {
				console.log('🔄 [AUTH] Initializing authentication...');
				
				// Test Supabase connection first with timeout
				console.log('🔄 [AUTH] Testing Supabase connection...');
				
				const connectionTest = supabase
					.from('users')
					.select('count')
					.limit(1);
				
				// Add timeout to connection test
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('Connection timeout')), 10000);
				});
				
				const { data: testData, error: testError } = await Promise.race([
					connectionTest,
					timeoutPromise
				]) as any;
				
				if (testError) {
					console.error('❌ [AUTH] Supabase connection failed:', testError);
					if (mounted) {
						setLoading(false);
					}
					return;
				}
				
				console.log('✅ [AUTH] Supabase connection successful');
				
				// Get the current session from Supabase
				console.log('🔄 [AUTH] Getting current session...');
				const { data: { session }, error } = await supabase.auth.getSession();
				
				if (error) {
					console.error('❌ [AUTH] Error getting session:', error);
					if (mounted) {
						setLoading(false);
					}
					return;
				}

				if (session?.user && mounted) {
					console.log('✅ [AUTH] Found existing session for user:', session.user.id);
					await handleUserSession(session);
				} else {
					console.log('ℹ️ [AUTH] No existing session found');
				}
			} catch (error) {
				console.error('❌ [AUTH] Critical error initializing auth:', error);
				// Show user-friendly error for connection issues
				if (error instanceof Error && error.message.includes('fetch')) {
					console.error('❌ [AUTH] Network connection error - check internet connection and Supabase configuration');
				}
			} finally {
				if (mounted) {
					console.log('✅ [AUTH] Auth initialization complete, setting loading to false');
					setLoading(false);
				}
			}
		};

		initializeAuth();

		// Listen for auth state changes
		console.log('🔄 [AUTH] Setting up auth state listener...');
		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('🔄 [AUTH] Auth state changed:', event, session?.user?.id);
			
			if (!mounted) return;

			try {
				if (event === 'SIGNED_IN' && session) {
					console.log('✅ [AUTH] User signed in:', session.user.id);
					setLoading(true); // Show loading during profile fetch
					await handleUserSession(session);
					setLoading(false);
				} else if (event === 'SIGNED_OUT') {
					console.log('👋 [AUTH] User signed out');
					setUser(null);
					setToken(null);
					setLoading(false);
				} else if (event === 'TOKEN_REFRESHED' && session) {
					console.log('🔄 [AUTH] Token refreshed');
					setToken(session.access_token);
				}
			} catch (error) {
				console.error('❌ [AUTH] Error in auth state change handler:', error);
				if (mounted) {
					setLoading(false);
				}
			}
		});

		return () => {
			mounted = false;
			console.log('🔄 [AUTH] Cleaning up auth listener');
			subscription.unsubscribe();
		};
	}, []);

	const handleUserSession = async (session: any) => {
		try {
			console.log('🔄 [AUTH] Handling user session for:', session.user.id);
			
			// Set token immediately
			setToken(session.access_token);
			console.log('✅ [AUTH] Token set');
			
			// Fetch user profile from our users table
			console.log('🔄 [AUTH] Fetching user profile...');
			const { data: userProfile, error: userError } = await supabase
				.from("users")
				.select("*")
				.eq("id", session.user.id)
				.single();

			if (!userError && userProfile) {
				console.log('✅ [AUTH] Found user profile:', userProfile.username);
				setUser(userProfile);
			} else if (userError?.code === 'PGRST116') {
				// User profile doesn't exist, create it
				console.log('🔄 [AUTH] Creating user profile...');
				
				const userData = {
					id: session.user.id,
					email: session.user.email,
					username: session.user.user_metadata?.username || 
						session.user.user_metadata?.preferred_username || 
						session.user.email?.split('@')[0] || 
						`user_${Date.now()}`,
					full_name: session.user.user_metadata?.full_name || 
						session.user.user_metadata?.name || null,
					avatar_url: session.user.user_metadata?.avatar_url || 
						session.user.user_metadata?.picture || null,
					bio: null
				};

				console.log('🔄 [AUTH] Inserting user data:', { ...userData, id: '[HIDDEN]' });

				const { data: newUser, error: createError } = await supabase
					.from('users')
					.insert(userData)
					.select()
					.single();

				if (!createError && newUser) {
					console.log('✅ [AUTH] Created user profile:', newUser.username);
					setUser(newUser);
					
					// Auto-connect social account if applicable
					await autoConnectSocialAccount(session, newUser.id);
				} else {
					console.error('❌ [AUTH] Error creating user profile:', createError);
					// Create a fallback user object
					const fallbackUser = {
						...userData,
						is_active: true,
						is_premium: false,
						last_login_at: new Date().toISOString(),
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					};
					console.log('⚠️ [AUTH] Using fallback user object');
					setUser(fallbackUser);
				}
			} else {
				console.error('❌ [AUTH] Error fetching user profile:', userError);
				// Create a fallback user object from session data
				const fallbackUser = {
					id: session.user.id,
					email: session.user.email || '',
					username: session.user.user_metadata?.username || 
						session.user.email?.split('@')[0] || 'user',
					full_name: session.user.user_metadata?.full_name || null,
					bio: null,
					avatar_url: session.user.user_metadata?.avatar_url || null,
					is_active: true,
					is_premium: false,
					last_login_at: new Date().toISOString(),
					created_at: session.user.created_at,
					updated_at: new Date().toISOString()
				};
				console.log('⚠️ [AUTH] Using fallback user object from session');
				setUser(fallbackUser);
			}
		} catch (error) {
			console.error('❌ [AUTH] Critical error handling user session:', error);
			// Still set a basic user object to prevent stuck states
			const emergencyUser = {
				id: session.user.id,
				email: session.user.email || '',
				username: session.user.email?.split('@')[0] || 'user',
				full_name: null,
				bio: null,
				avatar_url: null,
				is_active: true,
				is_premium: false,
				last_login_at: new Date().toISOString(),
				created_at: session.user.created_at,
				updated_at: new Date().toISOString()
			};
			console.log('🚨 [AUTH] Using emergency user object');
			setUser(emergencyUser);
		}
	};

	const autoConnectSocialAccount = async (session: any, userId: string) => {
		try {
			console.log('🔄 [AUTH] Auto-connecting social account...');
			const provider = session.user.app_metadata?.provider;
			if (!provider || provider === 'email') {
				console.log('ℹ️ [AUTH] No social provider to connect');
				return;
			}

			// Check if social account is already connected
			const { data: existingAccount } = await supabase
				.from('user_social_accounts')
				.select('*')
				.eq('user_id', userId)
				.eq('platform', provider === 'google' ? 'google' : provider)
				.single();

			if (!existingAccount) {
				// Connect the social account
				await supabase
					.from('user_social_accounts')
					.insert({
						user_id: userId,
						platform: provider === 'google' ? 'google' : provider,
						platform_user_id: session.user.id,
						platform_username: session.user.user_metadata?.preferred_username || 
							session.user.user_metadata?.username || 
							session.user.email?.split('@')[0] || 'user',
						platform_display_name: session.user.user_metadata?.full_name || 
							session.user.user_metadata?.name || null,
						access_token: session.access_token,
						refresh_token: session.refresh_token,
						is_connected: true,
						last_sync_at: new Date().toISOString()
					});
				console.log('✅ [AUTH] Social account connected');
			} else {
				console.log('ℹ️ [AUTH] Social account already connected');
			}
		} catch (error) {
			console.error('❌ [AUTH] Error auto-connecting social account:', error);
		}
	};

	const login = async (email: string, password: string) => {
		try {
			console.log('🔄 [AUTH] Attempting login for:', email);
			
			// Add timeout to login request
			const loginPromise = supabase.auth.signInWithPassword({
				email,
				password,
			});
			
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Login request timeout - please check your internet connection')), 15000);
			});
			
			const { data, error } = await Promise.race([loginPromise, timeoutPromise]) as any;
			
			if (error) {
				console.error('❌ [AUTH] Login error:', error.message);
				// Provide more specific error messages
				if (error.message.includes('fetch')) {
					throw new Error('Network error - please check your internet connection and try again');
				} else if (error.message.includes('Invalid login credentials')) {
					throw new Error('Invalid email or password');
				} else {
					throw new Error(error.message);
				}
			}
			
			console.log('✅ [AUTH] Login successful for:', email);
			// The auth state change listener will handle setting user and token
		} catch (error) {
			console.error('❌ [AUTH] Login failed:', error);
			if (error instanceof Error && error.message.includes('timeout')) {
				throw new Error('Connection timeout - please check your internet connection and try again');
			}
			throw error;
		}
	};

	const register = async (
		username: string,
		email: string,
		password: string
	) => {
		try {
			console.log('🔄 [AUTH] Attempting registration for:', email);
			
			// Add timeout to registration request
			const registerPromise = supabase.auth.signUp({
				email,
				password,
				options: { 
					data: { username },
					emailRedirectTo: undefined // Disable email confirmation
				},
			});
			
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Registration request timeout - please check your internet connection')), 15000);
			});
			
			const { data, error } = await Promise.race([registerPromise, timeoutPromise]) as any;
			
			if (error) {
				console.error('❌ [AUTH] Registration error:', error.message);
				// Provide more specific error messages
				if (error.message.includes('fetch')) {
					throw new Error('Network error - please check your internet connection and try again');
				} else if (error.message.includes('already registered')) {
					throw new Error('An account with this email already exists');
				} else {
					throw new Error(error.message);
				}
			}
			
			console.log('✅ [AUTH] Registration successful for:', email);
			// The auth state change listener will handle the rest
		} catch (error) {
			console.error('❌ [AUTH] Registration failed:', error);
			if (error instanceof Error && error.message.includes('timeout')) {
				throw new Error('Connection timeout - please check your internet connection and try again');
			}
			throw error;
		}
	};

	const logout = async () => {
		try {
			console.log('🔄 [AUTH] Logging out...');
			setUser(null);
			setToken(null);
			await supabase.auth.signOut();
			console.log('✅ [AUTH] Logout successful');
		} catch (error) {
			console.error('❌ [AUTH] Logout error:', error);
		}
	};

	const socialLogin = async (provider: "google" | "twitter" | "facebook") => {
		try {
			console.log('🔄 [AUTH] Attempting social login with:', provider);
			
			const { error } = await supabase.auth.signInWithOAuth({ 
				provider,
				options: {
					redirectTo: `${window.location.origin}/dashboard`,
					queryParams: {
						access_type: 'offline',
						prompt: 'consent',
					}
				}
			});
			
			if (error) {
				console.error('❌ [AUTH] Social login error:', error.message);
				if (error.message.includes('fetch')) {
					throw new Error('Network error - please check your internet connection and try again');
				} else {
					throw new Error(error.message);
				}
			}
			
			console.log('✅ [AUTH] Social login initiated for:', provider);
		} catch (error) {
			console.error('❌ [AUTH] Social login failed:', error);
			throw error;
		}
	};

	const value = {
		user,
		token,
		login,
		register,
		logout,
		loading,
		socialLogin,
	};

	console.log('🔄 [AUTH] Rendering AuthProvider with loading:', loading, 'user:', !!user);

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
};

// Fix the Fast Refresh issue by ensuring consistent exports
function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

export { useAuth };