import React, { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ messages, onGuess, isDrawer, phase, myId, myName }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onGuess(text);
    setInput('');
  };

  const canType = phase === 'drawing' || phase === 'lobby' || phase === 'round_end';
  const placeholder = isDrawer
    ? 'You are drawing... watch the chat!'
    : phase === 'drawing'
    ? 'Type your guess here...'
    : 'Chat...';

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>💬 Chat & Guesses</span>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <ChatMessage key={msg.id || msg.timestamp} msg={msg} myId={myId} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          className="chat-input"
          type="text"
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isDrawer && phase === 'drawing'}
          maxLength={100}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn-send"
          disabled={isDrawer && phase === 'drawing'}
        >
          ➤
        </button>
      </form>
    </div>
  );
}

function ChatMessage({ msg, myId }) {
  if (msg.type === 'system' || msg.playerId === 'system') {
    return (
      <div className="chat-msg chat-system">
        <span>{msg.text}</span>
      </div>
    );
  }

  if (msg.type === 'correct') {
    return (
      <div className="chat-msg chat-correct">
        <span>{msg.text}</span>
      </div>
    );
  }

  const isMe = msg.playerId === myId;
  return (
    <div className={`chat-msg ${isMe ? 'chat-me' : 'chat-other'}`}>
      <span className="chat-author">{isMe ? 'You' : msg.playerName}:</span>
      <span className="chat-text">{msg.text}</span>
    </div>
  );
}
