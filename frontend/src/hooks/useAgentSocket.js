import { useState, useEffect, useCallback, useRef } from 'react';

export function useAgentSocket({ token, conversationId, onReminderFired }) {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isThinking, setIsThinking] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [activeStatus, setActiveStatus] = useState('idle');
    const [permissionRequest, setPermissionRequest] = useState(null);
    
    const socketRef = useRef(null);
    const currentAudioRef = useRef(null);
    const audioQueueRef = useRef([]);
    const isStreamingRef = useRef(false); // true while receiving a new agent response
    const isInterruptedRef = useRef(false); // true if user manually stopped playback

    const onReminderFiredRef = useRef(onReminderFired);
    useEffect(() => {
      onReminderFiredRef.current = onReminderFired;
    }, [onReminderFired]);

    const playNextAudio = useCallback(() => {
        if (audioQueueRef.current.length === 0) {
            setIsSpeaking(false);
            currentAudioRef.current = null;
            return;
        }
        
        const nextAudioUrl = audioQueueRef.current.shift();
        const audio = new Audio(nextAudioUrl);
        currentAudioRef.current = audio;
        
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => playNextAudio();
        audio.onerror = (e) => {
            console.error("Audio playback error:", e);
            playNextAudio();
        };
        
        audio.play().catch(e => {
            console.error("Browser blocked audio playback:", e);
            playNextAudio();
        });
    }, []);

    const stopSpeaking = useCallback(() => {
      isInterruptedRef.current = true;
      audioQueueRef.current = [];
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsSpeaking(false);
    }, []);

    // Load existing conversation history from MongoDB on mount
    useEffect(() => {
      if (!token || !conversationId) return;

      fetch(`http://${window.location.hostname}:8000/api/v1/conversations/${conversationId}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) return null; // 404 means new conversation, that's fine
          return res.json();
        })
        .then(data => {
          if (data && data.messages && data.messages.length > 0) {
            const restored = data.messages.map((msg) => ({
              role: msg.role === 'user' ? 'user' : 'agent',
              text: msg.content
            }));
            setMessages(restored);
          }
        })
        .catch(err => console.warn('Could not load conversation history:', err));
    }, [token, conversationId]);

    useEffect(() => {
      if (!token || !conversationId) return;

      let reconnectTimeoutId;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      let isManualCleanup = false;

      const connect = () => {
        if (isManualCleanup) return;
        
        const wsUrl = `ws://${window.location.hostname}:8000/ws/stream/${conversationId}/?token=${token}`;
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
          } else if (data.chunk_type === 'text_user') {
            setIsThinking(false);
            setMessages(prev => [...prev, { role: 'user', text: data.message }]);
          } else if (data.chunk_type === 'audio') {
              if (isInterruptedRef.current) return; // Drop audio if user stopped playback
              
              const audioUrl = `data:audio/wav;base64,${data.message}`;
              audioQueueRef.current.push(audioUrl);
              
              if (!currentAudioRef.current || currentAudioRef.current.ended || currentAudioRef.current.paused) {
                  playNextAudio();
              }
          } else if (data.chunk_type === 'reminder') {
              // Acknowledge the reminder by deleting/completing it on the backend
              fetch(`http://${window.location.hostname}:8000/api/v1/reminders/${data.reminder_id}/`, {
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
          } else if (data.chunk_type === 'permission_request') {
              setPermissionRequest(data.message);
          } else if (data.chunk_type === 'status') {
              setActiveStatus(data.message);
              if (data.message === 'acknowledged') {
                  // Instant ack — Setu heard the command (< 200ms)
                  setIsThinking(true);
                  isStreamingRef.current = false;
              } else if (data.message === 'thinking') {
                  setIsThinking(true);
                  isStreamingRef.current = false;
              } else if (data.message === 'done' || data.message === 'cancelled' || data.message === 'failed') {
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
        audioQueueRef.current = [];
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

  const sendCommand = useCallback((text) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      stopSpeaking();
      isInterruptedRef.current = false;
      // Optimistically add user message
      setMessages(prev => [...prev, { role: 'user', text }]);
      setIsThinking(true);
      setActiveStatus('running');
      
      // Send to backend Celery worker
      socketRef.current.send(JSON.stringify({ text }));
    } else {
      console.error("WebSocket is not open.");
    }
  }, []);

  const cancelTask = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'cancel' }));
    }
  }, []);

  const resolvePermissionRequest = useCallback((requestId, status) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ 
        action: 'permission_response',
        request_id: requestId,
        status: status
      }));
      setPermissionRequest(null);
    }
  }, []);

  return { isConnected, messages, isThinking, isSpeaking, sendCommand, stopSpeaking, activeStatus, cancelTask, permissionRequest, resolvePermissionRequest };
}
