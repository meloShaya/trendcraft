# 🚀 TrendCraft - AI-Powered Social Media Content Generator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green.svg)](https://supabase.com/)

> Create viral social media content with AI-powered trend analysis and content generation. TrendCraft analyzes real-time trends, predicts viral potential, and generates engaging content across all major social platforms.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 🤖 AI-Powered Content Generation
- **Advanced AI Models**: Powered by Google Gemini 2.0 Flash for intelligent content creation
- **Three-Step Generation Process**: Context search → Trend analysis → Viral content creation
- **Platform Optimization**: Tailored content for Twitter, LinkedIn, Instagram, Facebook, TikTok
- **Viral Score Prediction**: AI-powered engagement prediction before posting

### 📈 Real-Time Trend Analysis
- **Live Trend Monitoring**: Real-time trends from Twitter/X with location-based filtering
- **50+ Global Locations**: Worldwide, US, UK, Canada, Japan, and more
- **Trend Context Search**: Enhanced with Firecrawl for real-world context
- **Smart Categorization**: Auto-categorizes trends by topic and industry

### 🎯 Social Media Management
- **Multi-Platform Support**: Twitter/X, LinkedIn, Instagram, Facebook, TikTok
- **Social Authentication**: OAuth login with Google, Facebook, Twitter/X
- **Auto-Account Detection**: Automatically connects social accounts during signup
- **Content Scheduling**: Advanced scheduling with recurring posts
- **Performance Analytics**: Comprehensive engagement and reach analytics

### 🎤 Voice AI Integration
- **Voice Content Generation**: Create content using voice commands
- **Text-to-Speech**: AI-powered voice responses with ElevenLabs
- **Real-time Transcription**: Live speech-to-text processing
- **Voice Chat Interface**: Interactive AI assistant for content creation

### 📊 Analytics & Insights
- **Performance Tracking**: Detailed analytics for all published content
- **Posting Streaks**: Gamified content creation with streak tracking
- **Viral Score Analysis**: Predictive analytics for content performance
- **Engagement Metrics**: Likes, shares, comments, and reach tracking

## 🛠 Tech Stack

### Frontend
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Recharts** - Data visualization and charts
- **Lucide React** - Beautiful icon library

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **Supabase** - Backend-as-a-Service with PostgreSQL
- **WebSocket** - Real-time communication for voice features

### AI & External Services
- **Google Gemini AI** - Advanced language model for content generation
- **ElevenLabs** - Text-to-speech and voice synthesis
- **Firecrawl** - Web scraping for trend context
- **RapidAPI (Twitter)** - Real-time social media trends
- **OAuth Providers** - Google, Facebook, Twitter authentication

### Database
- **PostgreSQL** (via Supabase) - Relational database
- **Row Level Security** - Secure data access
- **Real-time subscriptions** - Live data updates

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Supabase Account** - For database and authentication
- **API Keys** for external services (see Environment Variables)

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/trendcraft.git
cd trendcraft
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Services
GEMINI_API_KEY=your_google_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key

# Social Media APIs
X_RapidAPI_Key=your_rapidapi_key_for_twitter

# Social Authentication
SOCIAL_AUTH_GOOGLE_OAUTH2_KEY=your_google_oauth_client_id
SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET=your_google_oauth_client_secret
SOCIAL_AUTH_FACEBOOK_KEY=your_facebook_app_id
SOCIAL_AUTH_FACEBOOK_SECRET=your_facebook_app_secret
SOCIAL_AUTH_TWITTER_KEY=your_twitter_api_key
SOCIAL_AUTH_TWITTER_SECRET=your_twitter_api_secret

# Server Configuration
PORT=3001
JWT_SECRET=your_jwt_secret_key
```

### 4. Database Setup
Run the SQL migration in your Supabase dashboard:

```sql
-- Copy and paste the migration from supabase/migrations/
-- This creates all necessary tables with proper relationships and security
```

### 5. Configure Social Authentication
In your Supabase dashboard:
1. Go to **Authentication → Providers**
2. Enable **Google**, **Facebook**, and **Twitter**
3. Add your OAuth credentials from the respective platforms

### 6. Start Development Servers
```bash
npm run dev
```

This starts both the frontend (port 5173) and backend (port 3001) servers.

## 🔐 Environment Variables

### Required Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase Dashboard → Settings → API |
| `GEMINI_API_KEY` | Google Gemini AI API key | Google AI Studio |

### Optional Variables (for full functionality)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `ELEVENLABS_API_KEY` | Text-to-speech API | ElevenLabs Dashboard |
| `FIRECRAWL_API_KEY` | Web scraping for context | Firecrawl Dashboard |
| `X_RapidAPI_Key` | Twitter trends API | RapidAPI → Twitter API |
| `SOCIAL_AUTH_GOOGLE_*` | Google OAuth credentials | Google Cloud Console |
| `SOCIAL_AUTH_FACEBOOK_*` | Facebook OAuth credentials | Facebook Developers |
| `SOCIAL_AUTH_TWITTER_*` | Twitter OAuth credentials | Twitter Developer Portal |

## 🗄 Database Setup

### Supabase Configuration

1. **Create a new Supabase project**
2. **Run the migration SQL** (provided in previous messages)
3. **Enable Row Level Security** (automatically configured)
4. **Set up social authentication providers**

### Database Schema Overview

```sql
-- Core Tables
users                 -- User accounts and profiles
user_auth_providers   -- OAuth provider connections
user_social_accounts  -- Connected social media accounts
user_settings        -- User preferences and settings
user_streaks         -- Posting streak tracking

