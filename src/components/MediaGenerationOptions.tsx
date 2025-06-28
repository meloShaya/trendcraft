import React from 'react';
import { Image, Video, Crown, Clock } from 'lucide-react';

interface MediaGenerationOptionsProps {
  selectedOption: 'none' | 'image' | 'video';
  onOptionChange: (option: 'none' | 'image' | 'video') => void;
  isPremium: boolean;
  onUpgradeClick: () => void;
}

const MediaGenerationOptions: React.FC<MediaGenerationOptionsProps> = ({
  selectedOption,
  onOptionChange,
  isPremium,
  onUpgradeClick
}) => {
  const options = [
    {
      id: 'none' as const,
      label: 'Text Only',
      description: 'Generate text content only',
      icon: null,
      isPremium: false,
      comingSoon: false
    },
    {
      id: 'image' as const,
      label: 'Include Image',
      description: 'AI-generated image with Google AI',
      icon: Image,
      isPremium: true,
      comingSoon: true
    },
    {
      id: 'video' as const,
      label: 'Include Video',
      description: 'AI-generated video with Tavus AI',
      icon: Video,
      isPremium: true,
      comingSoon: true
    }
  ];

  const handleOptionClick = (optionId: 'none' | 'image' | 'video') => {
    const option = options.find(opt => opt.id === optionId);
    
    if (option?.isPremium && !isPremium) {
      onUpgradeClick();
      return;
    }
    
    if (option?.comingSoon && optionId !== 'none') {
      // For now, just show that it's coming soon
      return;
    }
    
    onOptionChange(optionId);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Media Generation
      </label>
      
      <div className="space-y-2">
        {options.map((option) => (
          <div
            key={option.id}
            className={`relative flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
              selectedOption === option.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            } ${
              (option.isPremium && !isPremium) || option.comingSoon
                ? 'opacity-75'
                : ''
            }`}
            onClick={() => handleOptionClick(option.id)}
          >
            <input
              type="radio"
              name="mediaOption"
              value={option.id}
              checked={selectedOption === option.id}
              onChange={() => handleOptionClick(option.id)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              disabled={(option.isPremium && !isPremium) || option.comingSoon}
            />
            
            <div className="ml-3 flex-1 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {option.icon && (
                  <option.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                    {option.isPremium && (
                      <Crown className="h-4 w-4 text-yellow-500" />
                    )}
                    {option.comingSoon && (
                      <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 text-xs rounded-full flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {option.description}
                  </p>
                </div>
              </div>
              
              {option.isPremium && !isPremium && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpgradeClick();
                  }}
                  className="px-3 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {selectedOption !== 'none' && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start space-x-2">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                Feature Coming Soon!
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {selectedOption === 'image' 
                  ? 'AI image generation with Google AI is currently in development.'
                  : 'AI video generation with Tavus AI is currently in development.'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaGenerationOptions;