import React from 'react';
import { AlertCircle, CheckCircle, Lightbulb, Hash, Target, Image, Video, MessageSquare } from 'lucide-react';
import { 
  PLATFORM_CONFIGS, 
  validateContentLength, 
  generateOptimalHashtags,
  generatePlatformSpecificCTA,
  getVisualContentSuggestions,
  getPlatformContentTips
} from '../utils/platformOptimization';

interface PlatformOptimizationPanelProps {
  platform: string;
  content: string;
  topic: string;
  category?: string;
  onHashtagSuggestion: (hashtags: string[]) => void;
  onCTASuggestion: (cta: string) => void;
}

const PlatformOptimizationPanel: React.FC<PlatformOptimizationPanelProps> = ({
  platform,
  content,
  topic,
  category,
  onHashtagSuggestion,
  onCTASuggestion
}) => {
  const config = PLATFORM_CONFIGS[platform];
  const validation = validateContentLength(content, platform);
  const visualSuggestions = getVisualContentSuggestions(platform);
  const contentTips = getPlatformContentTips(platform);

  if (!config) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Platform optimization not available for {platform}
        </p>
      </div>
    );
  }

  const handleGenerateHashtags = () => {
    const hashtags = generateOptimalHashtags(topic, platform, category);
    onHashtagSuggestion(hashtags);
  };

  const handleGenerateCTA = () => {
    const cta = generatePlatformSpecificCTA(platform, topic);
    onCTASuggestion(cta);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
          {platform} Optimization
        </h3>
      </div>

      {/* Character Count Validation */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Character Count</span>
          <div className="flex items-center space-x-2">
            {validation.isValid ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${
              validation.isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {validation.currentLength}/{validation.maxLength}
            </span>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              validation.isValid 
                ? validation.currentLength > validation.maxLength * 0.9 
                  ? 'bg-yellow-500' 
                  : 'bg-green-500'
                : 'bg-red-500'
            }`}
            style={{ 
              width: `${Math.min((validation.currentLength / validation.maxLength) * 100, 100)}%` 
            }}
          />
        </div>
        
        {validation.suggestion && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            {validation.suggestion}
          </p>
        )}
      </div>

      {/* Hashtag Strategy */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Hash className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Hashtag Strategy</span>
          </div>
          <button
            onClick={handleGenerateHashtags}
            className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors"
          >
            Generate
          </button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          {config.hashtagStrategy}
        </p>
        <div className="text-xs text-gray-500 dark:text-gray-500">
          Optimal: {config.limits.optimalHashtags} hashtags | Max: {config.limits.maxHashtags}
        </div>
      </div>

      {/* CTA Suggestions */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Call-to-Action</span>
          </div>
          <button
            onClick={handleGenerateCTA}
            className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
          >
            Suggest CTA
          </button>
        </div>
        <div className="space-y-1">
          {config.ctaSuggestions.slice(0, 3).map((cta, index) => (
            <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
              • {cta}
            </div>
          ))}
        </div>
      </div>

      {/* Visual Content Suggestions */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          {config.limits.supportsVideo ? (
            <Video className="h-4 w-4 text-red-600 dark:text-red-400" />
          ) : (
            <Image className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Visual Content</span>
        </div>
        <div className="space-y-2">
          {visualSuggestions.slice(0, 3).map((suggestion, index) => (
            <div key={index} className="flex items-start space-x-2">
              <Lightbulb className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-400">{suggestion}</span>
            </div>
          ))}
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
            <span className="flex items-center">
              <Image className="h-3 w-3 mr-1" />
              Images: {config.limits.supportsImages ? '✓' : '✗'}
            </span>
            <span className="flex items-center">
              <Video className="h-3 w-3 mr-1" />
              Video: {config.limits.supportsVideo ? '✓' : '✗'}
            </span>
          </div>
        </div>
      </div>

      {/* Content Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Platform Tips</span>
        </div>
        <div className="space-y-2">
          {contentTips.map((tip, index) => (
            <div key={index} className="flex items-start space-x-2">
              <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0" />
              <span className="text-xs text-blue-800 dark:text-blue-200">{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlatformOptimizationPanel;