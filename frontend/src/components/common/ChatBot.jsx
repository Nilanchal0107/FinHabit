import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@store/uiStore.js';
import { streamChat } from '@services/api.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_SUGGESTIONS = [
  'How much did I spend this week?',
  'Where can I save money?',
  'Am I on budget this month?',
];

const CONTEXTUAL_SUGGESTIONS = {
  spending: ['Show my top categories', 'How does this compare to last month?'],
  saving: ['Set a savings goal', 'What subscriptions can I cut?'],
  budget: ['Break down my budget usage', 'Project my month-end balance'],
  default: ['Tell me more', 'What else should I know?'],
};

function getFollowUpSuggestions(lastResponse) {
  const lower = (lastResponse || '').toLowerCase();
  if (lower.includes('spend') || lower.includes('spent') || lower.includes('category'))
    return CONTEXTUAL_SUGGESTIONS.spending;
  if (lower.includes('save') || lower.includes('saving') || lower.includes('cut'))
    return CONTEXTUAL_SUGGESTIONS.saving;
  if (lower.includes('budget') || lower.includes('limit') || lower.includes('remaining'))
    return CONTEXTUAL_SUGGESTIONS.budget;
  return CONTEXTUAL_SUGGESTIONS.default;
}

// ── Time formatting ───────────────────────────────────────────────────────────

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex items-end gap-1 pl-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: '#7C3AED' }}
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className="text-xs font-body ml-2" style={{ color: '#8B8A9E' }}>
        FinHabits AI is thinking…
      </span>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message, onCopy }) {
  const isUser = message.role === 'user';
  const [showCopy, setShowCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  const longPressTimer = useRef(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [message.content]);

  const handleTouchStart = () => {
    if (isUser) return;
    longPressTimer.current = setTimeout(() => setShowCopy(true), 500);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-3`}
    >
      <div
        className={`relative max-w-[85%] px-4 py-2.5 rounded-2xl font-body text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser ? 'rounded-br-md' : 'rounded-bl-md'
        }`}
        style={
          isUser
            ? { backgroundColor: '#4F46E5', color: '#F0EFF8' }
            : {
                backgroundColor: '#1E1E36',
                color: '#F0EFF8',
                borderLeft: '3px solid #7C3AED',
              }
        }
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => !isUser && setShowCopy(true)}
        onMouseLeave={() => { setShowCopy(false); setCopied(false); }}
      >
        {message.content}

        {/* Copy button (AI messages only) */}
        <AnimatePresence>
          {showCopy && !isUser && message.content.length > 20 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleCopy}
              className="absolute -top-3 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs border border-white/10 shadow-lg"
              style={{ backgroundColor: '#16162A' }}
              aria-label="Copy message"
            >
              {copied ? '✓' : '📋'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <span
        className="text-[10px] font-body mt-1 px-1"
        style={{ color: '#8B8A9E' }}
      >
        {formatTime(message.timestamp)}
      </span>
    </motion.div>
  );
}

// ── Chat Input ────────────────────────────────────────────────────────────────

function ChatInput({ onSend, isStreaming, onStop }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex items-center gap-2 p-3 border-t border-white/5"
      style={{ backgroundColor: '#16162A' }}
    >
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your finances…"
        disabled={isStreaming}
        className="flex-1 px-4 py-2.5 rounded-xl font-body text-sm border border-white/10 outline-none transition-all duration-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50"
        style={{
          backgroundColor: '#0F0F1A',
          color: '#F0EFF8',
        }}
        id="chat-input"
        autoComplete="off"
      />

      {isStreaming ? (
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onStop}
          className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 transition-colors duration-200"
          style={{ backgroundColor: '#F43F5E' }}
          aria-label="Stop generating"
          id="chat-stop-btn"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect width="14" height="14" rx="2" fill="white" />
          </svg>
        </motion.button>
      ) : (
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30"
          style={{
            background: input.trim()
              ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
              : '#1E1E36',
          }}
          aria-label="Send message"
          id="chat-send-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      )}
    </div>
  );
}

// ── Suggestion Chips ──────────────────────────────────────────────────────────

function SuggestionChips({ suggestions, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {suggestions.map((text, i) => (
        <motion.button
          key={text}
          initial={{ opacity: 0, scale: 0.9, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect(text)}
          className="px-3 py-1.5 rounded-full font-body text-xs border border-white/10 transition-colors duration-200 hover:border-indigo-500/40"
          style={{ backgroundColor: '#1E1E36', color: '#F0EFF8' }}
        >
          {text}
        </motion.button>
      ))}
    </div>
  );
}

// ── Main ChatBot Component ────────────────────────────────────────────────────

export default function ChatBot() {
  const {
    chatOpen,
    setChatOpen,
    toggleChat,
    chatHistory,
    isStreaming,
    hasUnread,
    addChatMessage,
    updateLastAssistantMessage,
    setIsStreaming,
    setHasUnread,
    activeTab,
  } = useUIStore();

  const [waitingForFirst, setWaitingForFirst] = useState(false);
  const [followUpSuggestions, setFollowUpSuggestions] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, waitingForFirst]);

  // Clear unread when opening chat
  useEffect(() => {
    if (chatOpen && hasUnread) {
      setHasUnread(false);
    }
  }, [chatOpen, hasUnread, setHasUnread]);

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text) => {
      // Add user message
      const userMsg = {
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(userMsg);

      // Show typing indicator
      setWaitingForFirst(true);
      setIsStreaming(true);
      setFollowUpSuggestions([]);

      // Add placeholder assistant message
      const assistantMsg = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      addChatMessage(assistantMsg);

      // Create AbortController for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulated = '';

      try {
        // Build conversation history for API (exclude the placeholder)
        const historyForApi = useUIStore
          .getState()
          .chatHistory.filter((m) => m.content.length > 0)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await streamChat(
          text,
          historyForApi,
          { activeTab },
          controller.signal
        );

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6); // Remove "data: "

            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                // First token arrived — hide typing indicator
                if (waitingForFirst || accumulated === '') {
                  setWaitingForFirst(false);
                }
                accumulated += parsed.token;
                updateLastAssistantMessage(accumulated);
              }
              if (parsed.error) {
                accumulated += '\n⚠️ ' + parsed.error;
                updateLastAssistantMessage(accumulated);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // Generate follow-up suggestions
        setFollowUpSuggestions(getFollowUpSuggestions(accumulated));
      } catch (err) {
        if (err.name === 'AbortError') {
          // User cancelled — keep partial response
          if (accumulated) {
            updateLastAssistantMessage(accumulated + '\n\n_(stopped)_');
          } else {
            updateLastAssistantMessage('_(cancelled)_');
          }
        } else {
          console.error('[ChatBot] Stream error:', err.message);
          updateLastAssistantMessage(
            accumulated || 'Sorry, something went wrong. Please try again.'
          );
        }
      } finally {
        setWaitingForFirst(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [activeTab, addChatMessage, updateLastAssistantMessage, setIsStreaming]
  );

  // ── Stop generation ─────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // ── Determine suggestions ──────────────────────────────────────────────────

  const showInitialSuggestions = chatHistory.length === 0 && !isStreaming;
  const showFollowUp =
    followUpSuggestions.length > 0 && !isStreaming && chatHistory.length > 0;

  // ── Floating chat button ────────────────────────────────────────────────────

  return (
    <>
      {/* Floating chat trigger button */}
      {!chatOpen && (
        <motion.button
          onClick={() => { toggleChat(); setHasUnread(false); }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          className="fixed z-[60] w-14 h-14 rounded-full flex items-center justify-center shadow-glow-violet border border-white/10"
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
            bottom: isMobile ? '140px' : '88px',
            right: isMobile ? '20px' : '20px',
          }}
          aria-label="Open AI chat"
          id="chat-trigger-btn"
        >
          {/* Chat bubble icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>

          {/* Unread indicator */}
          <AnimatePresence>
            {hasUnread && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                style={{
                  backgroundColor: '#F43F5E',
                  borderColor: '#0F0F1A',
                }}
              />
            )}
          </AnimatePresence>
        </motion.button>
      )}

      {/* Chat drawer */}
      <AnimatePresence>
        {chatOpen && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
              className="md:hidden fixed inset-0 z-[60]"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            />

            {/* Chat panel */}
            <motion.div
              initial={{
                opacity: 0,
                y: isMobile ? 100 : 0,
                x: isMobile ? 0 : 100,
              }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{
                opacity: 0,
                y: isMobile ? 100 : 0,
                x: isMobile ? 0 : 100,
              }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className={`fixed z-[70] flex flex-col overflow-hidden border border-white/10 shadow-2xl ${
                isMobile
                  ? 'bottom-0 left-0 right-0 rounded-t-3xl'
                  : 'bottom-6 right-6 rounded-2xl'
              }`}
              style={{
                backgroundColor: '#16162A',
                height: isMobile ? '65vh' : 'min(600px, calc(100vh - 100px))',
                width: isMobile ? '100%' : '400px',
              }}
              role="dialog"
              aria-label="FinHabits AI Chat"
              id="chat-drawer"
            >
              {/* ── Header ───────────────────────────────────────────────── */}
              <div
                className="flex items-center justify-between px-5 py-4 border-b border-white/5"
                style={{
                  background: 'linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(124,58,237,0.1) 100%)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  <h2 className="font-heading text-base font-bold" style={{ color: '#F0EFF8' }}>
                    FinHabits AI
                  </h2>
                  {isStreaming && (
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2 h-2 rounded-full ml-1"
                      style={{ backgroundColor: '#22C55E' }}
                    />
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setChatOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 hover:bg-white/5"
                  aria-label="Minimize chat"
                  id="chat-minimize-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B8A9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </motion.button>
              </div>

              {/* ── Messages area ────────────────────────────────────────── */}
              <div
                className="flex-1 overflow-y-auto px-4 py-4"
                style={{
                  background: 'linear-gradient(180deg, #16162A 0%, #0F0F1A 100%)',
                }}
              >
                {/* Empty state */}
                {chatHistory.length === 0 && !waitingForFirst && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center h-full text-center"
                  >
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                      style={{
                        background: 'linear-gradient(135deg, rgba(79,70,229,0.2) 0%, rgba(124,58,237,0.2) 100%)',
                        border: '1px solid rgba(124,58,237,0.2)',
                      }}
                    >
                      <span className="text-3xl">🤖</span>
                    </div>
                    <h3 className="font-heading text-lg font-bold mb-1" style={{ color: '#F0EFF8' }}>
                      Hi! I'm your AI assistant
                    </h3>
                    <p className="font-body text-sm mb-5" style={{ color: '#8B8A9E' }}>
                      Ask me anything about your finances
                    </p>
                  </motion.div>
                )}

                {/* Message bubbles */}
                {chatHistory.map((msg, idx) => {
                  // Skip empty assistant placeholder (typing indicator handles it)
                  if (msg.role === 'assistant' && msg.content === '' && waitingForFirst) {
                    return null;
                  }
                  // Skip empty content messages entirely
                  if (!msg.content) return null;

                  return <MessageBubble key={`${msg.role}-${idx}`} message={msg} />;
                })}

                {/* Typing indicator */}
                {waitingForFirst && <TypingIndicator />}

                {/* Follow-up suggestions */}
                {showFollowUp && (
                  <SuggestionChips
                    suggestions={followUpSuggestions}
                    onSelect={sendMessage}
                  />
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Initial suggestions (shown above input when no history) */}
              {showInitialSuggestions && (
                <div className="border-t border-white/5">
                  <SuggestionChips
                    suggestions={INITIAL_SUGGESTIONS}
                    onSelect={sendMessage}
                  />
                </div>
              )}

              {/* ── Input area ───────────────────────────────────────────── */}
              <ChatInput
                onSend={sendMessage}
                isStreaming={isStreaming}
                onStop={handleStop}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
