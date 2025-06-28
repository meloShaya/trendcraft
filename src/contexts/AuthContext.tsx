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
				// Get the current session from Supabase
				const { data: { session }, error } = await supabase.auth.getSession();
				
				if (error) {
					console.error('Error getting session:', error);
					setLoading(false);
					return;
				}

				if (session?.user) {
					// Fetch user profile from our users table
					const { data: userProfile, error: userError } = await supabase
						.from("users")
						.select("*")
						.eq("id", session.user.id)
						.single();

					if (!userError && userProfile) {
						setUser(userProfile);
						setToken(session.access_token);
					} else {
						// If user profile doesn't exist, create it
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
							setUser(newUser);
							setToken(session.access_token);
						}
					}
				}
			} catch (error) {
				console.error('Error initializing auth:', error);
			} finally {
				setLoading(false);
			}
		};

		initializeAuth();

		// Listen for auth state changes
		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('Auth state changed:', event, session?.user?.id);
			
			if (event === 'SIGNED_IN' && session) {
				// Handle social login success
				try {
					// Check if user exists in our users table
					const { data: existingUser, error: fetchError } = await supabase
						.from('users')
						.select('*')
						.eq('id', session.user.id)
						.single();

					if (fetchError && fetchError.code === 'PGRST116') {
						// User doesn't exist, create them
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
							setUser(newUser);
							
							// Auto-connect social account
							await autoConnectSocialAccount(session, newUser.id);
						}
					} else if (!fetchError && existingUser) {
						// User exists, update their info
						const { data: updatedUser } = await supabase
							.from('users')
							.update({
								full_name: session.user.user_metadata?.full_name || 
									session.user.user_metadata?.name || existingUser.full_name,
								avatar_url: session.user.user_metadata?.avatar_url || 
									session.user.user_metadata?.picture || existingUser.avatar_url,
								last_login_at: new Date().toISOString()
							})
							.eq('id', session.user.id)
							.select()
							.single();

						if (updatedUser) {
							setUser(updatedUser);
							
							// Auto-connect social account if not already connected
							await autoConnectSocialAccount(session, updatedUser.id);
						}
					}

					setToken(session.access_token);
				} catch (error) {
					console.error('Error handling social login:', error);
				}
			} else if (event === 'SIGNED_OUT') {
				setUser(null);
				setToken(null);
			} else if (event === 'TOKEN_REFRESHED' && session) {
				// Update token when it's refreshed
				setToken(session.access_token);
			}
		});

		return () => subscription.unsubscribe();
	}, []);

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
			console.error('Error auto-connecting social account:', error);
		}
	};

	const login = async (email: string, password: string) => {
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error) throw new Error(error.message);
		
		// Fetch user profile from our users table
		const { data: userProfile, error: profileError } = await supabase
			.from('users')
			.select('*')
			.eq('id', data.user.id)
			.single();

		if (profileError) {
			console.error('Error fetching user profile:', profileError);
			// Create a basic user object if profile fetch fails
			const basicUser: User = {
				id: data.user.id,
				email: data.user.email || '',
				username: data.user.user_metadata?.username || data.user.email?.split('@')[0] || 'user',
				full_name: data.user.user_metadata?.full_name || null,
				bio: null,
				avatar_url: null,
				is_active: true,
				is_premium: false,
				last_login_at: new Date().toISOString(),
				created_at: data.user.created_at,
				updated_at: new Date().toISOString()
			};
			setUser(basicUser);
		} else {
			setUser(userProfile);
		}
		
		setToken(data.session.access_token);
	};

	const register = async (
		username: string,
		email: string,
		password: string
	) => {
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { username } },
		});
		if (error) throw new Error(error.message);
		
		if (data.user) {
			// Create user profile in our users table
			const { data: userProfile, error: profileError } = await supabase
				.from('users')
				.insert({
					id: data.user.id,
					email: data.user.email,
					username: username,
					full_name: null,
					bio: null,
					avatar_url: null
				})
				.select()
				.single();

			if (profileError) {
				console.error('Error creating user profile:', profileError);
				// Create a basic user object if profile creation fails
				const basicUser: User = {
					id: data.user.id,
					email: data.user.email || '',
					username: username,
					full_name: null,
					bio: null,
					avatar_url: null,
					is_active: true,
					is_premium: false,
					last_login_at: new Date().toISOString(),
					created_at: data.user.created_at,
					updated_at: new Date().toISOString()
				};
				setUser(basicUser);
			} else {
				setUser(userProfile);
			}
			
			if (data.session) {
				setToken(data.session.access_token);
			}
		}
	};

	const logout = () => {
		setUser(null);
		setToken(null);
		supabase.auth.signOut();
	};

	const socialLogin = async (provider: "google" | "twitter" | "facebook") => {
		const { error } = await supabase.auth.signInWithOAuth({ 
			provider,
			options: {
				redirectTo: `${window.location.origin}/dashboard`
			}
		});
		if (error) throw new Error(error.message);
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