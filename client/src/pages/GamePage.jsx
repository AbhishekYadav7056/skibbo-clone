import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket.js';
import DrawingCanvas from '../components/DrawingCanvas.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import PlayerList from '../components/PlayerList.jsx';
import Timer from '../components/Timer.jsx';
import WordSelection from '../components/WordSelection.jsx';

export default function GamePage({ roomId, roomData, myId, myName }) {
  const [players, setPlayers] = useState(roomData?.players || []);
  const [phase, setPhase] = useState('word_selection'); // word_selection | drawing | round_end
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(roomData?.settings?.rounds || 3);
  const [drawerId, setDrawerId] = useState(null);
  const [drawerName, setDrawerName] = useState('');
  const [hint, setHint] = useState('');
  const [drawTime, setDrawTime] = useState(roomData?.settings?.drawTime || 80);
  const [timeLeft, setTimeLeft] = useState(roomData?.settings?.drawTime || 80);
  const [wordOptions, setWordOptions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [scores, setScores] = useState({});
  const [roundEndData, setRoundEndData] = useState(null);
  const [showRoundEnd, setShowRoundEnd] = useState(false);

  const isDrawer = myId === drawerId;
  const timerRef = useRef(null);

  // ── Socket listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    socket.on('round_start', (data) => {
      setPhase('word_selection');
      setRound(data.round);
      setTotalRounds(data.totalRounds);
      setDrawerId(data.drawerId);
      setDrawerName(data.drawerName);
      setHint(data.hint || '');
      setDrawTime(data.drawTime);
      setTimeLeft(data.drawTime);
      setRoundEndData(null);
      setShowRoundEnd(false);
      setWordOptions([]);

      // Update scores from players if present
      if (data.scores) setScores(data.scores);

      addSystemMessage(`Round ${data.round}/${data.totalRounds} — ${data.drawerName} is drawing!`);
    });

    socket.on('word_options', ({ wordOptions }) => {
      setWordOptions(wordOptions);
      setPhase('word_selection');
    });

    socket.on('drawing_started', ({ hint, drawTime }) => {
      setPhase('drawing');
      setHint(hint);
      setDrawTime(drawTime);
      setTimeLeft(drawTime);
      setWordOptions([]);
      startTimer(drawTime);
    });

    socket.on('hint_update', ({ hint }) => {
      setHint(hint);
    });

    socket.on('player_joined', ({ players }) => {
      setPlayers(players);
    });

    socket.on('player_left', ({ players }) => {
      setPlayers(players);
    });

    socket.on('guess_result', ({ correct, playerId, playerName, points, placement }) => {
      if (correct) {
        const msg = {
          id: Date.now(),
          type: 'correct',
          text: `🎉 ${playerName} guessed the word! (+${points} pts)`,
          playerId: 'system',
          playerName: 'System',
        };
        setMessages(prev => [...prev, msg]);

        setPlayers(prev => prev.map(p =>
          p.id === playerId ? { ...p, hasGuessed: true } : p
        ));
      }
    });

    socket.on('score_update', ({ score }) => {
      setPlayers(prev => prev.map(p =>
        p.id === myId ? { ...p, score } : p
      ));
    });

    socket.on('round_end', (data) => {
      clearTimer();
      setPhase('round_end');
      setRoundEndData(data);
      setShowRoundEnd(true);

      // Update scores
      if (data.scores) {
        setPlayers(prev => prev.map(p => {
          const s = data.scores.find(s => s.id === p.id);
          return s ? { ...p, score: s.score } : p;
        }));
      }

      addSystemMessage(`Round ended! The word was: ${data.word}`);
    });

    socket.on('chat_message', (msg) => {
      setMessages(prev => [...prev, { ...msg, id: Date.now() + Math.random() }]);
    });

    socket.on('canvas_cleared', () => {
      // Handled in canvas component
    });

    return () => {
      socket.off('round_start');
      socket.off('word_options');
      socket.off('drawing_started');
      socket.off('hint_update');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('guess_result');
      socket.off('score_update');
      socket.off('round_end');
      socket.off('chat_message');
      socket.off('canvas_cleared');
      clearTimer();
    };
  }, [myId]);

  function startTimer(seconds) {
    clearTimer();
    setTimeLeft(seconds);
    const endTime = Date.now() + seconds * 1000;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearTimer();
    }, 500);
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function addSystemMessage(text) {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      type: 'system',
      text,
      playerId: 'system',
      playerName: 'System',
    }]);
  }

  const handleWordChosen = (word) => {
    socket.emit('word_chosen', { word });
    setWordOptions([]);
    setPhase('drawing');
  };

  const handleGuess = (text) => {
    socket.emit('guess', { text });
  };

  return (
    <div className="game-page">
      {/* Top bar */}
      <div className="game-topbar">
        <div className="topbar-left">
          <span className="logo-small">🎨 skribbl</span>
        </div>
        <div className="topbar-center">
          <div className="round-info">
            Round {round}/{totalRounds}
          </div>
          {phase === 'drawing' && (
            <Timer timeLeft={timeLeft} drawTime={drawTime} />
          )}
          <div className="hint-display">
            {phase === 'drawing' && isDrawer ? (
              <span className="drawing-word">Drawing: <strong>{hint.replace(/_/g, '?').replace(/ /g, '\u00A0')}</strong></span>
            ) : phase === 'drawing' ? (
              <span className="hint-text">{hint}</span>
            ) : phase === 'word_selection' ? (
              <span className="hint-text">
                {isDrawer ? '✏️ Choose your word...' : `✏️ ${drawerName} is choosing a word...`}
              </span>
            ) : (
              <span className="hint-text">Round ended</span>
            )}
          </div>
        </div>
        <div className="topbar-right">
          <span className="room-id-badge">Room: {roomId}</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="game-main">
        {/* Left: Player List */}
        <div className="game-left">
          <PlayerList
            players={players}
            drawerId={drawerId}
            myId={myId}
            scores={scores}
          />
        </div>

        {/* Center: Canvas */}
        <div className="game-center">
          <DrawingCanvas
            isDrawer={isDrawer}
            phase={phase}
            roomId={roomId}
          />

          {/* Round End Overlay */}
          {showRoundEnd && roundEndData && (
            <div className="round-end-overlay">
              <div className="round-end-card">
                <h2>Round {roundEndData.round} Over!</h2>
                <p className="revealed-word">The word was: <strong>{roundEndData.word}</strong></p>
                <div className="round-scores">
                  {roundEndData.scores
                    .sort((a, b) => b.score - a.score)
                    .map((s, i) => (
                      <div key={s.id} className={`round-score-row ${s.id === myId ? 'me' : ''}`}>
                        <span className="rank">#{i + 1}</span>
                        <span className="name">{s.name}</span>
                        <span className="score">{s.score} pts</span>
                      </div>
                    ))}
                </div>
                <div className="next-round-msg">
                  {round < totalRounds
                    ? 'Next round starting in 5 seconds...'
                    : 'Game ending soon...'}
                </div>
              </div>
            </div>
          )}

          {/* Word selection overlay */}
          {wordOptions.length > 0 && isDrawer && phase === 'word_selection' && (
            <WordSelection words={wordOptions} onChoose={handleWordChosen} />
          )}
        </div>

        {/* Right: Chat */}
        <div className="game-right">
          <ChatPanel
            messages={messages}
            onGuess={handleGuess}
            isDrawer={isDrawer}
            phase={phase}
            myId={myId}
            myName={myName}
          />
        </div>
      </div>
    </div>
  );
}
