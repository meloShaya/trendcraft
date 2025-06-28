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
		const savedToken = localStorage.getItem("token");
		const savedUser = localStorage.getItem("user");

		if (savedToken && savedUser) {
			setToken(savedToken);
			setUser(JSON.parse(savedUser));
		}
		setLoading(false);
	}, []);

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
			localStorage.setItem("user", JSON.stringify(basicUser));
		} else {
			setUser(userProfile);
			localStorage.setItem("user", JSON.stringify(userProfile));
		}
		
		setToken(data.session.access_token);
		localStorage.setItem("token", data.session.access_token);
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
				localStorage.setItem("user", JSON.stringify(basicUser));
			} else {
				setUser(userProfile);
				localStorage.setItem("user", JSON.stringify(userProfile));
			}
			
			if (data.session) {
				setToken(data.session.access_token);
				localStorage.setItem("token", data.session.access_token);
			}
		}
	};

	const logout = () => {
		setUser(null);
		setToken(null);
		localStorage.removeItem("token");
		localStorage.removeItem("user");
		supabase.auth.signOut();
	};

	const socialLogin = async (provider: "google" | "twitter" | "facebook") => {
		const { error } = await supabase.auth.signInWithOAuth({ provider });
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