import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Edit, Trash2, Calendar, BarChart3, Zap, Heart, MessageCircle, Share } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

interface Post {
  id: number;
  content: string;
  platform: string;
  viralScore: number;
  engagement: {
    likes: number;
    retweets: number;
    comments: number;
    shares: number;
  };
  hashtags: string[];
  status: string;
  scheduledFor: string;
  createdAt: string;
  performance?: {
    impressions: number;
    reach: number;
    clickThrough: number;
  };
}

const Posts: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/posts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        setPosts(data);
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchPosts();
    }
  }, [token]);

  const deletePost = async (postId: number) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setPosts(posts.filter(post => post.id !== postId));
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handleCreatePost = () => {
    navigate('/generate');
  };

  const filteredPosts = posts.filter(post => {
    if (filter === 'all') return true;
    return post.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'twitter': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'linkedin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'instagram': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400';
      case 'facebook': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">My Posts</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Manage your content and track performance</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2 sm:gap-4">
          {['all', 'published', 'scheduled', 'draft'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {status === 'all' ? 'All Posts' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredPosts.map((post) => (
          <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                    {post.status}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(post.platform)}`}>
                    {post.platform}
                  </span>
                  <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                    <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="text-xs sm:text-sm font-medium">{post.viralScore}/100</span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  Created {format(new Date(post.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
              
              <div className="flex space-x-2 self-start">
                <button className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  <Edit className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => deletePost(post.id)}
                  className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="mb-4">
              <p className="text-gray-900 dark:text-white leading-relaxed text-sm sm:text-base">
                {post.content}
              </p>
            </div>

            {/* Hashtags */}
            {post.hashtags && post.hashtags.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {post.hashtags.map((hashtag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded"
                    >
                      {hashtag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement Stats */}
            {post.status === 'published' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <div className="flex items-center justify-center text-red-500 mb-1">
                    <Heart className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="font-medium text-xs sm:text-sm">{post.engagement.likes}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Likes</p>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center text-blue-500 mb-1">
                    <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="font-medium text-xs sm:text-sm">{post.engagement.comments}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Comments</p>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center text-green-500 mb-1">
                    <Share className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="font-medium text-xs sm:text-sm">{post.engagement.retweets}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Shares</p>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center text-purple-500 mb-1">
                    <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="font-medium text-xs sm:text-sm">{post.performance?.impressions || 0}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Impressions</p>
                </div>
              </div>
            )}

            {/* Scheduled Info */}
            {post.status === 'scheduled' && (
              <div className="flex items-center text-blue-600 dark:text-blue-400 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
                <span className="text-xs sm:text-sm">
                  Scheduled for {format(new Date(post.scheduledFor), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredPosts.length === 0 && (
        <div className="text-center py-8 sm:py-12">
          <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
            No posts found
          </h3>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-4 px-4">
            {filter === 'all' 
              ? "You haven't created any posts yet. Start generating content to see them here."
              : `No ${filter} posts found. Try selecting a different filter.`
            }
          </p>
          <button 
            onClick={handleCreatePost}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            Create Your First Post
          </button>
        </div>
      )}
    </div>
  );
};

export default Posts;