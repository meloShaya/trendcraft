import React, { useState, useEffect } from "react";
import { Check, Plus, AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface Platform {
	id: string;
	name: string;
	icon: string;
	connected: boolean;
	username?: string;
	followers?: number;
	color: string;
}

interface PlatformConnectionsProps {
	onConnect: (platformId: string) => void;
	onDisconnect: (platformId: string) => void;
}

const PlatformConnections: React.FC<PlatformConnectionsProps> = ({
	onConnect,
	onDisconnect,
}) => {
	const { user } = useAuth();
	const [platforms, setPlatforms] = useState<Platform[]>([
		{
			id: "twitter",
			name: "X (Twitter)",
			icon: "𝕏",
			connected: false,
			color: "bg-black text-white",
		},
		{
			id: "linkedin",
			name: "LinkedIn",
			icon: "in",
			connected: false,
			color: "bg-blue-600 text-white",
		},
		{
			id: "instagram",
			name: "Instagram",
			icon: "📷",
			connected: false,
			color: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
		},
		{
			id: "facebook",
			name: "Facebook",
			icon: "f",
			connected: false,
			color: "bg-blue-500 text-white",
		},
		{
			id: "tiktok",
			name: "TikTok",
			icon: "🎵",
			connected: false,
			color: "bg-black text-white",
		},
	]);

	useEffect(() => {
		const fetchConnections = async () => {
			if (!user) return;
			const { data, error } = await supabase
				.from("user_social_accounts")
				.select("*")
				.eq("user_id", user.id);
			if (!error && data) {
				setPlatforms((prev) =>
					prev.map((platform) => {
						const connected = data.find(
							(acc) =>
								acc.platform === platform.id && acc.is_connected
						);
						return connected
							? {
									...platform,
									connected: true,
									username: connected.platform_username,
									followers: connected.follower_count,
							  }
							: {
									...platform,
									connected: false,
									username: undefined,
									followers: undefined,
							  };
					})
				);
			}
		};
		fetchConnections();
	}, [user]);

	const handleConnect = async (platformId: string) => {
		// Redirect to Supabase OAuth for this platform
		window.location.href = `/api/auth/oauth/${platformId}`;
	};

	const handleDisconnect = async (platformId: string) => {
		if (!user) return;
		await supabase
			.from("user_social_accounts")
			.update({ is_connected: false })
			.eq("user_id", user.id)
			.eq("platform", platformId);
		setPlatforms((prev) =>
			prev.map((platform) =>
				platform.id === platformId
					? {
							...platform,
							connected: false,
							username: undefined,
							followers: undefined,
					  }
					: platform
			)
		);
		onDisconnect(platformId);
	};

	const formatFollowers = (count?: number) => {
		if (!count) return "";
		if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
		return count.toString();
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
					Connected Accounts
				</h3>
				<div className="text-sm text-gray-500 dark:text-gray-400">
					{platforms.filter((p) => p.connected).length} of{" "}
					{platforms.length} connected
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{platforms.map((platform) => (
					<div
						key={platform.id}
						className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
					>
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center space-x-3">
								<div
									className={`w-10 h-10 rounded-lg ${platform.color} flex items-center justify-center text-lg font-bold`}
								>
									{platform.icon}
								</div>
								<div>
									<h4 className="font-medium text-gray-900 dark:text-white text-sm">
										{platform.name}
									</h4>
									{platform.connected &&
										platform.username && (
											<p className="text-xs text-gray-500 dark:text-gray-400">
												@{platform.username}
											</p>
										)}
								</div>
							</div>

							<div className="flex items-center space-x-2">
								{platform.connected ? (
									<div className="flex items-center text-green-600 dark:text-green-400">
										<Check className="h-4 w-4" />
									</div>
								) : (
									<div className="flex items-center text-gray-400">
										<AlertCircle className="h-4 w-4" />
									</div>
								)}
							</div>
						</div>

						{platform.connected && platform.followers && (
							<div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
								{formatFollowers(platform.followers)} followers
							</div>
						)}

						<div className="flex space-x-2">
							{platform.connected ? (
								<>
									<button
										onClick={() =>
											handleDisconnect(platform.id)
										}
										className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
									>
										Disconnect
									</button>
									<button className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
										<ExternalLink className="h-4 w-4" />
									</button>
								</>
							) : (
								<button
									onClick={() => handleConnect(platform.id)}
									className="flex-1 flex items-center justify-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
								>
									<Plus className="h-4 w-4 mr-2" />
									Connect
								</button>
							)}
						</div>
					</div>
				))}
			</div>

			<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
				<div className="flex items-start space-x-3">
					<div className="flex-shrink-0">
						<AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
					</div>
					<div>
						<h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">
							Platform Integration
						</h4>
						<p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
							Connect your social media accounts to publish
							content directly from TrendCraft. Your credentials
							are securely stored and encrypted.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PlatformConnections;
