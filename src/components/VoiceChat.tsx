import React, { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Zap, X, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface VoiceChatProps {
  onContentGenerated?: (content: any) => void;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ onContentGenerated }) => {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleMicClick = () => {
    setShowComingSoon(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowComingSoon(false);
  };

  // Don't render if no token
  if (!token) {
    return null;
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center group transition-all duration-300 hover:scale-110"
        >
          <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}
      
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-80 sm:w-96 h-[500px] sm:h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 sm:p-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-semibold text-sm sm:text-base truncate">Tessa, your AI Partner</h3>
                <div className="flex items-center space-x-1 text-xs text-blue-100">
                  <span>Voice Features</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleClose}
              className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
            {!showComingSoon ? (
              <>
                {/* Welcome Message */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] sm:max-w-[80%] p-2 sm:p-3 rounded-2xl text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
                    <span className="break-words">
                      Hi! I'm Tessa, your creative AI partner. I'm here to help you create amazing content using voice commands!
                    </span>
                    <span className="text-xs opacity-70 text-gray-500 dark:text-gray-400 block mt-1">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="max-w-[85%] sm:max-w-[80%] p-2 sm:p-3 rounded-2xl text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
                    <span className="break-words">
                      Click the microphone below to start our conversation and let's create some viral content together! 🎤✨
                    </span>
                    <span className="text-xs opacity-70 text-gray-500 dark:text-gray-400 block mt-1">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              /* Coming Soon Message */
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Voice Features Coming Soon! 🎉
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 px-4">
                    We're working hard to bring you amazing voice-powered content creation. 
                    This feature will be available very soon!
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mx-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                        What's Coming:
                      </h4>
                      <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                        <li>• Voice-to-text content generation</li>
                        <li>• AI-powered voice responses</li>
                        <li>• Real-time conversation with Tessa</li>
                        <li>• Voice commands for content creation</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowComingSoon(false)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all text-sm"
                >
                  Back to Chat
                </button>
              </div>
            )}
          </div>
          
          {/* Controls */}
          {!showComingSoon && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center space-x-3 sm:space-x-4 mb-2 sm:mb-3">
                <button
                  onClick={handleMicClick}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto transition-all duration-300 bg-blue-600 text-white hover:bg-blue-700 hover:scale-105"
                >
                  <Mic className="h-5 w-5 sm:h-7 sm:w-7" />
                </button>
              </div>
              
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Click mic to start voice conversation
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default VoiceChat;