-- Content Management
posts                -- Generated and published content
post_analytics       -- Performance metrics and engagement data

-- Trend Analysis
trends               -- Cached trending topics
trend_contexts       -- Additional context for trends

-- System
api_usage_logs       -- API usage tracking and billing
```

## 📡 API Documentation

### Authentication Endpoints

#### `POST /api/auth/login`
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "profile": {
      "name": "User Name",
      "avatar": "avatar_url",
      "bio": "User bio"
    }
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  }
}
```

#### `POST /api/auth/signup`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "username",
  "full_name": "User Name"
}
```

#### `POST /api/auth/logout`
Logout and invalidate session.

### Content Generation Endpoints

#### `POST /api/content/generate`
Generate AI-powered social media content.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "topic": "AI in content creation",
  "platform": "twitter",
  "tone": "professional",
  "includeHashtags": true,
  "targetAudience": "tech enthusiasts",
  "locationWoeid": "1"
}
```

**Response:**
```json
{
  "content": "🚀 AI is revolutionizing content creation...",
  "viralScore": 87,
  "hashtags": ["#AI", "#ContentCreation", "#TechTrends"],
  "platform": "twitter",
  "recommendations": {
    "bestPostTime": "14:00-16:00 UTC",
    "expectedReach": 5000,
    "engagementPrediction": {
      "likes": 450,
      "retweets": 89,
      "comments": 23
    }
  },
  "trendAnalysis": "This topic is trending due to...",
  "contextData": {
    "sources": [...],
    "location": "Worldwide"
  }
}
```

### Trends Endpoints

#### `GET /api/trends`
Get real-time trending topics.

**Query Parameters:**
- `platform` (string): Platform to get trends from (default: "twitter")
- `location` (string): Location WOEID (default: "1" for Worldwide)
- `limit` (number): Number of trends to return (default: 20)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": 1,
    "keyword": "AI Revolution",
    "category": "Technology",
    "trendScore": 94,
    "volume": 125000,
    "growth": "+45%",
    "platforms": ["twitter"],
    "relatedHashtags": ["#AI", "#Tech", "#Innovation"],
    "peakTime": "14:00-16:00 UTC",
    "demographics": {
      "age": "18-34",
      "interests": ["technology", "innovation"]
    }
  }
]
```

#### `GET /api/trends/locations`
Get supported locations for trend analysis.

**Response:**
```json
[
  { "name": "Worldwide", "woeid": 1 },
  { "name": "United States", "woeid": 23424977 },
  { "name": "United Kingdom", "woeid": 23424975 }
]
```

### Posts Management Endpoints

#### `GET /api/posts`
Get user's posts.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "content": "Post content...",
    "platform": "twitter",
    "status": "published",
    "viral_score": 87,
    "hashtags": ["#AI", "#Tech"],
    "scheduled_for": "2024-01-15T10:00:00Z",
    "published_at": "2024-01-15T10:00:00Z",
    "created_at": "2024-01-15T09:00:00Z"
  }
]
```

#### `POST /api/posts`
Create a new post.

**Request Body:**
```json
{
  "content": "Post content...",
  "platform": "twitter",
  "status": "draft",
  "viral_score": 87,
  "hashtags": ["#AI", "#Tech"],
  "scheduled_for": "2024-01-15T10:00:00Z"
}
```

#### `PUT /api/posts/:id`
Update an existing post.

#### `DELETE /api/posts/:id`
Delete a post.

### Analytics Endpoints

#### `GET /api/analytics/overview`
Get user's analytics overview.

**Response:**
```json
{
  "totalPosts": 25,
  "totalEngagement": 1250,
  "totalImpressions": 45000,
  "avgViralScore": 78,
  "weeklyGrowth": "+12.5%",
  "topPerformingPost": {
    "id": "uuid",
    "content": "Top performing post...",
    "viral_score": 95
  }
}
```

#### `GET /api/analytics/performance`
Get detailed performance data.

