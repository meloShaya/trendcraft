import React, { useState, useEffect } from "react";
import {
	Calendar,
	Flame,
	Target,
	TrendingUp,
	Award,
	Clock,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
	format,
	startOfMonth,
	endOfMonth,
	eachDayOfInterval,
	isSameDay,
	parseISO,
} from "date-fns";

interface StreakData {
	date: string;
	posted: boolean;
	postCount: number;
}

interface PostingStreakData {
	currentStreak: number;
	longestStreak: number;
	lastPostDate: string | null;
	streakData: StreakData[];
}

const PostingStreak: React.FC = () => {
	const { token } = useAuth();
	const [streakData, setStreakData] = useState<PostingStreakData | null>(
		null
	);
	const [loading, setLoading] = useState(true);
	const [selectedMonth, setSelectedMonth] = useState(new Date());

	useEffect(() => {
		const fetchStreakData = async () => {
			try {
				const response = await fetch("/api/user/streak", {
					headers: { Authorization: `Bearer ${token}` },
				});
				
				if (response.ok) {
					const data = await response.json();
					setStreakData(data);
				} else {
					// Set default streak data if API fails
					setStreakData({
						currentStreak: 0,
						longestStreak: 0,
						lastPostDate: null,
						streakData: []
					});
				}
			} catch (error) {
				console.error("Error fetching streak data:", error);
				// Set default streak data on error
				setStreakData({
					currentStreak: 0,
					longestStreak: 0,
					lastPostDate: null,
					streakData: []
				});
			} finally {
				setLoading(false);
			}
		};

		if (token) {
			fetchStreakData();
		}
	}, [token]);

	const updateStreak = async () => {
		try {
			const response = await fetch("/api/user/streak/update", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
			});
			
			if (response.ok) {
				const data = await response.json();
				setStreakData(data);
			}
		} catch (error) {
			console.error("Error updating streak:", error);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	if (!streakData) {
		return (
			<div className="text-center py-8">
				<p className="text-gray-500 dark:text-gray-400">
					Unable to load streak data
				</p>
			</div>
		);
	}

	// Ensure streakData.streakData is an array
	const streakDataArray = Array.isArray(streakData.streakData) ? streakData.streakData : [];

	// Generate calendar days for the selected month
	const monthStart = startOfMonth(selectedMonth);
	const monthEnd = endOfMonth(selectedMonth);
	const calendarDays = eachDayOfInterval({
		start: monthStart,
		end: monthEnd,
	});

	// Get posting data for a specific date
	const getPostingData = (date: Date) => {
		const dateStr = format(date, "yyyy-MM-dd");
		return streakDataArray.find((data) => data.date === dateStr);
	};

	// Get intensity level for visualization
	const getIntensityLevel = (postCount: number) => {
		if (postCount === 0) return 0;
		if (postCount === 1) return 1;
		if (postCount === 2) return 2;
		if (postCount === 3) return 3;
		return 4; // 4+ posts
	};

	const getIntensityColor = (level: number) => {
		switch (level) {
			case 0:
				return "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700";
			case 1:
				return "bg-purple-200 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700";
			case 2:
				return "bg-purple-400 dark:bg-purple-700 border-purple-500 dark:border-purple-600";
			case 3:
				return "bg-purple-600 dark:bg-purple-600 border-purple-700 dark:border-purple-500";
			case 4:
				return "bg-purple-800 dark:bg-purple-500 border-purple-900 dark:border-purple-400";
			default:
				return "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700";
		}
	};

	const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

	return (
		<div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center space-x-3">
					<div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
						<Flame className="h-5 w-5 text-white" />
					</div>
					<div>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
							Posting Streak
						</h3>
						<p className="text-sm text-gray-500 dark:text-gray-400">
							Longest streak: {streakData.longestStreak} days
						</p>
					</div>
				</div>

				<div className="flex items-center space-x-2">
					<select
						value={format(selectedMonth, "yyyy-MM")}
						onChange={(e) =>
							setSelectedMonth(new Date(e.target.value + "-01"))
						}
						className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
					>
						{Array.from({ length: 12 }, (_, i) => {
							const date = new Date();
							date.setMonth(date.getMonth() - i);
							return (
								<option key={i} value={format(date, "yyyy-MM")}>
									{format(date, "MMM yyyy")}
								</option>
							);
						})}
					</select>
				</div>
			</div>

			{/* Current Streak Stats */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
				<div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
					<div className="flex items-center justify-center mb-2">
						<Flame className="h-6 w-6 text-purple-600 dark:text-purple-400" />
					</div>
					<div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
						{streakData.currentStreak}
					</div>
					<div className="text-xs text-purple-600 dark:text-purple-400">
						Current Streak
					</div>
				</div>

				<div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
					<div className="flex items-center justify-center mb-2">
						<Award className="h-6 w-6 text-blue-600 dark:text-blue-400" />
					</div>
					<div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
						{streakData.longestStreak}
					</div>
					<div className="text-xs text-blue-600 dark:text-blue-400">
						Best Streak
					</div>
				</div>

				<div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
					<div className="flex items-center justify-center mb-2">
						<Target className="h-6 w-6 text-green-600 dark:text-green-400" />
					</div>
					<div className="text-2xl font-bold text-green-700 dark:text-green-300">
						{streakDataArray.filter((d) => d.posted).length}
					</div>
					<div className="text-xs text-green-600 dark:text-green-400">
						Days Posted
					</div>
				</div>

				<div className="text-center p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
					<div className="flex items-center justify-center mb-2">
						<TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
					</div>
					<div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
						{streakDataArray.reduce((sum, d) => sum + d.postCount, 0)}
					</div>
					<div className="text-xs text-orange-600 dark:text-orange-400">
						Total Posts
					</div>
				</div>
			</div>

			{/* Calendar Grid */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
						Post Frequency - {format(selectedMonth, "MMMM yyyy")}
					</h4>
					<div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
						<span>Less</span>
						<div className="flex space-x-1">
							{[0, 1, 2, 3, 4].map((level) => (
								<div
									key={level}
									className={`w-3 h-3 rounded-sm border ${getIntensityColor(
										level
									)}`}
								/>
							))}
						</div>
						<span>More</span>
					</div>
				</div>

				{/* Week day headers */}
				<div className="grid grid-cols-7 gap-1 mb-2">
					{weekDays.map((day) => (
						<div
							key={day}
							className="text-xs text-gray-500 dark:text-gray-400 text-center py-1"
						>
							{day}
						</div>
					))}
				</div>

				{/* Calendar grid */}
				<div className="grid grid-cols-7 gap-1">
					{/* Empty cells for days before month start */}
					{Array.from(
						{ length: (monthStart.getDay() + 6) % 7 },
						(_, i) => (
							<div key={`empty-${i}`} className="aspect-square" />
						)
					)}

					{/* Calendar days */}
					{calendarDays.map((day) => {
						const postingData = getPostingData(day);
						const intensityLevel = getIntensityLevel(
							postingData?.postCount || 0
						);
						const isToday = isSameDay(day, new Date());

						return (
							<div
								key={format(day, "yyyy-MM-dd")}
								className={`aspect-square rounded-sm border-2 flex items-center justify-center text-xs font-medium transition-all hover:scale-110 cursor-pointer ${getIntensityColor(
									intensityLevel
								)} ${
									isToday
										? "ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-gray-800"
										: ""
								}`}
								title={`${format(day, "MMM d, yyyy")} - ${
									postingData?.postCount || 0
								} posts`}
							>
								<span
									className={`${
										intensityLevel > 2
											? "text-white"
											: "text-gray-700 dark:text-gray-300"
									}`}
								>
									{format(day, "d")}
								</span>
							</div>
						);
					})}
				</div>
			</div>

			{/* Streak Motivation */}
			<div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
				<div className="flex items-center space-x-3">
					<Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
					<div>
						<p className="text-sm font-medium text-purple-900 dark:text-purple-200">
							{streakData.currentStreak === 0
								? "Start your posting streak today!"
								: streakData.currentStreak === 1
								? "Great start! Keep the momentum going."
								: streakData.currentStreak < 7
								? `${streakData.currentStreak} days strong! You're building a habit.`
								: streakData.currentStreak < 30
								? `Amazing ${streakData.currentStreak}-day streak! You're on fire! 🔥`
								: `Incredible ${streakData.currentStreak}-day streak! You're a posting legend! 🏆`}
						</p>
						{streakData.lastPostDate && (
							<p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
								Last post:{" "}
								{format(
									parseISO(streakData.lastPostDate),
									"MMM d, yyyy"
								)}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default PostingStreak;