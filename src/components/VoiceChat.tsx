import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader, Zap, X, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// --- Configuration ---
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const VOICE_ID = "rfkTsdZrVWEVhDycUYn9"; // Example: Tessa's voice ID.

// --- Interfaces ---
interface VoiceChatProps {
    onContentGenerated?: (content: any) => void;
}

interface ConversationMessage {
    id: string;
    type: 'user' | 'assistant' | 'error' | 'system';
    text: string;
    timestamp: Date;
}

// --- Main Component ---
const VoiceChat: React.FC<VoiceChatProps> = ({ onContentGenerated }) => {
    const { token } = useAuth(); // Get token from auth context
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [conversation, setConversation] = useState<ConversationMessage[]>([]);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [processingStatus, setProcessingStatus] = useState<string>('');
    
    // Refs
    const sttSocketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const finalTranscriptRef = useRef<string>("");
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const isApiConfigured = ELEVENLABS_API_KEY && ELEVENLABS_API_KEY !== "YOUR_ELEVENLABS_API_KEY_HERE";
    const maxReconnectAttempts = 3;

    useEffect(() => {
        if (isOpen && conversation.length === 0) {
            addMessage('assistant', "Hi! I'm Tessa, your creative partner. How can I help you create today?");
        }
    }, [isOpen]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (sttSocketRef.current) {
            sttSocketRef.current.close();
            sttSocketRef.current = null;
        }
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
        }
    };

    const addMessage = (type: ConversationMessage['type'], text: string) => {
        setConversation(prev => [...prev, { 
            id: Date.now().toString(), 
            type, 
            text, 
            timestamp: new Date() 
        }]);
    };

    const speakText = async (text: string) => {
        if (!isApiConfigured || isMuted) {
            return;
        }

        setIsSpeaking(true);
        setProcessingStatus('Generating speech...');
        
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
        }

        const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
        const headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
        };
        const body = JSON.stringify({ text, model_id: "eleven_turbo_v2" });

        try {
            const response = await fetch(ttsUrl, { method: 'POST', headers, body });
            if (!response.ok) throw new Error(`TTS request failed: ${response.status}`);
            
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audioPlayerRef.current = audio;
            
            setProcessingStatus('Playing audio...');
            await audio.play();
            
            audio.onended = () => {
                setIsSpeaking(false);
                setProcessingStatus('');
                URL.revokeObjectURL(audioUrl);
            };
            
            audio.onerror = () => {
                setIsSpeaking(false);
                setProcessingStatus('');
                addMessage('error', "Audio playback failed.");
                URL.revokeObjectURL(audioUrl);
            };
        } catch (error) {
            console.error("Error with TTS:", error);
            addMessage('error', "Sorry, I couldn't generate audio right now.");
            setIsSpeaking(false);
            setProcessingStatus('');
        }
    };
    
    const processUserRequest = async (transcript: string) => {
        if (!transcript || !token) {
            addMessage('error', 'Authentication required. Please log in.');
            return;
        }
        
        setIsProcessing(true);
        setProcessingStatus('Processing your request...');
        addMessage('user', transcript);
        
        try {
            const response = await fetch('/api/content/generate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(parseContentRequest(transcript))
            });
            
            if (!response.ok) {
                throw new Error(`Backend request failed: ${response.status}`);
            }
            
            const generatedContent = await response.json();
            const verbalResponse = `Sure, here's a draft for ${generatedContent.platform}: ${generatedContent.content}`;
            
            addMessage('assistant', verbalResponse);
            
            if (!isMuted) {
                await speakText(verbalResponse);
            }
            
            if (onContentGenerated) onContentGenerated(generatedContent);
        } catch (error) {
            console.error("Error processing user request:", error);
            const errorMessage = "I'm sorry, I hit a snag. Could you try rephrasing?";
            addMessage('error', errorMessage);
            
            if (!isMuted) {
                await speakText(errorMessage);
            }
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const attemptReconnection = () => {
        if (reconnectAttempts >= maxReconnectAttempts) {
            setConnectionStatus('error');
            addMessage('error', 'Maximum reconnection attempts reached. Please try again later.');
            return;
        }

        setReconnectAttempts(prev => prev + 1);
        setConnectionStatus('connecting');
        addMessage('system', `Reconnecting... (Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);

        const delay = Math.min(2000 * Math.pow(2, reconnectAttempts), 10000); // Exponential backoff with max 10s
        reconnectTimeoutRef.current = setTimeout(() => {
            startListening();
        }, delay);
    };
    
    const startListening = async () => {
        if (isListening || !token) {
            if (!token) {
                addMessage('error', 'Please log in to use voice features.');
            }
            return;
        }
        
        try {
            setConnectionStatus('connecting');
            setProcessingStatus('Requesting microphone access...');
            
            // Check if we already have a stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            streamRef.current = stream;
            
            mediaRecorderRef.current = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            setProcessingStatus('Connecting to voice service...');
            
            // Close existing connection if any
            if (sttSocketRef.current) {
                sttSocketRef.current.close();
            }
            
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const localWsUrl = `${protocol}//${window.location.host}/api/voice/stream`;
            
            const sttSocket = new WebSocket(localWsUrl);
            sttSocketRef.current = sttSocket;

            sttSocket.onopen = () => {
                console.log("Connected to backend proxy WebSocket.");
                setIsListening(true);
                setIsConnected(true);
                setConnectionStatus('connected');
                setReconnectAttempts(0);
                setProcessingStatus('Listening...');
                finalTranscriptRef.current = "";
                
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
                    mediaRecorderRef.current.start(250); // Send data every 250ms
                }
            };

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0 && sttSocket.readyState === WebSocket.OPEN) {
                    sttSocket.send(event.data);
                    resetSilenceTimeout();
                }
            };
            
            sttSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.transcript) {
                        finalTranscriptRef.current += data.transcript;
                        setProcessingStatus('Processing speech...');
                    }
                    if (data.is_final) {
                        setProcessingStatus('Finalizing...');
                        stopListening();
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            sttSocket.onclose = (event) => {
                console.log("Local WebSocket closed:", event.code, event.reason);
                setIsListening(false);
                setIsConnected(false);
                setProcessingStatus('');
                
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
                
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                }
                
                // Only attempt reconnection for unexpected closures
                if (event.code !== 1000 && event.code !== 1001 && reconnectAttempts < maxReconnectAttempts) {
                    setConnectionStatus('error');
                    addMessage('error', `Voice connection lost (${event.code}). Attempting to reconnect...`);
                    attemptReconnection();
                } else {
                    setConnectionStatus('disconnected');
                    if (finalTranscriptRef.current && event.code === 1000) {
                        processUserRequest(finalTranscriptRef.current);
                    }
                }
            };

            sttSocket.onerror = (error) => {
                console.error("Local WebSocket error:", error);
                setConnectionStatus('error');
                setIsListening(false);
                setIsConnected(false);
                setProcessingStatus('');
                addMessage('error', 'Could not establish a voice connection to the server.');
                
                if (reconnectAttempts < maxReconnectAttempts) {
                    attemptReconnection();
                }
            };

            // Set a timeout for connection
            setTimeout(() => {
                if (connectionStatus === 'connecting') {
                    addMessage('error', 'Connection timeout. Please try again.');
                    setConnectionStatus('error');
                    sttSocket.close();
                }
            }, 10000); // 10 second timeout

        } catch (error) {
            console.error("Failed to start listening:", error);
            setConnectionStatus('error');
            setProcessingStatus('');
            
            if (error instanceof Error) {
                if (error.name === 'NotAllowedError') {
                    addMessage('error', 'Microphone access denied. Please allow microphone permissions and try again.');
                } else if (error.name === 'NotFoundError') {
                    addMessage('error', 'No microphone found. Please connect a microphone and try again.');
                } else {
                    addMessage('error', `Microphone error: ${error.message}`);
                }
            } else {
                addMessage('error', 'Could not access the microphone. Please check permissions.');
            }
        }
    };

    const stopListening = () => {
        if (!isListening) return;
        
        setProcessingStatus('Stopping...');
        
        if (sttSocketRef.current?.readyState === WebSocket.OPEN) {
            sttSocketRef.current.close(1000, "User stopped listening");
        }
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        clearTimeout(silenceTimeoutRef.current as NodeJS.Timeout);
        setIsListening(false);
        setProcessingStatus('');
    };

    const stopSpeaking = () => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.currentTime = 0;
        }
        setIsSpeaking(false);
        setProcessingStatus('');
    };

    const resetSilenceTimeout = () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = setTimeout(() => {
            if (isListening) {
                stopListening();
            }
        }, 4000); // 4 seconds of silence
    };

    const parseContentRequest = (text: string) => {
        const lowerText = text.toLowerCase();
        let platform = 'twitter';
        if (lowerText.includes('instagram')) platform = 'instagram';
        if (lowerText.includes('linkedin')) platform = 'linkedin';
        if (lowerText.includes('facebook')) platform = 'facebook';
        if (lowerText.includes('tiktok')) platform = 'tiktok';
        
        let tone = 'professional';
        if (lowerText.includes('witty') || lowerText.includes('funny')) tone = 'humorous';
        if (lowerText.includes('casual')) tone = 'casual';
        if (lowerText.includes('inspiring')) tone = 'inspirational';
        
        const keywords = ['about', 'on the topic of', 'regarding', 'for'];
        let topic = '';
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                topic = text.substring(lowerText.indexOf(keyword) + keyword.length).trim();
                break;
            }
        }
        if (!topic) {
            const words = text.split(" ");
            topic = words.slice(Math.max(words.length - 5, 1)).join(" ");
        }
        
        return { topic, platform, tone, includeHashtags: true };
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getConnectionStatusColor = () => {
        switch (connectionStatus) {
            case 'connected': return 'text-green-400';
            case 'connecting': return 'text-yellow-400';
            case 'error': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getConnectionStatusIcon = () => {
        switch (connectionStatus) {
            case 'connected': return <Wifi className="h-3 w-3" />;
            case 'connecting': return <Loader className="h-3 w-3 animate-spin" />;
            case 'error': return <WifiOff className="h-3 w-3" />;
            default: return <WifiOff className="h-3 w-3" />;
        }
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
                    className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center group transition-all duration-300 hover:scale-110 ${
                        isListening ? 'animate-pulse ring-4 ring-blue-300' : ''
                    }`}
                >
                    <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
                    {(isListening || isProcessing || isSpeaking) && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    )}
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
                                <div className={`flex items-center space-x-1 text-xs ${getConnectionStatusColor()}`}>
                                    {getConnectionStatusIcon()}
                                    <span className="capitalize">{connectionStatus}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                            <button
                                onClick={() => setIsMuted(!isMuted)}
                                className={`p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors ${
                                    isMuted ? 'text-red-300' : 'text-white'
                                }`}
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                {isMuted ? <VolumeX className="h-3 w-3 sm:h-4 sm:w-4" /> : <Volume2 className="h-3 w-3 sm:h-4 sm:w-4" />}
                            </button>
                            <button 
                                onClick={() => {
                                    setIsOpen(false);
                                    cleanup();
                                }} 
                                className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Status Bar */}
                    {(processingStatus || isListening || isSpeaking) && (
                        <div className="px-3 sm:px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center space-x-2">
                                {(isProcessing || isListening || isSpeaking) && (
                                    <Loader className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                )}
                                <span className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 truncate">
                                    {processingStatus || (isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : '')}
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {/* Conversation */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                        {conversation.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] sm:max-w-[80%] p-2 sm:p-3 rounded-2xl text-xs sm:text-sm flex flex-col space-y-1 ${
                                    msg.type === 'user' 
                                        ? 'bg-blue-600 text-white' 
                                        : msg.type === 'error' 
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' 
                                            : msg.type === 'system'
                                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                }`}>
                                    {msg.type === 'error' && (
                                        <div className="flex items-start space-x-2">
                                            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 flex-shrink-0" />
                                            <span className="break-words">{msg.text}</span>
                                        </div>
                                    )}
                                    {msg.type !== 'error' && (
                                        <span className="break-words">{msg.text}</span>
                                    )}
                                    <span className={`text-xs opacity-70 ${
                                        msg.type === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                                    }`}>
                                        {formatTime(msg.timestamp)}
                                    </span>
                                </div>
                            </div>
                        ))}
                        
                        {(isProcessing || isSpeaking) && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 dark:bg-gray-700 p-2 sm:p-3 rounded-2xl">
                                    <Loader className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-blue-600" />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Controls */}
                    <div className="border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-center">
                        <div className="flex items-center justify-center space-x-3 sm:space-x-4 mb-2 sm:mb-3">
                            <button
                                onClick={isListening ? stopListening : startListening}
                                disabled={connectionStatus === 'connecting' || isProcessing}
                                className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto transition-all duration-300 ${
                                    isListening 
                                        ? 'bg-red-500 text-white animate-pulse hover:bg-red-600' 
                                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {connectionStatus === 'connecting' || isProcessing ? (
                                    <Loader className="h-5 w-5 sm:h-7 sm:w-7 animate-spin" />
                                ) : isListening ? (
                                    <MicOff className="h-5 w-5 sm:h-7 sm:w-7" />
                                ) : (
                                    <Mic className="h-5 w-5 sm:h-7 sm:w-7" />
                                )}
                            </button>
                            
                            {isSpeaking && (
                                <button
                                    onClick={stopSpeaking}
                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-500 text-white hover:bg-gray-600 transition-all flex items-center justify-center"
                                    title="Stop speaking"
                                >
                                    <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />
                                </button>
                            )}
                        </div>
                        
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {isListening 
                                ? "Listening... Click to stop" 
                                : connectionStatus === 'connecting'
                                    ? "Connecting..."
                                    : isProcessing
                                        ? "Processing..."
                                        : "Click mic to speak"
                            }
                        </p>
                        
                        {reconnectAttempts > 0 && connectionStatus !== 'connected' && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                Reconnection attempt {reconnectAttempts}/{maxReconnectAttempts}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default VoiceChat;