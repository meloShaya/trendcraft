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

// Demo user data for local memory fallback
const DEMO_USER: User = {
	id: "demo-user-123",
	username: "demo_creator",
	email: "demo@trendcraft.com",
	full_name: "Demo Creator",
	bio: "AI-powered content creator using TrendCraft",
	avatar_url: "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop",
	is_active: true,
	is_premium: true, // Give demo user premium features
	last_login_at: new Date().toISOString(),
	created_at: new Date().toISOString(),
	updated_at: new Date().toISOString()
};

const DEMO_TOKEN = "demo-token-123";

// Check if we should use local memory (when Supabase fails)
const USE_LOCAL_MEMORY = true; // Set to true to force local memory mode

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		const initializeAuth = async () => {
			try {
				console.log('🔄 [AUTH] Initializing authentication...');
				
				// Check if we should use local memory mode
				if (USE_LOCAL_MEMORY) {
					console.log('🔄 [AUTH] Using local memory mode with demo data');
					
					// Check if user was previously logged in (localStorage)
					const savedUser = localStorage.getItem('demo_user');
					const savedToken = localStorage.getItem('demo_token');
					
					if (savedUser && savedToken && mounted) {
						console.log('✅ [AUTH] Found saved demo user session');
						setUser(JSON.parse(savedUser));
						setToken(savedToken);
					}
					
					if (mounted) {
						setLoading(false);
					}
					return;
				}
				
				// Original Supabase logic (kept intact)
				console.log('🔄 [AUTH] Testing Supabase connection...');
				
				const connectionTest = supabase
					.from('users')
					.select('count')
					.limit(1);
				
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
			} finally {
				if (mounted) {
					console.log('✅ [AUTH] Auth initialization complete, setting loading to false');
					setLoading(false);
				}
			}
		};

		initializeAuth();

		// Only set up Supabase listener if not using local memory
		if (!USE_LOCAL_MEMORY) {
			console.log('🔄 [AUTH] Setting up auth state listener...');
			const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
				console.log('🔄 [AUTH] Auth state changed:', event, session?.user?.id);
				
				if (!mounted) return;

				try {
					if (event === 'SIGNED_IN' && session) {
						console.log('✅ [AUTH] User signed in:', session.user.id);
						setLoading(true);
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
		}

		return () => {
			mounted = false;
		};
	}, []);

	const handleUserSession = async (session: any) => {
		try {
			console.log('🔄 [AUTH] Handling user session for:', session.user.id);
			
			setToken(session.access_token);
			console.log('✅ [AUTH] Token set');
			
			const { data: userProfile, error: userError } = await supabase
				.from("users")
				.select("*")
				.eq("id", session.user.id)
				.maybeSingle();

			if (!userError && userProfile) {
				console.log('✅ [AUTH] Found user profile:', userProfile.username);
				setUser(userProfile);
			} else if (!userProfile) {
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
					await autoConnectSocialAccount(session, newUser.id);
				} else {
					console.error('❌ [AUTH] Error creating user profile:', createError);
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

			const { data: existingAccount } = await supabase
				.from('user_social_accounts')
				.select('*')
				.eq('user_id', userId)
				.eq('platform', provider === 'google' ? 'google' : provider)
				.single();

			if (!existingAccount) {
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
			
			// Local memory mode - simple demo login
			if (USE_LOCAL_MEMORY) {
				console.log('🔄 [AUTH] Using local memory login');
				
				// Simple validation - any email/password combo works for demo
				if (email && password) {
					console.log('✅ [AUTH] Demo login successful');
					setUser(DEMO_USER);
					setToken(DEMO_TOKEN);
					
					// Save to localStorage for persistence
					localStorage.setItem('demo_user', JSON.stringify(DEMO_USER));
					localStorage.setItem('demo_token', DEMO_TOKEN);
					return;
				} else {
					throw new Error('Please enter both email and password');
				}
			}
			
			// Original Supabase login logic (kept intact)
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
				if (error.message.includes('fetch')) {
					throw new Error('Network error - please check your internet connection and try again');
				} else if (error.message.includes('Invalid login credentials')) {
					throw new Error('Invalid email or password');
				} else {
					throw new Error(error.message);
				}
			}
			
			console.log('✅ [AUTH] Login successful for:', email);
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
			
			// Local memory mode - simple demo registration
			if (USE_LOCAL_MEMORY) {
				console.log('🔄 [AUTH] Using local memory registration');
				
				// Simple validation
				if (username && email && password) {
					console.log('✅ [AUTH] Demo registration successful');
					
					// Create a new demo user with provided details
					const newDemoUser = {
						...DEMO_USER,
						username,
						email,
						full_name: username,
						id: `demo-user-${Date.now()}`
					};
					
					setUser(newDemoUser);
					setToken(DEMO_TOKEN);
					
					// Save to localStorage for persistence
					localStorage.setItem('demo_user', JSON.stringify(newDemoUser));
					localStorage.setItem('demo_token', DEMO_TOKEN);
					return;
				} else {
					throw new Error('Please fill in all fields');
				}
			}
			
			// Original Supabase registration logic (kept intact)
			const registerPromise = supabase.auth.signUp({
				email,
				password,
				options: { 
					data: { username },
					emailRedirectTo: undefined
				},
			});
			
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Registration request timeout - please check your internet connection')), 15000);
			});
			
			const { data, error } = await Promise.race([registerPromise, timeoutPromise]) as any;
			
			if (error) {
				console.error('❌ [AUTH] Registration error:', error.message);
				if (error.message.includes('fetch')) {
					throw new Error('Network error - please check your internet connection and try again');
				} else if (error.message.includes('already registered')) {
					throw new Error('An account with this email already exists');
				} else {
					throw new Error(error.message);
				}
			}
			
			console.log('✅ [AUTH] Registration successful for:', email);
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
			
			// Local memory mode
			if (USE_LOCAL_MEMORY) {
				console.log('🔄 [AUTH] Local memory logout');
				setUser(null);
				setToken(null);
				localStorage.removeItem('demo_user');
				localStorage.removeItem('demo_token');
				console.log('✅ [AUTH] Demo logout successful');
				return;
			}
			
			// Original Supabase logout
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
			
			// Local memory mode - simulate social login
			if (USE_LOCAL_MEMORY) {
				console.log('🔄 [AUTH] Demo social login with:', provider);
				
				// Create demo user with social provider info
				const socialDemoUser = {
					...DEMO_USER,
					username: `${provider}_user`,
					email: `demo@${provider}.com`,
					full_name: `Demo ${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
					id: `demo-${provider}-${Date.now()}`
				};
				
				setUser(socialDemoUser);
				setToken(DEMO_TOKEN);
				
				localStorage.setItem('demo_user', JSON.stringify(socialDemoUser));
				localStorage.setItem('demo_token', DEMO_TOKEN);
				
				console.log('✅ [AUTH] Demo social login successful');
				return;
			}
			
			// Original Supabase social login logic (kept intact)
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

	console.log('🔄 [AUTH] Rendering AuthProvider with loading:', loading, 'user:', !!user, 'localMode:', USE_LOCAL_MEMORY);

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
};

function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

export { useAuth };