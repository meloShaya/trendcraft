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

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Check for existing session on app load
		const initializeAuth = async () => {
			try {
				console.log('🔄 Initializing authentication...');
				
				// Get the current session from Supabase
				const { data: { session }, error } = await supabase.auth.getSession();
				
				if (error) {
					console.error('❌ Error getting session:', error);
					setLoading(false);
					return;
				}

				if (session?.user) {
					console.log('✅ Found existing session for user:', session.user.id);
					await handleUserSession(session);
				} else {
					console.log('ℹ️ No existing session found');
				}
			} catch (error) {
				console.error('❌ Error initializing auth:', error);
			} finally {
				setLoading(false);
			}
		};

		initializeAuth();

		// Listen for auth state changes
		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('🔄 Auth state changed:', event, session?.user?.id);
			
			if (event === 'SIGNED_IN' && session) {
				console.log('✅ User signed in:', session.user.id);
				await handleUserSession(session);
			} else if (event === 'SIGNED_OUT') {
				console.log('👋 User signed out');
				setUser(null);
				setToken(null);
			} else if (event === 'TOKEN_REFRESHED' && session) {
				console.log('🔄 Token refreshed');
				setToken(session.access_token);
			}
		});

		return () => subscription.unsubscribe();
	}, []);

	const handleUserSession = async (session: any) => {
		try {
			// Fetch user profile from our users table
			const { data: userProfile, error: userError } = await supabase
				.from("users")
				.select("*")
				.eq("id", session.user.id)
				.single();

			if (!userError && userProfile) {
				console.log('✅ Found user profile:', userProfile.username);
				setUser(userProfile);
				setToken(session.access_token);
			} else if (userError?.code === 'PGRST116') {
				// User profile doesn't exist, create it
				console.log('🔄 Creating user profile...');
				const { data: newUser, error: createError } = await supabase
					.from('users')
					.insert({
						id: session.user.id,
						email: session.user.email,
						username: session.user.user_metadata?.username || 
							session.user.user_metadata?.preferred_username || 
							session.user.email?.split('@')[0] || 'user',
						full_name: session.user.user_metadata?.full_name || 
							session.user.user_metadata?.name || null,
						avatar_url: session.user.user_metadata?.avatar_url || 
							session.user.user_metadata?.picture || null,
						bio: null
					})
					.select()
					.single();

				if (!createError && newUser) {
					console.log('✅ Created user profile:', newUser.username);
					setUser(newUser);
					setToken(session.access_token);
					
					// Auto-connect social account if applicable
					await autoConnectSocialAccount(session, newUser.id);
				} else {
					console.error('❌ Error creating user profile:', createError);
				}
			} else {
				console.error('❌ Error fetching user profile:', userError);
			}
		} catch (error) {
			console.error('❌ Error handling user session:', error);
		}
	};

	const autoConnectSocialAccount = async (session: any, userId: string) => {
		try {
			const provider = session.user.app_metadata?.provider;
			if (!provider || provider === 'email') return;

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
			}
		} catch (error) {
			console.error('❌ Error auto-connecting social account:', error);
		}
	};

	const login = async (email: string, password: string) => {
		try {
			console.log('🔄 Attempting login for:', email);
			
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});
			
			if (error) {
				console.error('❌ Login error:', error.message);
				throw new Error(error.message);
			}
			
			console.log('✅ Login successful for:', email);
			// The auth state change listener will handle setting user and token
		} catch (error) {
			console.error('❌ Login failed:', error);
			throw error;
		}
	};

	const register = async (
		username: string,
		email: string,
		password: string
	) => {
		try {
			console.log('🔄 Attempting registration for:', email);
			
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: { 
					data: { username },
					emailRedirectTo: undefined // Disable email confirmation
				},
			});
			
			if (error) {
				console.error('❌ Registration error:', error.message);
				throw new Error(error.message);
			}
			
			console.log('✅ Registration successful for:', email);
			// The auth state change listener will handle the rest
		} catch (error) {
			console.error('❌ Registration failed:', error);
			throw error;
		}
	};

	const logout = async () => {
		try {
			console.log('🔄 Logging out...');
			setUser(null);
			setToken(null);
			await supabase.auth.signOut();
			console.log('✅ Logout successful');
		} catch (error) {
			console.error('❌ Logout error:', error);
		}
	};

	const socialLogin = async (provider: "google" | "twitter" | "facebook") => {
		try {
			console.log('🔄 Attempting social login with:', provider);
			
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
				console.error('❌ Social login error:', error.message);
				throw new Error(error.message);
			}
			
			console.log('✅ Social login initiated for:', provider);
		} catch (error) {
			console.error('❌ Social login failed:', error);
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

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
};