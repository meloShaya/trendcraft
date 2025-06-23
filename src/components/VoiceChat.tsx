import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader, Zap, X } from 'lucide-react';

// --- Configuration ---
// It's highly recommended to use environment variables for your API key.
// In your project root, create a .env file: REACT_APP_ELEVENLABS_API_KEY=your_key_here
// Note: Changed from VITE_ to REACT_APP_ for broader compatibility.
const ELEVENLABS_API_KEY = process.env.REACT_APP_ELEVENLABS_API_KEY || "YOUR_ELEVENLABS_API_KEY_HERE";
const VOICE_ID = "rfkTsdZrVWEVhDycUYn9"; // Example: Rachel's voice ID. Replace with your preferred voice.

// --- Interfaces ---
interface VoiceChatProps {
    onContentGenerated?: (content: any) => void;
    token: string | null; // Accept the auth token as a prop
}

interface ConversationMessage {
    id: string;
    type: 'user' | 'assistant';
    text: string;
}

// --- Main Component ---
const VoiceChat: React.FC<VoiceChatProps> = ({ onContentGenerated, token }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // For when your backend is thinking
    const [conversation, setConversation] = useState<ConversationMessage[]>([]);
    
    // Refs for various Web APIs and state
    const sttSocketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const finalTranscriptRef = useRef<string>("");

    // Effect to add initial welcome message
    useEffect(() => {
        if (isOpen && conversation.length === 0) {
            setConversation([{
                id: 'welcome-message',
                type: 'assistant',
                text: "Hi! I'm Kai, your creative partner. What should we create today? Try saying 'Draft a witty tweet about space coffee'."
            }]);
        }
    }, [isOpen, conversation.length]);

    // --- Core Logic: Text-to-Speech (TTS) ---
    const speakText = async (text: string) => {
        setIsProcessing(true);
        if (audioPlayerRef.current && !audioPlayerRef.current.paused) {
            audioPlayerRef.current.pause();
        }

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
            if (!response.ok) throw new Error("TTS request failed");

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const audio = new Audio(audioUrl);
            audioPlayerRef.current = audio;
            audio.play();
            audio.onended = () => setIsProcessing(false);

        } catch (error) {
            console.error("Error with ElevenLabs TTS:", error);
            setIsProcessing(false);
        }
    };

    // --- Core Logic: Process User's Request ---
    const processUserRequest = async (transcript: string) => {
        if (!transcript || !token) {
            if(!token) console.error("Authentication token is missing.");
            return;
        }
        
        setIsProcessing(true);
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

            if (!response.ok) throw new Error("Backend request failed");
            
            const generatedContent = await response.json();
            
            const verbalResponse = `Sure, here's a draft for ${generatedContent.platform}: ${generatedContent.content}`;
            addMessage('assistant', verbalResponse);
            await speakText(verbalResponse);
            
            if (onContentGenerated) {
                onContentGenerated(generatedContent);
            }

        } catch (error) {
            console.error("Error processing user request:", error);
            const errorResponse = "I'm sorry, I hit a snag trying to generate that. Could you try rephrasing?";
            addMessage('assistant', errorResponse);
            await speakText(errorResponse);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Core Logic: Speech-to-Text (STT) via WebSocket ---
    const startListening = async () => {
        if (isListening) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            
            const sttSocket = new WebSocket(`wss://api.elevenlabs.io/v1/speech-to-text/stream?model_id=eleven_multilingual_v2&api_key=${ELEVENLABS_API_KEY}`);
            sttSocketRef.current = sttSocket;
            
            sttSocket.onopen = () => {
                console.log("STT WebSocket opened. Starting media recorder.");
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
                if (data.transcript) {
                    finalTranscriptRef.current += data.transcript;
                }
                if (data.is_final) {
                    stopListening();
                }
            };

            sttSocket.onclose = () => {
                console.log("STT WebSocket closed.");
                if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
                stream.getTracks().forEach(track => track.stop());
                setIsListening(false);
                if(finalTranscriptRef.current) {
                    processUserRequest(finalTranscriptRef.current);
                }
            };

            sttSocket.onerror = (error) => {
                console.error("STT WebSocket error:", error);
                setIsListening(false);
            };
            
        } catch (error) {
            console.error("Failed to start listening:", error);
        }
    };

    const stopListening = () => {
        if (!isListening) return;
        
        if (sttSocketRef.current?.readyState === WebSocket.OPEN) {
            sttSocketRef.current.close();
        }
        
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }

        clearTimeout(silenceTimeoutRef.current as NodeJS.Timeout);
        setIsListening(false);
    };

    const resetSilenceTimeout = () => {
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
        }
        silenceTimeoutRef.current = setTimeout(() => {
            stopListening();
        }, 2000); // Stop after 2 seconds of silence
    };

    const addMessage = (type: 'user' | 'assistant', text: string) => {
        setConversation(prev => [...prev, { id: Date.now().toString(), type, text }]);
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
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'}`}>
                                    {msg.text}
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
                            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all ${
                                isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white'
                            }`}
                        >
                            <Mic className="h-7 w-7" />
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                           {isListening ? "Listening... Click to stop" : "Click mic to speak"}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

export default VoiceChat;
