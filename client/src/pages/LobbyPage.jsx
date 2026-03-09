import React, { useState } from 'react';

const BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function LobbyPage({ roomId, roomData, myId, onStartGame }) {
  const [copied, setCopied] = useState(false);

  if (!roomData) return <div className="loading">Loading lobby...</div>;

  const isHost = roomData.hostId === myId;
  const inviteUrl = `${window.location.origin}?room=${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="lobby-page">
      <div className="lobby-container">
        <header className="lobby-header">
          <div className="logo small">
            <span>🎨</span>
            <h1>skribbl<span className="logo-dot">.</span>clone</h1>
          </div>
        </header>

        <div className="lobby-main">
          <div className="lobby-left">
            <div className="room-info-card">
              <h2>Room</h2>
              <div className="room-code-display">
                <span className="room-code">{roomId}</span>
                <button className="btn btn-sm" onClick={handleCopyCode}>
                  {copied ? '✓ Copied' : '📋 Copy Code'}
                </button>
              </div>
              <div className="invite-row">
                <input className="input-field input-sm" readOnly value={inviteUrl} />
                <button className="btn btn-sm btn-secondary" onClick={handleCopy}>
                  {copied ? '✓' : '🔗'}
                </button>
              </div>
            </div>

            <div className="lobby-settings-card">
              <h3>⚙️ Settings</h3>
              <div className="settings-list">
                <SettingItem label="Max Players" value={roomData.settings.maxPlayers} />
                <SettingItem label="Rounds" value={roomData.settings.rounds} />
                <SettingItem label="Draw Time" value={`${roomData.settings.drawTime}s`} />
                <SettingItem label="Word Choices" value={roomData.settings.wordCount} />
                <SettingItem label="Hints" value={roomData.settings.hints} />
                <SettingItem label="Room Type" value={roomData.settings.isPrivate ? '🔒 Private' : '🌐 Public'} />
              </div>
            </div>
          </div>

          <div className="lobby-right">
            <div className="players-card">
              <h3>Players ({roomData.players.length}/{roomData.settings.maxPlayers})</h3>
              <ul className="player-list-lobby">
                {roomData.players.map((player, i) => (
                  <li key={player.id} className={`player-item-lobby ${player.id === myId ? 'me' : ''}`}>
                    <span className="player-avatar">
                      {getAvatar(i)}
                    </span>
                    <span className="player-name-lobby">
                      {player.name}
                      {player.id === myId && <span className="you-badge"> (You)</span>}
                    </span>
                    {player.isHost && <span className="host-badge">👑</span>}
                  </li>
                ))}
                {Array.from({ length: roomData.settings.maxPlayers - roomData.players.length }).map((_, i) => (
                  <li key={`empty-${i}`} className="player-item-lobby empty">
                    <span className="player-avatar">⬜</span>
                    <span className="player-name-lobby waiting">Waiting...</span>
                  </li>
                ))}
              </ul>
            </div>

            {isHost ? (
              <button
                className="btn btn-primary btn-large btn-start"
                onClick={onStartGame}
                disabled={roomData.players.length < 2}
              >
                {roomData.players.length < 2 ? 'Need 2+ players...' : '🎮 Start Game!'}
              </button>
            ) : (
              <div className="waiting-host">
                <div className="spinner"></div>
                <p>Waiting for host to start...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingItem({ label, value }) {
  return (
    <div className="setting-item">
      <span className="setting-label">{label}</span>
      <span className="setting-value">{value}</span>
    </div>
  );
}

const AVATARS = ['🐶', '🐱', '🐸', '🦊', '🐼', '🐨', '🦁', '🐯', '🦋', '🦄', '🐙', '🦀'];
function getAvatar(i) { return AVATARS[i % AVATARS.length]; }
