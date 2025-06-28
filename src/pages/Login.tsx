import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Zap, Eye, EyeOff, Loader, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const Login: React.FC = () => {
	const [isLogin, setIsLogin] = useState(true);
	const [showPassword, setShowPassword] = useState(false);
	const [formData, setFormData] = useState({
		username: "",
		email: "",
		password: "",
	});
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

	const { user, login, register, socialLogin, loading: authLoading } = useAuth();

	console.log('🔄 [LOGIN] Component state:', { 
		authLoading, 
		user: !!user, 
		formLoading: loading,
		isLogin,
		connectionStatus
	});

	// Check connection status
	useEffect(() => {
		const checkConnection = async () => {
			try {
				// Simple connectivity check
				const response = await fetch('https://www.google.com/favicon.ico', { 
					mode: 'no-cors',
					cache: 'no-cache'
				});
				setConnectionStatus('connected');
			} catch (error) {
				console.error('❌ [LOGIN] Connection check failed:', error);
				setConnectionStatus('disconnected');
			}
		};

		checkConnection();
		
		// Check connection every 30 seconds
		const interval = setInterval(checkConnection, 30000);
		return () => clearInterval(interval);
	}, []);

	// Add effect to handle navigation after successful auth
	useEffect(() => {
		if (user && !authLoading) {
			console.log('✅ [LOGIN] User authenticated, should redirect to dashboard');
		}
	}, [user, authLoading]);

	// Don't redirect if still loading auth state
	if (authLoading) {
		console.log('🔄 [LOGIN] Auth still loading, showing loading screen');
		return (
			<div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-600 dark:text-gray-400">Loading...</p>
				</div>
			</div>
		);
	}

	if (user) {
		console.log('✅ [LOGIN] User authenticated, redirecting to dashboard');
		return <Navigate to="/dashboard" replace />;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		
		console.log('🔄 [LOGIN] Form submitted:', { isLogin, email: formData.email });
		
		// Check connection first
		if (connectionStatus === 'disconnected') {
			setError("No internet connection. Please check your network and try again.");
			return;
		}
		
		// Validate form
		if (!formData.email || !formData.password) {
			const errorMsg = "Please fill in all required fields";
			console.error('❌ [LOGIN] Validation error:', errorMsg);
			setError(errorMsg);
			return;
		}
		
		if (!isLogin && !formData.username) {
			const errorMsg = "Username is required for registration";
			console.error('❌ [LOGIN] Validation error:', errorMsg);
			setError(errorMsg);
			return;
		}
		
		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(formData.email)) {
			setError("Please enter a valid email address");
			return;
		}
		
		// Validate password length
		if (formData.password.length < 6) {
			setError("Password must be at least 6 characters long");
			return;
		}
		
		setError("");
		setLoading(true);

		try {
			if (isLogin) {
				console.log('🔄 [LOGIN] Submitting login form...');
				await login(formData.email, formData.password);
			} else {
				console.log('🔄 [LOGIN] Submitting registration form...');
				await register(
					formData.username,
					formData.email,
					formData.password
				);
			}
			// Success - the auth context will handle navigation
			console.log('✅ [LOGIN] Form submission successful');
		} catch (err: any) {
			console.error('❌ [LOGIN] Form submission error:', err);
			
			// Provide user-friendly error messages
			let errorMessage = err.message || 'An error occurred. Please try again.';
			
			if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('timeout')) {
				errorMessage = 'Connection failed. Please check your internet connection and try again.';
				setConnectionStatus('disconnected');
			} else if (errorMessage.includes('Invalid login credentials')) {
				errorMessage = 'Invalid email or password. Please check your credentials and try again.';
			} else if (errorMessage.includes('already registered')) {
				errorMessage = 'An account with this email already exists. Please try logging in instead.';
			}
			
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
		// Clear error when user starts typing
		if (error) setError("");
	};

	const handleSocialLogin = async (provider: "google" | "twitter" | "facebook") => {
		try {
			setError("");
			setLoading(true);
			console.log('🔄 [LOGIN] Initiating social login with:', provider);
			
			// Check connection first
			if (connectionStatus === 'disconnected') {
				throw new Error("No internet connection. Please check your network and try again.");
			}
			
			await socialLogin(provider);
		} catch (err: any) {
			console.error('❌ [LOGIN] Social login error:', err);
			
			let errorMessage = err.message || 'Social login failed. Please try again.';
			if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
				errorMessage = 'Connection failed. Please check your internet connection and try again.';
				setConnectionStatus('disconnected');
			}
			
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	console.log('🔄 [LOGIN] Rendering login form');

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
			<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8">
				<div className="text-center mb-8">
					<div className="flex justify-center mb-4">
						<div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
							<Zap className="h-8 w-8 text-white" />
						</div>
					</div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">
						TrendCraft
					</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">
						{isLogin ? "Welcome back" : "Create your account"}
					</p>
					
					{/* Connection Status Indicator */}
					<div className="flex items-center justify-center mt-3">
						{connectionStatus === 'checking' && (
							<div className="flex items-center text-yellow-600 dark:text-yellow-400">
								<Loader className="h-4 w-4 animate-spin mr-2" />
								<span className="text-sm">Checking connection...</span>
							</div>
						)}
						{connectionStatus === 'connected' && (
							<div className="flex items-center text-green-600 dark:text-green-400">
								<Wifi className="h-4 w-4 mr-2" />
								<span className="text-sm">Connected</span>
							</div>
						)}
						{connectionStatus === 'disconnected' && (
							<div className="flex items-center text-red-600 dark:text-red-400">
								<WifiOff className="h-4 w-4 mr-2" />
								<span className="text-sm">No connection</span>
							</div>
						)}
					</div>
				</div>

				{/* Social Login Buttons */}
				<div className="space-y-3 mb-6">
					<button
						onClick={() => handleSocialLogin("google")}
						disabled={loading || connectionStatus === 'disconnected'}
						className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl py-3 px-4 font-medium text-gray-700 dark:text-white shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
							<svg className="w-4 h-4" viewBox="0 0 24 24">
								<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
								<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
								<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
								<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
							</svg>
						</div>
						<span className="text-sm font-medium">Continue with Google</span>
					</button>

					<button
						onClick={() => handleSocialLogin("twitter")}
						disabled={loading || connectionStatus === 'disconnected'}
						className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-800 border-2 border-black rounded-xl py-3 px-4 font-medium text-white shadow-sm transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<div className="w-5 h-5 flex items-center justify-center">
							<svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
								<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
							</svg>
						</div>
						<span className="text-sm font-medium">Continue with X</span>
					</button>

					<button
						onClick={() => handleSocialLogin("facebook")}
						disabled={loading || connectionStatus === 'disconnected'}
						className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] border-2 border-[#1877F2] rounded-xl py-3 px-4 font-medium text-white shadow-sm transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<div className="w-5 h-5 flex items-center justify-center">
							<svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
								<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
							</svg>
						</div>
						<span className="text-sm font-medium">Continue with Facebook</span>
					</button>
				</div>

				{/* Divider */}
				<div className="relative mb-6">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
					</div>
					<div className="relative flex justify-center text-sm">
						<span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
							Or continue with email
						</span>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{!isLogin && (
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Username
							</label>
							<input
								type="text"
								name="username"
								value={formData.username}
								onChange={handleInputChange}
								className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
								placeholder="Enter your username"
								required={!isLogin}
								disabled={loading}
								minLength={3}
								maxLength={30}
							/>
						</div>
					)}

					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Email
						</label>
						<input
							type="email"
							name="email"
							value={formData.email}
							onChange={handleInputChange}
							className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
							placeholder="Enter your email"
							required
							disabled={loading}
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Password
						</label>
						<div className="relative">
							<input
								type={showPassword ? "text" : "password"}
								name="password"
								value={formData.password}
								onChange={handleInputChange}
								className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
								placeholder="Enter your password"
								required
								disabled={loading}
								minLength={6}
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
								disabled={loading}
							>
								{showPassword ? (
									<EyeOff className="h-5 w-5" />
								) : (
									<Eye className="h-5 w-5" />
								)}
							</button>
						</div>
					</div>

					{error && (
						<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
							<div className="flex items-center">
								<AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
								<p className="text-sm text-red-800 dark:text-red-200">
									{error}
								</p>
							</div>
						</div>
					)}

					<button
						type="submit"
						disabled={loading || connectionStatus === 'disconnected'}
						className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
					>
						{loading ? (
							<>
								<Loader className="animate-spin h-5 w-5 mr-2" />
								{isLogin ? "Signing in..." : "Creating account..."}
							</>
						) : (
							<>
								{isLogin ? "Sign In" : "Create Account"}
							</>
						)}
					</button>
				</form>

				<div className="mt-6 text-center">
					<button
						onClick={() => {
							console.log('🔄 [LOGIN] Switching form mode from', isLogin ? 'login' : 'register', 'to', !isLogin ? 'login' : 'register');
							setIsLogin(!isLogin);
							setError("");
							setFormData({ username: "", email: "", password: "" });
						}}
						disabled={loading}
						className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors disabled:opacity-50"
					>
						{isLogin
							? "Don't have an account? Sign up"
							: "Already have an account? Sign in"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default Login;