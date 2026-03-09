import React from 'react';

const AVATARS = ['🐶', '🐱', '🐸', '🦊', '🐼', '🐨', '🦁', '🐯', '🦋', '🦄', '🐙', '🦀'];

export default function PlayerList({ players, drawerId, myId, scores }) {
  const sorted = [...(players || [])].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className="player-list-panel">
      <div className="player-list-header">👥 Players</div>
      <ul className="player-list">
        {sorted.map((player, i) => {
          const isDrawing = player.id === drawerId;
          const isMe = player.id === myId;
          const score = scores?.[player.id] ?? player.score ?? 0;

          return (
            <li key={player.id} className={`player-row ${isMe ? 'me' : ''} ${isDrawing ? 'drawing' : ''} ${player.hasGuessed ? 'guessed' : ''}`}>
              <span className="player-avatar-sm">{AVATARS[i % AVATARS.length]}</span>
              <div className="player-info">
                <span className="player-name-sm">
                  {player.name}
                  {isMe && <span className="you-badge-sm"> (You)</span>}
                  {player.isHost && <span className="host-crown"> 👑</span>}
                </span>
                <span className="player-score">{score} pts</span>
              </div>
              <div className="player-status">
                {isDrawing && <span className="status-badge drawing">✏️</span>}
                {player.hasGuessed && !isDrawing && <span className="status-badge guessed">✓</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
