import React, { useEffect, useState } from 'react';

export default function WordSelection({ words, onChoose }) {
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="word-selection-overlay">
      <div className="word-selection-card">
        <h2>✏️ Choose Your Word</h2>
        <p className="ws-timer">Time to choose: {timeLeft}s</p>
        <div className="word-options">
          {words.map((word) => (
            <button
              key={word}
              className="word-option-btn"
              onClick={() => onChoose(word)}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
