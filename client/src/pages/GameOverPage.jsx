import React from 'react';

const MEDALS = ['🥇', '🥈', '🥉'];
const AVATARS = ['🐶', '🐱', '🐸', '🦊', '🐼', '🐨', '🦁', '🐯', '🦋', '🦄', '🐙', '🦀'];

export default function GameOverPage({ data, myId, onPlayAgain }) {
  if (!data) return <div className="loading">Loading results...</div>;

  const { winner, leaderboard } = data;
  const isWinner = winner?.id === myId;

  return (
    <div className="game-over-page">
      <div className="game-over-container">
        <div className="game-over-header">
          {isWinner ? (
            <>
              <div className="winner-animation">🎊</div>
              <h1 className="winner-title">You Won! 🏆</h1>
            </>
          ) : (
            <>
              <div className="winner-animation">🎨</div>
              <h1 className="winner-title">Game Over!</h1>
            </>
          )}
          {winner && (
            <p className="winner-name">
              🥇 {winner.name} wins with <strong>{winner.score}</strong> points!
            </p>
          )}
        </div>

        <div className="leaderboard-card">
          <h2>🏆 Final Leaderboard</h2>
          <div className="leaderboard-list">
            {leaderboard.map((entry, i) => (
              <div
                key={entry.id}
                className={`leaderboard-row ${entry.id === myId ? 'me' : ''} ${i === 0 ? 'first' : ''}`}
              >
                <span className="lb-rank">
                  {MEDALS[i] || `#${i + 1}`}
                </span>
                <span className="lb-avatar">{AVATARS[i % AVATARS.length]}</span>
                <span className="lb-name">
                  {entry.name}
                  {entry.id === myId && <span className="you-badge"> (You)</span>}
                </span>
                <span className="lb-score">{entry.score} pts</span>
                <div
                  className="lb-bar"
                  style={{
                    width: `${leaderboard[0]?.score > 0 ? (entry.score / leaderboard[0].score) * 100 : 0}%`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="game-over-actions">
          <button className="btn btn-primary btn-large" onClick={onPlayAgain}>
            🎮 Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