**Response:**
```json
[
  {
    "date": "2024-01-15",
    "impressions": 5000,
    "engagement": 250,
    "clicks": 45,
    "reach": 3500
  }
]
```

### User Management Endpoints

#### `GET /api/user/profile`
Get user profile information.

#### `PUT /api/user/profile`
Update user profile.

#### `GET /api/user/settings`
Get user settings.

#### `PUT /api/user/settings`
Update user settings.

#### `GET /api/user/streak`
Get user's posting streak data.

#### `POST /api/user/streak/update`
Update posting streak (mark today as posted).

### Voice AI Endpoints

#### `POST /api/voice/text-to-speech`
Convert text to speech using ElevenLabs.

**Request Body:**
```json
{
  "text": "Hello, this is a test message",
  "voice": "Rachel"
}
```

**Response:**
```json
{
  "audio": "base64_encoded_audio_data"
}
```

#### `WebSocket /api/voice/stream`
Real-time speech-to-text processing for voice commands.

### Social Accounts Endpoints

#### `GET /api/social/accounts`
Get user's connected social media accounts.

#### `POST /api/social/connect`
Connect a new social media account.

#### `DELETE /api/social/disconnect/:platform`
Disconnect a social media account.

## 📁 Project Structure

```
trendcraft/
├── public/                 # Static assets
├── src/                   # Frontend source code
│   ├── components/        # Reusable React components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Layout.tsx
│   │   ├── PostingStreak.tsx
│   │   ├── PlatformConnections.tsx
│   │   ├── PlatformPreview.tsx
│   │   ├── VoiceChat.tsx
│   │   └── ...
│   ├── contexts/          # React contexts
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── lib/              # Utility libraries
│   │   └── supabase.ts   # Supabase client and types
│   ├── pages/            # Page components
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ContentGenerator.tsx
│   │   ├── Trends.tsx
│   │   ├── Analytics.tsx
│   │   ├── Posts.tsx
│   │   └── Settings.tsx
│   ├── utils/            # Utility functions
│   │   └── platformOptimization.ts
│   ├── App.tsx           # Main App component
│   └── main.tsx          # Entry point
├── server/               # Backend source code
│   ├── index.js          # Express server
│   ├── supabaseClient.js # Server-side Supabase client
│   └── ...
├── supabase/             # Database migrations
│   └── migrations/       # SQL migration files
├── package.json          # Dependencies and scripts
├── tailwind.config.js    # Tailwind CSS configuration
├── vite.config.ts        # Vite configuration
└── README.md            # This file
```

## 🚀 Deployment

### Frontend Deployment (Vercel/Netlify)

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel:**
   ```bash
   npx vercel --prod
   ```

3. **Set environment variables** in your deployment platform

### Backend Deployment (Railway/Heroku)

1. **Ensure all environment variables are set**
2. **Deploy using your preferred platform**
3. **Update CORS settings** for your frontend domain

### Database (Supabase)

1. **Production database** is automatically managed by Supabase
2. **Run migrations** in production environment
3. **Configure authentication providers** for production URLs

### Environment-Specific Configuration

#### Development
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
NODE_ENV=development
```

#### Production
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
NODE_ENV=production
```

## 🔧 Configuration

### Supabase Setup

1. **Create project** at [supabase.com](https://supabase.com)
2. **Run SQL migration** from `supabase/migrations/`
3. **Configure authentication:**
   - Enable email authentication
   - Set up OAuth providers (Google, Facebook, Twitter)
   - Configure redirect URLs
4. **Set up Row Level Security** (included in migration)

### OAuth Provider Setup

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`

#### Facebook OAuth
1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create a new app
3. Add Facebook Login product
4. Configure redirect URIs

#### Twitter OAuth
1. Go to [Twitter Developer Portal](https://developer.twitter.com)
2. Create a new app
3. Generate API keys and tokens
4. Configure callback URLs

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Commit changes:** `git commit -m 'Add amazing feature'`
4. **Push to branch:** `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- **Follow TypeScript best practices**
- **Use Tailwind CSS for styling**
- **Write comprehensive tests**
- **Follow the existing code structure**
- **Update documentation for new features**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Gemini AI** for advanced language processing
- **Supabase** for backend infrastructure
- **ElevenLabs** for voice synthesis
- **RapidAPI** for social media data
- **Tailwind CSS** for beautiful styling
- **React ecosystem** for frontend framework

## 📞 Support

- **Documentation:** [GitHub Wiki](https://github.com/yourusername/trendcraft/wiki)
- **Issues:** [GitHub Issues](https://github.com/yourusername/trendcraft/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/trendcraft/discussions)

---

**Built with ❤️ by the TrendCraft team**

*Create viral content that resonates with your audience using the power of AI.*