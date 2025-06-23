import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, MessageCircle, X, Loader, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface VoiceChatProps {
  onContentGenerated?: (content: any) => void;
}

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isGenerating?: boolean;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ onContentGenerated }) => {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize conversation with welcome message
  useEffect(() => {
    if (isOpen && conversation.length === 0) {
      setConversation([{
        id: Date.now().toString(),
        type: 'assistant',
        text: "Hi! I'm your AI assistant for TrendCraft. You can ask me to generate content like 'Create a witty Twitter post about AI' or 'Give me trending topics for Instagram'. How can I help you today?",
        timestamp: new Date()
      }]);
    }
  }, [isOpen, conversation.length]);

  const connectToElevenLabs = async () => {
    try {
      setConnectionError(null);
      
      // Create WebSocket connection to ElevenLabs
      const ws = new WebSocket('wss://api.elevenlabs.io/v1/convai/conversation?agent_id=your_agent_id');
      
      ws.onopen = () => {
        console.log('Connected to ElevenLabs');
        setIsConnected(true);
        
        // Send authentication
        ws.send(JSON.stringify({
          type: 'auth',
          api_key: import.meta.env.VITE_ELEVENLABS_API_KEY || 'sk_3bec2eca01b53efdf34dc6ba5c61a223d5caf072824d1d2a'
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await handleElevenLabsMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Failed to connect to voice service');
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
        setIsListening(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error connecting to ElevenLabs:', error);
      setConnectionError('Failed to initialize voice service');
    }
  };

  const handleElevenLabsMessage = async (data: any) => {
    switch (data.type) {
      case 'conversation_initiation_metadata':
        console.log('Conversation initiated');
        break;
        
      case 'audio':
        // Handle incoming audio from ElevenLabs
        if (data.audio_event?.audio_base_64) {
          await playAudioResponse(data.audio_event.audio_base_64);
        }
        break;
        
      case 'user_transcript':
        // Handle transcribed user speech
        if (data.user_transcript?.text) {
          await handleUserTranscript(data.user_transcript.text);
        }
        break;
        
      case 'agent_response':
        // Handle agent text response
        if (data.agent_response?.text) {
          addMessage('assistant', data.agent_response.text);
        }
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const handleUserTranscript = async (transcript: string) => {
    console.log('User said:', transcript);
    
    // Add user message to conversation
    addMessage('user', transcript);
    
    // Process the transcript to extract content generation parameters
    const contentRequest = parseContentRequest(transcript);
    
    if (contentRequest) {
      setIsProcessing(true);
      
      try {
        // Call our backend to generate content
        const response = await fetch('/api/content/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(contentRequest)
        });

        if (response.ok) {
          const generatedContent = await response.json();
          
          // Add generated content to conversation
          const responseText = `Here's your ${contentRequest.platform} post: "${generatedContent.content}"`;
          addMessage('assistant', responseText);
          
          // Notify parent component
          if (onContentGenerated) {
            onContentGenerated(generatedContent);
          }
          
          // Send response back to ElevenLabs for TTS
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'agent_response',
              text: responseText
            }));
          }
        } else {
          const errorText = "I'm sorry, I couldn't generate that content right now. Please try again.";
          addMessage('assistant', errorText);
          
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'agent_response',
              text: errorText
            }));
          }
        }
      } catch (error) {
        console.error('Error generating content:', error);
        const errorText = "I encountered an error while generating your content. Please try again.";
        addMessage('assistant', errorText);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Handle general conversation
      const responseText = "I can help you create social media content! Try saying something like 'Create a funny Twitter post about coffee' or 'Give me trending topics for Instagram'.";
      addMessage('assistant', responseText);
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'agent_response',
          text: responseText
        }));
      }
    }
  };

  const parseContentRequest = (text: string): any | null => {
    const lowerText = text.toLowerCase();
    
    // Extract platform
    let platform = 'twitter'; // default
    if (lowerText.includes('instagram') || lowerText.includes('insta')) platform = 'instagram';
    else if (lowerText.includes('linkedin')) platform = 'linkedin';
    else if (lowerText.includes('facebook')) platform = 'facebook';
    else if (lowerText.includes('tiktok') || lowerText.includes('tik tok')) platform = 'tiktok';
    
    // Extract tone
    let tone = 'professional'; // default
    if (lowerText.includes('funny') || lowerText.includes('witty') || lowerText.includes('humorous')) tone = 'humorous';
    else if (lowerText.includes('casual') || lowerText.includes('relaxed')) tone = 'casual';
    else if (lowerText.includes('inspiring') || lowerText.includes('motivational')) tone = 'inspirational';
    
    // Extract topic - look for content generation keywords
    const contentKeywords = ['post about', 'content about', 'tweet about', 'create', 'generate', 'write'];
    let topic = '';
    
    for (const keyword of contentKeywords) {
      const index = lowerText.indexOf(keyword);
      if (index !== -1) {
        // Extract everything after the keyword
        const afterKeyword = text.substring(index + keyword.length).trim();
        // Remove common ending words
        topic = afterKeyword.replace(/\b(please|thanks|thank you)\b/gi, '').trim();
        break;
      }
    }
    
    // If we found a topic and it seems like a content request, return the parameters
    if (topic && (lowerText.includes('post') || lowerText.includes('content') || lowerText.includes('create') || lowerText.includes('generate'))) {
      return {
        topic,
        platform,
        tone,
        includeHashtags: true,
        targetAudience: ''
      };
    }
    
    return null;
  };

  const addMessage = (type: 'user' | 'assistant', text: string) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date()
    };
    
    setConversation(prev => [...prev, message]);
  };

  const playAudioResponse = async (audioBase64: string) => {
    try {
      setIsSpeaking(true);
      
      // Convert base64 to audio blob
      const audioData = atob(audioBase64);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        uint8Array[i] = audioData.charCodeAt(i);
      }
      
      const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };
      
      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsSpeaking(false);
    }
  };

  const startListening = async () => {
    try {
      if (!isConnected) {
        await connectToElevenLabs();
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (event) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const inputData = event.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          
          // Send audio data to ElevenLabs
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio_data: Array.from(pcm16)
          }));
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsListening(true);
    } catch (error) {
      console.error('Error starting audio capture:', error);
      setConnectionError('Failed to access microphone');
    }
  };

  const stopListening = () => {
    setIsListening(false);
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
    }
  };

  const closeChat = () => {
    setIsOpen(false);
    stopListening();
    stopSpeaking();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConversation([]);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeChat();
    };
  }, []);

  return (
    <>
      {/* Floating Microphone Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center group"
          title="Voice Assistant"
        >
          <Mic className="h-6 w-6 group-hover:scale-110 transition-transform" />
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
        </button>
      )}

      {/* Voice Chat Interface */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">Voice Assistant</h3>
                <p className="text-xs opacity-90">
                  {isConnected ? 'Connected' : 'Connecting...'}
                </p>
              </div>
            </div>
            <button
              onClick={closeChat}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Connection Error */}
          {connectionError && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3">
              <p className="text-red-700 dark:text-red-300 text-sm">{connectionError}</p>
            </div>
          )}

          {/* Conversation */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversation.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl">
                  <div className="flex items-center space-x-2">
                    <Loader className="h-4 w-4 animate-spin text-blue-600" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Generating content...</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={toggleListening}
                disabled={!isConnected}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                }`}
                title={isListening ? 'Stop listening' : 'Start listening'}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              
              <button
                onClick={stopSpeaking}
                disabled={!isSpeaking}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isSpeaking
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                }`}
                title="Stop speaking"
              >
                {isSpeaking ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            </div>
            
            <div className="text-center mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Click mic to start'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceChat;