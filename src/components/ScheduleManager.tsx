import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Edit, Trash2, Play, Pause, AlertCircle } from 'lucide-react';
import { format, isAfter, isBefore, addDays, addWeeks, addMonths } from 'date-fns';

interface ScheduledPost {
  id: string;
  content: string;
  platforms: string[];
  scheduledTime: Date;
  status: 'pending' | 'published' | 'failed' | 'paused';
  recurring?: {
    type: 'daily' | 'weekly' | 'monthly';
    endDate?: Date;
  };
  createdAt: Date;
  lastAttempt?: Date;
  error?: string;
}

interface ScheduleManagerProps {
  onEdit: (postId: string) => void;
  onDelete: (postId: string) => void;
  onTogglePause: (postId: string) => void;
}

const ScheduleManager: React.FC<ScheduleManagerProps> = ({ onEdit, onDelete, onTogglePause }) => {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'failed'>('all');
  const [loading, setLoading] = useState(true);

  // Mock data - in real app, this would come from API
  useEffect(() => {
    const mockPosts: ScheduledPost[] = [
      {
        id: '1',
        content: '🚀 Exciting news! Our AI-powered content generator just got a major update. Now with better trend analysis and viral prediction capabilities! #AI #ContentCreation #TechUpdate',
        platforms: ['twitter', 'linkedin'],
        scheduledTime: addDays(new Date(), 1),
        status: 'pending',
        createdAt: new Date(),
        recurring: {
          type: 'weekly',
          endDate: addMonths(new Date(), 3)
        }
      },
      {
        id: '2',
        content: 'The future of social media is here! 🌟 Check out how AI is revolutionizing content creation and helping creators go viral. What are your thoughts on AI-generated content?',
        platforms: ['instagram', 'facebook'],
        scheduledTime: addDays(new Date(), 2),
        status: 'pending',
        createdAt: new Date()
      },
      {
        id: '3',
        content: 'Just published: "10 Tips for Creating Viral Content in 2024" - a comprehensive guide based on our latest trend analysis. Link in bio! 📈',
        platforms: ['twitter', 'linkedin', 'facebook'],
        scheduledTime: new Date(Date.now() - 86400000), // Yesterday
        status: 'published',
        createdAt: new Date(Date.now() - 172800000) // 2 days ago
      },
      {
        id: '4',
        content: 'Behind the scenes: How our AI analyzes millions of posts to predict viral content. The technology is fascinating! 🤖',
        platforms: ['tiktok'],
        scheduledTime: new Date(Date.now() - 3600000), // 1 hour ago
        status: 'failed',
        createdAt: new Date(Date.now() - 86400000),
        error: 'Authentication failed. Please reconnect your TikTok account.'
      }
    ];

    setTimeout(() => {
      setScheduledPosts(mockPosts);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredPosts = scheduledPosts.filter(post => {
    if (filter === 'all') return true;
    return post.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'published': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'paused': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getPlatformNames = (platforms: string[]) => {
    const names: { [key: string]: string } = {
      twitter: 'X',
      linkedin: 'LinkedIn',
      instagram: 'Instagram',
      facebook: 'Facebook',
      tiktok: 'TikTok'
    };
    return platforms.map(p => names[p] || p).join(', ');
  };

  const getNextRecurringDate = (post: ScheduledPost) => {
    if (!post.recurring) return null;
    
    let nextDate = new Date(post.scheduledTime);
    const now = new Date();
    
    while (isBefore(nextDate, now)) {
      switch (post.recurring.type) {
        case 'daily':
          nextDate = addDays(nextDate, 1);
          break;
        case 'weekly':
          nextDate = addWeeks(nextDate, 1);
          break;
        case 'monthly':
          nextDate = addMonths(nextDate, 1);
          break;
      }
    }
    
    return nextDate;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Scheduled Posts
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {scheduledPosts.filter(p => p.status === 'pending').length} pending
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'published', 'failed'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {status === 'all' ? 'All Posts' : status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-2 text-xs">
                ({scheduledPosts.filter(p => p.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {filteredPosts.map((post) => {
          const nextRecurring = getNextRecurringDate(post);
          
          return (
            <div key={post.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                      {post.status}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {getPlatformNames(post.platforms)}
                    </span>
                    {post.recurring && (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                        {post.recurring.type}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-900 dark:text-white text-sm leading-relaxed mb-2">
                    {post.content.length > 150 ? `${post.content.substring(0, 150)}...` : post.content}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => onEdit(post.id)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onTogglePause(post.id)}
                    className="p-2 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
                    title={post.status === 'paused' ? 'Resume' : 'Pause'}
                  >
                    {post.status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => onDelete(post.id)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Schedule Info */}
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {post.status === 'pending' 
                        ? `Scheduled for ${format(post.scheduledTime, 'MMM d, yyyy')}`
                        : `Posted on ${format(post.scheduledTime, 'MMM d, yyyy')}`
                      }
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{format(post.scheduledTime, 'h:mm a')}</span>
                  </div>
                </div>
                
                {nextRecurring && post.status === 'pending' && (
                  <div className="text-xs text-purple-600 dark:text-purple-400">
                    Next: {format(nextRecurring, 'MMM d, h:mm a')}
                  </div>
                )}
              </div>

              {/* Error Message */}
              {post.status === 'failed' && post.error && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-900 dark:text-red-200">
                        Publishing Failed
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {post.error}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPosts.length === 0 && (
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No scheduled posts
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'all' 
              ? "You haven't scheduled any posts yet."
              : `No ${filter} posts found.`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default ScheduleManager;