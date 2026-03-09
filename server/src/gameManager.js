const { v4: uuidv4 } = require('uuid');
const { getRandomWords, getWordHint } = require('./wordList');

const rooms = new Map();

// ─── Room helpers ────────────────────────────────────────────────────────────

function createRoom(hostId, hostName, settings = {}) {
  const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const room = {
    id: roomId,
    hostId,
    settings: {
      maxPlayers: settings.maxPlayers || 8,
      rounds: settings.rounds || 3,
      drawTime: settings.drawTime || 80,
      wordCount: settings.wordCount || 3,
      hints: settings.hints || 2,
      isPrivate: settings.isPrivate || false,
    },
    players: [],
    phase: 'lobby',    // lobby | word_selection | drawing | round_end | game_over
    round: 0,
    currentDrawerIndex: -1,
    currentWord: null,
    wordOptions: [],
    scores: {},
    roundScores: {},
    drawHistory: [],
    timer: null,
    hintTimer: null,
    hints: [],
    guessedPlayers: new Set(),
    chatMessages: [],
  };

  const host = { id: hostId, name: hostName, score: 0, isHost: true, hasGuessed: false };
  room.players.push(host);
  room.scores[hostId] = 0;

  rooms.set(roomId, room);
  return room;
}

function joinRoom(roomId, playerId, playerName) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found' };
  if (room.players.length >= room.settings.maxPlayers) return { error: 'Room is full' };
  if (room.phase !== 'lobby') return { error: 'Game already in progress' };
  if (room.players.find(p => p.id === playerId)) return { room }; // rejoin

  const player = { id: playerId, name: playerName, score: 0, isHost: false, hasGuessed: false };
  room.players.push(player);
  room.scores[playerId] = 0;
  return { room };
}

function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  room.players = room.players.filter(p => p.id !== playerId);
  delete room.scores[playerId];
  room.guessedPlayers.delete(playerId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return null;
  }

  // Transfer host if needed
  if (room.hostId === playerId && room.players.length > 0) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }

  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

function getPublicRooms() {
  const list = [];
  for (const room of rooms.values()) {
    if (!room.settings.isPrivate && room.phase === 'lobby') {
      list.push({
        id: room.id,
        playerCount: room.players.length,
        maxPlayers: room.settings.maxPlayers,
        rounds: room.settings.rounds,
      });
    }
  }
  return list;
}

// ─── Game flow ────────────────────────────────────────────────────────────────

function startGame(room) {
  room.phase = 'drawing';
  room.round = 1;
  room.currentDrawerIndex = 0;
  room.scores = {};
  room.players.forEach(p => { p.score = 0; room.scores[p.id] = 0; });
  return room;
}

function startRound(room, io) {
  room.drawHistory = [];
  room.guessedPlayers = new Set();
  room.players.forEach(p => { p.hasGuessed = false; });
  room.currentWord = null;
  room.hints = [];

  const drawer = room.players[room.currentDrawerIndex];
  const wordOptions = getRandomWords(room.settings.wordCount);
  room.wordOptions = wordOptions;
  room.phase = 'word_selection';

  // Give drawer 15 seconds to pick; if not picked, auto-pick
  clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    if (room.phase === 'word_selection') {
      chooseWord(room, room.wordOptions[0], io);
    }
  }, 15000);

  return { drawer, wordOptions };
}

function chooseWord(room, word, io) {
  clearTimeout(room.timer);
  room.currentWord = word;
  room.phase = 'drawing';
  room.drawHistory = [];

  // Build hints array: positions that will be revealed progressively
  const letterPositions = [];
  word.split('').forEach((ch, i) => { if (ch !== ' ') letterPositions.push(i); });
  const shuffledPos = letterPositions.sort(() => Math.random() - 0.5);
  room._hintPositions = shuffledPos;
  room._revealedPositions = [];
  room.hints = buildHintDisplay(word, room._revealedPositions);

  const drawTime = room.settings.drawTime * 1000;
  const maxHints = room.settings.hints;
  const interval = maxHints > 0 ? Math.floor(drawTime / (maxHints + 1)) : null;

  // Set up hint reveals
  clearInterval(room.hintTimer);
  if (maxHints > 0 && interval) {
    let hintCount = 0;
    room.hintTimer = setInterval(() => {
      if (hintCount < maxHints && room._hintPositions.length > hintCount) {
        room._revealedPositions.push(room._hintPositions[hintCount]);
        room.hints = buildHintDisplay(word, room._revealedPositions);
        hintCount++;
        io.to(room.id).emit('hint_update', { hint: room.hints });
      }
    }, interval);
  }

  // Round timer
  room.timer = setTimeout(() => {
    endRound(room, io);
  }, drawTime);
}

