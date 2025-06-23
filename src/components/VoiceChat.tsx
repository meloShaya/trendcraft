import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader, Zap, X, AlertCircle } from 'lucide-react';

// --- Configuration ---
// In your project root, create a .env file: REACT_APP_ELEVENLABS_API_KEY=your_key_here
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || "YOUR_ELEVENLABS_API_KEY_HERE";
const VOICE_ID = "rfkTsdZrVWEVhDycUYn9"; // Example voice ID.

// --- Interfaces ---
interface VoiceChatProps {
    onContentGenerated?: (content: any) => void;
    token: string | null;
}

interface ConversationMessage {
    id: string;
    type: 'user' | 'assistant' | 'error';
    text: string;
}

// --- Main Component ---
const VoiceChat: React.FC<VoiceChatProps> = ({ onContentGenerated, token }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [conversation, setConversation] = useState<ConversationMessage[]>([]);
    
    // Refs
    const sttSocketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const finalTranscriptRef = useRef<string>("");

    const isApiKeyConfigured = ELEVENLABS_API_KEY && ELEVENLABS_API_KEY !== "YOUR_ELEVENLABS_API_KEY_HERE";

    useEffect(() => {
        if (isOpen && conversation.length === 0) {
            if (!isApiKeyConfigured) {
                addMessage('error', "ElevenLabs API key is not configured. Please add REACT_APP_ELEVENLABS_API_KEY to your .env file.");
            } else {
                addMessage('assistant', "Hi! I'm Kai, your creative partner. What should we create today? Try saying 'Draft a witty tweet about space coffee'.");
            }
        }
    }, [isOpen]);

    const addMessage = (type: ConversationMessage['type'], text: string) => {
        setConversation(prev => [...prev, { id: Date.now().toString(), type, text }]);
    };

    const speakText = async (text: string) => {
        if (!isApiKeyConfigured) return;
        setIsProcessing(true);
        if (audioPlayerRef.current) audioPlayerRef.current.pause();

        const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
        const headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
        };
        const body = JSON.stringify({
            text: text,
            model_id: "eleven_turbo_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        });

        try {
            const response = await fetch(ttsUrl, { method: 'POST', headers, body });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`TTS request failed: ${response.status} - ${errorText}`);
            }
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audioPlayerRef.current = audio;
            audio.play();
            audio.onended = () => setIsProcessing(false);
        } catch (error) {
            console.error("Error with ElevenLabs TTS:", error);
            addMessage('error', `Could not play audio. ${error instanceof Error ? error.message : ''}`);
            setIsProcessing(false);
        }
    };

    const processUserRequest = async (transcript: string) => {
        if (!transcript || !token) {
            if (!token) addMessage('error', "You must be logged in to generate content.");
            return;
        }
        setIsProcessing(true);
        addMessage('user', transcript);
        try {
            const response = await fetch('/api/content/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(parseContentRequest(transcript))
            });
            if (!response.ok) throw new Error("Backend request failed");
            const generatedContent = await response.json();
            const verbalResponse = `Sure, here's a draft for ${generatedContent.platform}: ${generatedContent.content}`;
            addMessage('assistant', verbalResponse);
            await speakText(verbalResponse);
            if (onContentGenerated) onContentGenerated(generatedContent);
        } catch (error) {
            console.error("Error processing user request:", error);
            const errorResponse = "I'm sorry, I hit a snag trying to generate that. Could you try rephrasing?";
            addMessage('assistant', errorResponse);
            await speakText(errorResponse);
        } finally {
            setIsProcessing(false);
        }
    };

    const startListening = async () => {
        if (isListening || !isApiKeyConfigured) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            const sttSocket = new WebSocket(`wss://api.elevenlabs.io/v1/speech-to-text/stream?model_id=eleven_multilingual_v2&api_key=${ELEVENLABS_API_KEY}`);
            sttSocketRef.current = sttSocket;

            sttSocket.onopen = () => {
                console.log("STT WebSocket opened.");
                setIsListening(true);
                finalTranscriptRef.current = "";
                mediaRecorderRef.current?.start(500);
            };

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0 && sttSocket.readyState === WebSocket.OPEN) {
                    sttSocket.send(event.data);
                    resetSilenceTimeout();
                }
            };

            sttSocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.transcript) finalTranscriptRef.current += data.transcript;
                if (data.is_final) stopListening();
            };

            sttSocket.onclose = (event) => {
                console.log("STT WebSocket closed:", event.code, event.reason);
                if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
                stream.getTracks().forEach(track => track.stop());
                setIsListening(false);
                
                if (event.code === 4001 || event.code === 1008) {
                    addMessage('error', 'Authentication failed. Please verify your ElevenLabs API key.');
                } else if (event.code !== 1000 && event.code !== 1005) {
                    addMessage('error', `Connection error (${event.code}). Please try again.`);
                }
                
                if (finalTranscriptRef.current && event.code === 1000) {
                    processUserRequest(finalTranscriptRef.current);
                }
            };

            sttSocket.onerror = (error) => {
                console.error("STT WebSocket error:", error);
                setIsListening(false);
            };
        } catch (error) {
            console.error("Failed to start listening:", error);
            if (error instanceof Error && error.name === 'NotAllowedError') {
                addMessage('error', 'Microphone access denied. Please allow microphone permissions in your browser settings.');
            } else {
                addMessage('error', 'Failed to access the microphone.');
            }
        }
    };

    const stopListening = () => {
        if (!isListening) return;
        if (sttSocketRef.current?.readyState === WebSocket.OPEN) {
            sttSocketRef.current.close(1000, "User stopped listening");
        }
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        clearTimeout(silenceTimeoutRef.current as NodeJS.Timeout);
        setIsListening(false);
    };

    const resetSilenceTimeout = () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = setTimeout(stopListening, 2000);
    };

    const parseContentRequest = (text: string) => {
        const lowerText = text.toLowerCase();
        let platform = 'twitter';
        if (lowerText.includes('instagram')) platform = 'instagram';
        if (lowerText.includes('linkedin')) platform = 'linkedin';
        let tone = 'professional';
        if (lowerText.includes('witty') || lowerText.includes('funny')) tone = 'humorous';
        if (lowerText.includes('casual')) tone = 'casual';
        const keywords = ['about', 'on the topic of', 'regarding'];
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

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center group"
                >
                    <Mic className="h-6 w-6" />
                </button>
            )}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
                         <div className="flex items-center space-x-3">
                            <Zap className="h-5 w-5" />
                            <h3 className="font-semibold">Kai, your AI Partner</h3>
                         </div>
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {conversation.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm flex items-start space-x-2 ${
                                    msg.type === 'user' 
                                    ? 'bg-blue-600 text-white' 
                                    : msg.type === 'error'
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                }`}>
                                    {msg.type === 'error' && <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                                    <span>{msg.text}</span>
                                </div>
                            </div>
                        ))}
                         {isProcessing && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl">
                                    <Loader className="h-4 w-4 animate-spin text-blue-600" />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4 text-center">
                        <button
                            onClick={isListening ? stopListening : startListening}
                            disabled={!isApiKeyConfigured}
                            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all ${
                                !isApiKeyConfigured
                                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                : isListening 
                                ? 'bg-red-500 text-white animate-pulse' 
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            <Mic className="h-7 w-7" />
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                           {!isApiKeyConfigured 
                                ? "API key not configured" 
                                : isListening 
                                ? "Listening... Click to stop" 
                                : "Click mic to speak"}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

export default VoiceChat;
