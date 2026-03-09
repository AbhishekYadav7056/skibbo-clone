const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createRoom, joinRoom, leaveRoom, getRoom, getPublicRooms,
  startGame, startRound, chooseWord, processGuess, endRound, buildHintDisplay,
} = require('./gameManager');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ─── REST endpoints ────────────────────────────────────────────────────────────
app.get('/rooms', (req, res) => {
  res.json(getPublicRooms());
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // ── Create Room ──────────────────────────────────────────────────────────────
  socket.on('create_room', ({ playerName, settings }) => {
    const room = createRoom(socket.id, playerName, settings);
    socket.join(room.id);
    socket.emit('room_created', {
      roomId: room.id,
      room: sanitizeRoom(room, socket.id),
    });
    console.log(`Room ${room.id} created by ${playerName}`);
  });

  // ── Join Room ────────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomId, playerName }) => {
    const result = joinRoom(roomId, socket.id, playerName);
    if (result.error) {
      socket.emit('join_error', { message: result.error });
      return;
    }
    const room = result.room;
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.playerName = playerName;

    socket.emit('room_joined', {
      roomId: room.id,
      room: sanitizeRoom(room, socket.id),
    });

    socket.to(room.id).emit('player_joined', {
      player: room.players.find(p => p.id === socket.id),
      players: room.players,
    });
  });

  // ── Start Game ───────────────────────────────────────────────────────────────
  socket.on('start_game', () => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 2) {
      socket.emit('error_msg', { message: 'Need at least 2 players to start' });
      return;
    }

    startGame(room);
    io.to(roomId).emit('game_started', {
      players: room.players,
      totalRounds: room.settings.rounds,
    });

    // Start first round
    const { drawer, wordOptions } = startRound(room, io);
    io.to(roomId).emit('round_start', {
      round: room.round,
      totalRounds: room.settings.rounds,
      drawerId: drawer.id,
      drawerName: drawer.name,
      drawTime: room.settings.drawTime,
      hint: buildHintDisplay(wordOptions[0] || '', []),
    });

    // Send word choices only to the drawer
    const drawerSocket = io.sockets.sockets.get(drawer.id);
    if (drawerSocket) {
      drawerSocket.emit('word_options', { wordOptions });
    }
  });

  // ── Word Chosen ──────────────────────────────────────────────────────────────
  socket.on('word_chosen', ({ word }) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    chooseWord(room, word, io);

    // Notify all: drawing has started, word is hidden
    io.to(roomId).emit('drawing_started', {
      hint: buildHintDisplay(word, []),
      wordLength: word.replace(/ /g, '').length,
      drawTime: room.settings.drawTime,
    });
  });

  // ── Drawing events ───────────────────────────────────────────────────────────
  socket.on('draw_start', (data) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room || room.phase !== 'drawing') return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    const stroke = { type: 'start', ...data };
    room.drawHistory.push(stroke);
    socket.to(roomId).emit('draw_data', stroke);
  });

  socket.on('draw_move', (data) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room || room.phase !== 'drawing') return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    const stroke = { type: 'move', ...data };
    room.drawHistory.push(stroke);
    socket.to(roomId).emit('draw_data', stroke);
  });

  socket.on('draw_end', () => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    room.drawHistory.push({ type: 'end' });
    socket.to(roomId).emit('draw_data', { type: 'end' });
  });

  socket.on('canvas_clear', () => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    room.drawHistory = [];
    io.to(roomId).emit('canvas_cleared');
  });

  socket.on('draw_undo', () => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    // Remove strokes until last 'end' marker is removed
    let removed = false;
    while (room.drawHistory.length > 0 && !removed) {
      const last = room.drawHistory.pop();
      if (last.type === 'end' || last.type === 'start') removed = true;
    }
    io.to(roomId).emit('canvas_redraw', { history: room.drawHistory });
  });

  // ── Fill (bucket tool) ───────────────────────────────────────────────────────
  socket.on('canvas_fill', (data) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    room.drawHistory.push({ type: 'fill', ...data });
    socket.to(roomId).emit('draw_data', { type: 'fill', ...data });
  });

  // ── Chat / Guess ─────────────────────────────────────────────────────────────
  socket.on('guess', ({ text }) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (room.phase !== 'drawing') {
      // Just a lobby / round_end chat
      broadcastChat(io, room, player, text, 'chat');
      return;
    }

    const result = processGuess(room, socket.id, text);

    if (result.type === 'correct') {
      io.to(roomId).emit('guess_result', {
        correct: true,
        playerId: socket.id,
        playerName: player.name,
        points: result.points,
        placement: result.placement,
      });

      // Tell guesser their score
      socket.emit('score_update', { score: room.scores[socket.id] });

      if (result.allGuessed) {
        endRound(room, io);
      }
    } else if (result.type === 'close') {
      socket.emit('chat_message', {
        playerId: 'system',
        playerName: 'System',
        text: `"${text}" is very close!`,
        type: 'system',
      });
    } else if (result.type === 'already_guessed') {
      // silently ignore or treat as normal chat visible only to others
      broadcastChat(io, room, player, text, 'chat');
    } else {
      broadcastChat(io, room, player, text, 'guess');
    }
  });

  socket.on('chat', ({ text }) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    broadcastChat(io, room, player, text, 'chat');
  });

  // ── Request canvas sync (new player mid-game) ────────────────────────────────
  socket.on('request_canvas_sync', () => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    socket.emit('canvas_redraw', { history: room.drawHistory });
  });

  // ── Disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    const roomId = getRoomId(socket);
    if (!roomId) return;

    const room = leaveRoom(roomId, socket.id);
    if (!room) return;

    io.to(roomId).emit('player_left', {
      playerId: socket.id,
      players: room.players,
    });

    // If drawer left mid-round, end round early
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer && room.phase === 'drawing') {
      endRound(room, io);
    }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getRoomId(socket) {
  // Try socket.data first, then rooms in socket adapter
  if (socket.data.roomId) return socket.data.roomId;
  for (const [roomId] of io.sockets.adapter.rooms) {
    if (roomId.length === 6 && io.sockets.adapter.rooms.get(roomId)?.has(socket.id)) {
      socket.data.roomId = roomId;
      return roomId;
    }
  }
  return null;
}

function sanitizeRoom(room, viewerId) {
  return {
    id: room.id,
    hostId: room.hostId,
    settings: room.settings,
    players: room.players,
    phase: room.phase,
    round: room.round,
    totalRounds: room.settings.rounds,
    drawerId: room.players[room.currentDrawerIndex]?.id || null,
    hint: room.currentWord ? buildHintDisplay(room.currentWord, room._revealedPositions || []) : null,
    scores: room.scores,
    chatMessages: room.chatMessages.slice(-50),
  };
}

function broadcastChat(io, room, player, text, msgType) {
  const msg = {
    playerId: player.id,
    playerName: player.name,
    text,
    type: msgType,
    timestamp: Date.now(),
  };
  room.chatMessages.push(msg);
  if (room.chatMessages.length > 200) room.chatMessages.shift();
  io.to(room.id).emit('chat_message', msg);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Skribbl server running on port ${PORT}`);
});
