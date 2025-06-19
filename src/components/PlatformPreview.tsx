import React from 'react';
import { Heart, MessageCircle, Share, MoreHorizontal, Bookmark, Send, ThumbsUp, Eye, Play } from 'lucide-react';
import { format } from 'date-fns';

interface PlatformPreviewProps {
  platform: string;
  content: string;
  userProfile: {
    name: string;
    username: string;
    avatar: string;
    verified?: boolean;
  };
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  media?: {
    type: 'image' | 'video' | 'link';
    url: string;
    thumbnail?: string;
  }[];
}

const PlatformPreview: React.FC<PlatformPreviewProps> = ({
  platform,
  content,
  userProfile,
  engagement = { likes: 0, comments: 0, shares: 0 },
  media = []
}) => {
  const formatNumber = (num: number) => {
    if (num == null) {
      return '0';
    }
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const renderTwitterPreview = () => (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 max-w-lg mx-auto">
      <div className="flex space-x-3">
        <img
          src={userProfile.avatar}
          alt={userProfile.name}
          className="w-12 h-12 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1">
            <span className="font-bold text-gray-900 dark:text-white text-sm">{userProfile.name}</span>
            {userProfile.verified && (
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            )}
            <span className="text-gray-500 text-sm">@{userProfile.username}</span>
            <span className="text-gray-500 text-sm">·</span>
            <span className="text-gray-500 text-sm">{format(new Date(), 'h:mm a')}</span>
          </div>
          <div className="mt-2">
            <p className="text-gray-900 dark:text-white text-sm leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
            {media.length > 0 && (
              <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                {media[0].type === 'image' && (
                  <img src={media[0].url} alt="Post media" className="w-full h-48 object-cover" />
                )}
                {media[0].type === 'video' && (
                  <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Play className="h-12 w-12 text-white bg-black bg-opacity-50 rounded-full p-3" />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-3 max-w-md">
            <button className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">{formatNumber(engagement.comments)}</span>
            </button>
            <button className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors">
              <Share className="h-4 w-4" />
              <span className="text-sm">{formatNumber(engagement.shares)}</span>
            </button>
            <button className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors">
              <Heart className="h-4 w-4" />
              <span className="text-sm">{formatNumber(engagement.likes)}</span>
            </button>
            <button className="text-gray-500 hover:text-blue-500 transition-colors">
              <Bookmark className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLinkedInPreview = () => (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-w-lg mx-auto">
      <div className="flex items-start space-x-3">
        <img
          src={userProfile.avatar}
          alt={userProfile.name}
          className="w-12 h-12 rounded-full object-cover"
        />
        <div className="flex-1">
          <div className="flex items-center space-x-1">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">{userProfile.name}</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-xs">Professional Title • 1st</p>
          <p className="text-gray-500 text-xs">{format(new Date(), 'h:mm a')}</p>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3">
        <p className="text-gray-900 dark:text-white text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
        {media.length > 0 && (
          <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {media[0].type === 'image' && (
              <img src={media[0].url} alt="Post media" className="w-full h-48 object-cover" />
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors">
          <ThumbsUp className="h-4 w-4" />
          <span className="text-sm">Like</span>
        </button>
        <button className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">Comment</span>
        </button>
        <button className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors">
          <Share className="h-4 w-4" />
          <span className="text-sm">Share</span>
        </button>
        <button className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors">
          <Send className="h-4 w-4" />
          <span className="text-sm">Send</span>
        </button>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        {formatNumber(engagement.likes)} reactions • {formatNumber(engagement.comments)} comments
      </div>
    </div>
  );

  const renderInstagramPreview = () => (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg max-w-sm mx-auto">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-0.5">
            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-full h-full rounded-full object-cover border-2 border-white"
            />
          </div>
          <span className="font-semibold text-gray-900 dark:text-white text-sm">{userProfile.username}</span>
        </div>
        <button className="text-gray-400">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
      
      {media.length > 0 && (
        <div className="aspect-square bg-gray-100 dark:bg-gray-800">
          {media[0].type === 'image' && (
            <img src={media[0].url} alt="Post media" className="w-full h-full object-cover" />
          )}
          {media[0].type === 'video' && (
            <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Play className="h-12 w-12 text-white bg-black bg-opacity-50 rounded-full p-3" />
            </div>
          )}
        </div>
      )}
      
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-4">
            <button className="hover:text-gray-600 transition-colors">
              <Heart className="h-6 w-6" />
            </button>
            <button className="hover:text-gray-600 transition-colors">
              <MessageCircle className="h-6 w-6" />
            </button>
            <button className="hover:text-gray-600 transition-colors">
              <Send className="h-6 w-6" />
            </button>
          </div>
          <button className="hover:text-gray-600 transition-colors">
            <Bookmark className="h-6 w-6" />
          </button>
        </div>
        
        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          {formatNumber(engagement.likes)} likes
        </div>
        
        <div className="text-sm text-gray-900 dark:text-white">
          <span className="font-semibold mr-2">{userProfile.username}</span>
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
        
        <div className="text-sm text-gray-500 mt-1">
          View all {formatNumber(engagement.comments)} comments
        </div>
        
        <div className="text-xs text-gray-400 mt-1 uppercase">
          {format(new Date(), 'h:mm a')}
        </div>
      </div>
    </div>
  );

  const renderFacebookPreview = () => (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-w-lg mx-auto">
      <div className="flex items-start space-x-3">
        <img
          src={userProfile.avatar}
          alt={userProfile.name}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex-1">
          <div className="flex items-center space-x-1">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">{userProfile.name}</span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <span>{format(new Date(), 'h:mm a')}</span>
            <span>·</span>
            <div className="w-3 h-3 bg-gray-400 rounded-sm flex items-center justify-center">
              <span className="text-white text-xs">🌐</span>
            </div>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
      
      <div className="mt-3">
        <p className="text-gray-900 dark:text-white text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
        {media.length > 0 && (
          <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {media[0].type === 'image' && (
              <img src={media[0].url} alt="Post media" className="w-full h-48 object-cover" />
            )}
          </div>
        )}
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>{formatNumber(engagement.likes)} people like this</span>
          <span>{formatNumber(engagement.comments)} comments</span>
        </div>
        
        <div className="flex items-center justify-between">
          <button className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors flex-1 justify-center py-2">
            <ThumbsUp className="h-4 w-4" />
            <span className="text-sm">Like</span>
          </button>
          <button className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors flex-1 justify-center py-2">
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">Comment</span>
          </button>
          <button className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors flex-1 justify-center py-2">
            <Share className="h-4 w-4" />
            <span className="text-sm">Share</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderTikTokPreview = () => (
    <div className="bg-black rounded-lg max-w-sm mx-auto relative overflow-hidden" style={{ aspectRatio: '9/16', height: '400px' }}>
      {media.length > 0 && media[0].type === 'video' ? (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <Play className="h-16 w-16 text-white bg-white bg-opacity-20 rounded-full p-4" />
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="text-4xl mb-2">🎵</div>
            <p className="text-sm px-4">{content}</p>
          </div>
        </div>
      )}
      
      {/* TikTok UI Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-end justify-between">
          <div className="flex-1 mr-4">
            <div className="flex items-center space-x-2 mb-2">
              <img
                src={userProfile.avatar}
                alt={userProfile.name}
                className="w-8 h-8 rounded-full object-cover border-2 border-white"
              />
              <span className="text-white font-semibold text-sm">@{userProfile.username}</span>
            </div>
            <p className="text-white text-sm leading-relaxed">
              {content.length > 100 ? `${content.substring(0, 100)}...` : content}
            </p>
          </div>
          
          <div className="flex flex-col items-center space-y-4">
            <button className="text-white">
              <Heart className="h-8 w-8" />
              <div className="text-xs mt-1">{formatNumber(engagement.likes)}</div>
            </button>
            <button className="text-white">
              <MessageCircle className="h-8 w-8" />
              <div className="text-xs mt-1">{formatNumber(engagement.comments)}</div>
            </button>
            <button className="text-white">
              <Share className="h-8 w-8" />
              <div className="text-xs mt-1">{formatNumber(engagement.shares)}</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreview = () => {
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        return renderTwitterPreview();
      case 'linkedin':
        return renderLinkedInPreview();
      case 'instagram':
        return renderInstagramPreview();
      case 'facebook':
        return renderFacebookPreview();
      case 'tiktok':
        return renderTikTokPreview();
      default:
        return renderTwitterPreview();
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4 text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
          {platform} Preview
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          How your post will appear on {platform}
        </p>
      </div>
      {renderPreview()}
    </div>
  );
};

export default PlatformPreview;