function buildHintDisplay(word, revealedPositions) {
  return word.split('').map((ch, i) => {
    if (ch === ' ') return ' ';
    return revealedPositions.includes(i) ? ch : '_';
  }).join(' ');
}

function processGuess(room, playerId, text) {
  if (!room.currentWord) return { type: 'chat' };
  const drawer = room.players[room.currentDrawerIndex];
  if (drawer && drawer.id === playerId) return { type: 'chat' }; // drawer can't guess
  if (room.guessedPlayers.has(playerId)) return { type: 'already_guessed' };

  const guess = text.trim().toLowerCase();
  const word = room.currentWord.toLowerCase();

  if (guess === word) {
    room.guessedPlayers.add(playerId);
    const player = room.players.find(p => p.id === playerId);
    if (player) player.hasGuessed = true;

    // Score based on how many already guessed (first = more points)
    const placement = room.guessedPlayers.size;
    const maxScore = 500;
    const minScore = 100;
    const points = Math.max(minScore, maxScore - (placement - 1) * 50);

    room.scores[playerId] = (room.scores[playerId] || 0) + points;
    if (player) player.score = room.scores[playerId];

    // Drawer gets points too
    if (drawer) {
      const drawerBonus = 25;
      room.scores[drawer.id] = (room.scores[drawer.id] || 0) + drawerBonus;
      const drawerPlayer = room.players.find(p => p.id === drawer.id);
      if (drawerPlayer) drawerPlayer.score = room.scores[drawer.id];
    }

    // Check if everyone guessed
    const nonDrawers = room.players.filter(p => drawer && p.id !== drawer.id);
    const allGuessed = nonDrawers.every(p => room.guessedPlayers.has(p.id));
    return { type: 'correct', points, allGuessed, placement };
  }

  // Close guess detection
  const distance = levenshtein(guess, word);
  if (distance <= 1 && guess.length > 2) {
    return { type: 'close' };
  }

  return { type: 'wrong' };
}

function endRound(room, io) {
  clearTimeout(room.timer);
  clearInterval(room.hintTimer);
  room.phase = 'round_end';

  const scores = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
  const word = room.currentWord;

  io.to(room.id).emit('round_end', {
    word,
    scores,
    round: room.round,
    totalRounds: room.settings.rounds,
  });

  // Advance to next round after 5 seconds
  setTimeout(() => {
    const totalDrawers = room.players.length;
    room.currentDrawerIndex = (room.currentDrawerIndex + 1) % totalDrawers;

    // Check if all players have drawn this round → next round or game over
    if (room.currentDrawerIndex === 0) {
      room.round++;
    }

    if (room.round > room.settings.rounds) {
      endGame(room, io);
    } else {
      const { drawer, wordOptions } = startRound(room, io);
      io.to(room.id).emit('round_start', {
        round: room.round,
        totalRounds: room.settings.rounds,
        drawerId: drawer.id,
        drawerName: drawer.name,
        wordOptions: null, // sent privately to drawer
        drawTime: room.settings.drawTime,
        hint: buildHintDisplay(room.wordOptions[0] || '', []),
      });
      // Send word options only to drawer
      const drawerSocket = io.sockets.sockets.get(drawer.id);
      if (drawerSocket) {
        drawerSocket.emit('word_options', { wordOptions });
      }
    }
  }, 5000);
}

function endGame(room, io) {
  room.phase = 'game_over';
  const leaderboard = [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, score: p.score }));

  io.to(room.id).emit('game_over', {
    winner: leaderboard[0] || null,
    leaderboard,
  });
}

// ─── Levenshtein for "close" detection ────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

module.exports = {
  createRoom, joinRoom, leaveRoom, getRoom, getPublicRooms,
  startGame, startRound, chooseWord, processGuess, endRound, endGame,
  buildHintDisplay,
};
