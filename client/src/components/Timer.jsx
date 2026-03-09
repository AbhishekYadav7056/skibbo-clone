import React from 'react';

export default function Timer({ timeLeft, drawTime }) {
  const pct = drawTime > 0 ? (timeLeft / drawTime) * 100 : 0;
  const urgent = timeLeft <= 10;
  const warning = timeLeft <= 20;

  return (
    <div className={`timer ${urgent ? 'urgent' : warning ? 'warning' : ''}`}>
      <div className="timer-number">{timeLeft}</div>
      <div className="timer-bar-wrap">
        <div
          className="timer-bar"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
