import React, { useState, useEffect } from 'react';

export default function HomePage({ onCreateRoom, onJoinRoom, initialRoomId, savedName }) {
  const [tab, setTab] = useState(initialRoomId ? 'join' : 'home');
  const [name, setName] = useState(savedName || '');
  const [roomCode, setRoomCode] = useState(initialRoomId || '');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    maxPlayers: 8,
    rounds: 3,
    drawTime: 80,
    wordCount: 3,
    hints: 2,
    isPrivate: false,
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Enter your name');
    onCreateRoom(name.trim(), settings);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Enter your name');
    if (!roomCode.trim()) return alert('Enter room code');
    onJoinRoom(name.trim(), roomCode.trim().toUpperCase());
  };

  const handleQuickPlay = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Enter your name');
    onCreateRoom(name.trim(), { ...settings, isPrivate: false });
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="logo">
          <span className="logo-icon">🎨</span>
          <h1>skribbl<span className="logo-dot">.</span>clone</h1>
        </div>
        <p className="tagline">Draw. Guess. Win! 🏆</p>
      </header>

      <div className="home-content">
        <div className="home-card">
          <div className="home-tabs">
            <button className={`tab-btn ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
              🎮 Play
            </button>
            <button className={`tab-btn ${tab === 'join' ? 'active' : ''}`} onClick={() => setTab('join')}>
              🔑 Join Room
            </button>
            <button className={`tab-btn ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
              ➕ Create Room
            </button>
          </div>

          <div className="name-row">
            <label>Your Name</label>
            <input
              className="input-field"
              type="text"
              placeholder="Enter your name..."
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
            />
          </div>

          {tab === 'home' && (
            <div className="tab-content">
              <p className="tab-desc">Jump into a quick game!</p>
              <form onSubmit={handleQuickPlay}>
                <button className="btn btn-primary btn-large" type="submit">
                  🚀 Quick Play
                </button>
              </form>
              <div className="how-to-play">
                <h3>How to Play</h3>
                <ol>
                  <li>🖊️ One player draws a secret word</li>
                  <li>💬 Others guess the word in the chat</li>
                  <li>⚡ Faster guesses = more points</li>
                  <li>🏆 Most points at the end wins!</li>
                </ol>
              </div>
            </div>
          )}

          {tab === 'join' && (
            <div className="tab-content">
              <form onSubmit={handleJoin}>
                <label>Room Code</label>
                <input
                  className="input-field input-code"
                  type="text"
                  placeholder="Enter room code (e.g. ABC123)"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <button className="btn btn-primary" type="submit">
                  Join Room
                </button>
              </form>
            </div>
          )}

          {tab === 'create' && (
            <div className="tab-content">
              <div className="settings-toggle" onClick={() => setShowSettings(s => !s)}>
                <span>⚙️ Room Settings</span>
                <span>{showSettings ? '▲' : '▼'}</span>
              </div>

              {showSettings && (
                <div className="settings-panel">
                  <SettingRow label="Max Players" min={2} max={20} value={settings.maxPlayers}
                    onChange={v => setSettings(s => ({ ...s, maxPlayers: v }))} />
                  <SettingRow label="Rounds" min={1} max={10} value={settings.rounds}
                    onChange={v => setSettings(s => ({ ...s, rounds: v }))} />
                  <SettingRow label="Draw Time (sec)" min={15} max={240} value={settings.drawTime}
                    onChange={v => setSettings(s => ({ ...s, drawTime: v }))} step={5} />
                  <SettingRow label="Word Choices" min={1} max={5} value={settings.wordCount}
                    onChange={v => setSettings(s => ({ ...s, wordCount: v }))} />
                  <SettingRow label="Hints" min={0} max={5} value={settings.hints}
                    onChange={v => setSettings(s => ({ ...s, hints: v }))} />
                  <div className="setting-row">
                    <label>Private Room</label>
                    <input type="checkbox" checked={settings.isPrivate}
                      onChange={e => setSettings(s => ({ ...s, isPrivate: e.target.checked }))} />
                  </div>
                </div>
              )}

              <form onSubmit={handleCreate}>
                <button className="btn btn-primary" type="submit">
                  Create Room
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, min, max, value, onChange, step = 1 }) {
  return (
    <div className="setting-row">
      <label>{label}: <strong>{value}</strong></label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
      <span className="setting-range">{min}–{max}</span>
    </div>
  );
}
