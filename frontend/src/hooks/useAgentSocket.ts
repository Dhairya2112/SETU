import { useState, useEffect, useCallback, useRef } from 'react';

interface AgentSocketOptions {
  token: string | null;
  conversationId: string;
}

export function useAgentSocket({ token, conversationId }: AgentSocketOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState<{role: 'user' | 'agent', text: string}[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const socketRef = useRef<WebSocket | null>(null);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);

    const stopSpeaking = useCallback(() => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsSpeaking(false);
    }, []);

    // Load existing conversation history from MongoDB on mount
    useEffect(() => {
      if (!token || !conversationId) return;

      fetch(`http://localhost:8000/api/v1/conversations/${conversationId}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) return null; // 404 means new conversation, that's fine
          return res.json();
        })
        .then(data => {
          if (data && data.messages && data.messages.length > 0) {
            const restored = data.messages.map((msg: any) => ({
              role: msg.role === 'user' ? 'user' as const : 'agent' as const,
              text: msg.content
            }));
            setMessages(restored);
          }
        })
        .catch(err => console.warn('Could not load conversation history:', err));
    }, [token, conversationId]);

    useEffect(() => {
      if (!token || !conversationId) return;

      const wsUrl = `ws://localhost:8000/ws/stream/${conversationId}/?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Handle the streaming chunks from the AI
        if (data.chunk_type === 'text') {
          setIsThinking(false);
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'agent') {
              return [
                ...prev.slice(0, -1), 
                { role: 'agent', text: lastMsg.text + data.message }
              ];
            } else {
              return [...prev, { role: 'agent', text: data.message }];
            }
          });
        } else if (data.chunk_type === 'audio') {
            // Stop any playing audio before playing the next chunk
            if (currentAudioRef.current) {
              currentAudioRef.current.pause();
              currentAudioRef.current = null;
            }

            const audioUrl = `data:audio/wav;base64,${data.message}`;
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;
            
            audio.onplay = () => setIsSpeaking(true);
            audio.onended = () => {
               setIsSpeaking(false);
               currentAudioRef.current = null;
            };
            audio.onerror = (e) => {
               console.error("Audio playback error:", e);
               setIsSpeaking(false);
               currentAudioRef.current = null;
            };
            
            audio.play().catch(e => {
               console.error("Browser blocked audio playback:", e);
               setIsSpeaking(false);
               currentAudioRef.current = null;
            });
        } else if (data.chunk_type === 'status') {
            if (data.message === 'thinking') {
                setIsThinking(true);
            } else if (data.message === 'done') {
                setIsThinking(false);
            }
        }
      };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
    };

    socketRef.current = ws;

    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      ws.close();
    };
  }, [token, conversationId]);

  const sendCommand = useCallback((text: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // Optimistically add user message
      setMessages(prev => [...prev, { role: 'user', text }]);
      setIsThinking(true);
      
      // Send to backend Celery worker
      socketRef.current.send(JSON.stringify({ text }));
    } else {
      console.error("WebSocket is not open.");
    }
  }, []);

  return { isConnected, messages, isThinking, isSpeaking, sendCommand, stopSpeaking };
}
