import { useState, useEffect, useCallback, useRef } from 'react';

interface AgentSocketOptions {
  token: string | null;
  conversationId: string;
  onReminderFired?: (reminder: { id: string; title: string; body: string }) => void;
}

export function useAgentSocket({ token, conversationId, onReminderFired }: AgentSocketOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState<{role: 'user' | 'agent', text: string}[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const socketRef = useRef<WebSocket | null>(null);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const isStreamingRef = useRef<boolean>(false); // true while receiving a new agent response

    const onReminderFiredRef = useRef(onReminderFired);
    useEffect(() => {
      onReminderFiredRef.current = onReminderFired;
    }, [onReminderFired]);

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

      let reconnectTimeoutId: NodeJS.Timeout;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      let isManualCleanup = false;

      const connect = () => {
        if (isManualCleanup) return;
        
        const wsUrl = `ws://localhost:8000/ws/stream/${conversationId}/?token=${token}`;
        console.log(`Attempting WebSocket connection... (Attempt ${reconnectAttempts + 1})`);
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket Connected');
          setIsConnected(true);
          reconnectAttempts = 0; // Reset connection attempts on success
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.chunk_type === 'text') {
            setIsThinking(false);
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (isStreamingRef.current && lastMsg && lastMsg.role === 'agent') {
                return [
                  ...prev.slice(0, -1),
                  { role: 'agent', text: lastMsg.text + data.message }
                ];
              } else {
                isStreamingRef.current = true;
                return [...prev, { role: 'agent', text: data.message }];
              }
            });
          } else if (data.chunk_type === 'audio') {
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
          } else if (data.chunk_type === 'reminder') {
              // Acknowledge the reminder by deleting/completing it on the backend
              fetch(`http://localhost:8000/api/v1/reminders/${data.reminder_id}/`, {
                  method: 'DELETE',
                  headers: {
                      'Authorization': `Bearer ${token}`
                  }
              }).catch(err => console.error("Error acknowledging reminder:", err));

              if (onReminderFiredRef.current) {
                  onReminderFiredRef.current({
                      id: data.reminder_id,
                      title: data.title,
                      body: data.body
                  });
              }
          } else if (data.chunk_type === 'status') {
              if (data.message === 'thinking') {
                  setIsThinking(true);
                  isStreamingRef.current = false;
              } else if (data.message === 'done') {
                  setIsThinking(false);
                  isStreamingRef.current = false;
              }
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket Error:', error);
        };

        ws.onclose = (event) => {
          console.log(`WebSocket Disconnected: Code ${event.code}, Reason: ${event.reason}`);
          setIsConnected(false);

          if (isManualCleanup) return;

          // If unauthorized (4001), do not automatically reconnect with same token.
          // Let the background token refresh handler in App.tsx refresh the token.
          if (event.code === 4001) {
            console.warn("WebSocket closed due to unauthorized token (4001). Reconnection skipped.");
            return;
          }

          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            console.log(`Reconnecting WebSocket in ${delay}ms...`);
            reconnectTimeoutId = setTimeout(() => {
              reconnectAttempts++;
              connect();
            }, delay);
          } else {
            console.error("Max WebSocket reconnection attempts reached.");
          }
        };
      };

      connect();

      return () => {
        isManualCleanup = true;
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        clearTimeout(reconnectTimeoutId);
        if (socketRef.current) {
          socketRef.current.close();
        }
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
