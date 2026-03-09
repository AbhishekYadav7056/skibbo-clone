import React, { useState, useEffect } from 'react';
import socket from './socket.js';
import HomePage from './pages/HomePage.jsx';
import LobbyPage from './pages/LobbyPage.jsx';
import GamePage from './pages/GamePage.jsx';
import GameOverPage from './pages/GameOverPage.jsx';

const VIEWS = {
  HOME: 'home',
  LOBBY: 'lobby',
  GAME: 'game',
  GAME_OVER: 'game_over',
};

export default function App() {
  const [view, setView] = useState(VIEWS.HOME);
  const [roomId, setRoomId] = useState(null);
  const [myId, setMyId] = useState(null);
  const [myName, setMyName] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [gameOverData, setGameOverData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    socket.on('connect', () => {
      setMyId(socket.id);
      setConnectionStatus('connected');
    });
    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('connect_error', () => setConnectionStatus('error'));

    socket.on('room_created', ({ roomId, room }) => {
      setRoomId(roomId);
      setRoomData(room);
      setView(VIEWS.LOBBY);
    });

    socket.on('room_joined', ({ roomId, room }) => {
      setRoomId(roomId);
      setRoomData(room);
      setView(VIEWS.LOBBY);
    });

    socket.on('join_error', ({ message }) => {
      alert(message);
    });

    socket.on('game_started', () => {
      setView(VIEWS.GAME);
    });

    socket.on('game_over', (data) => {
      setGameOverData(data);
      setView(VIEWS.GAME_OVER);
    });

    socket.on('player_joined', ({ players }) => {
      setRoomData(prev => prev ? { ...prev, players } : prev);
    });

    socket.on('player_left', ({ players }) => {
      setRoomData(prev => prev ? { ...prev, players } : prev);
    });

    // Handle URL-based room joining
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get('room');
    if (urlRoomId) {
      const savedName = localStorage.getItem('playerName');
      if (savedName) {
        setMyName(savedName);
      }
      // Will be handled by HomePage
      window.pendingRoomId = urlRoomId;
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('join_error');
      socket.off('game_started');
      socket.off('game_over');
      socket.off('player_joined');
      socket.off('player_left');
    };
  }, []);

  useEffect(() => {
    if (socket.connected) {
      setMyId(socket.id);
      setConnectionStatus('connected');
    }
  }, []);

  const handleCreateRoom = (name, settings) => {
    setMyName(name);
    localStorage.setItem('playerName', name);
    socket.emit('create_room', { playerName: name, settings });
  };

  const handleJoinRoom = (name, id) => {
    setMyName(name);
    localStorage.setItem('playerName', name);
    socket.emit('join_room', { roomId: id.toUpperCase(), playerName: name });
  };

  const handleStartGame = () => {
    socket.emit('start_game');
  };

  const handlePlayAgain = () => {
    setView(VIEWS.HOME);
    setRoomId(null);
    setRoomData(null);
    setGameOverData(null);
  };

  return (
    <div className="app">
      {connectionStatus === 'disconnected' && (
        <div className="connection-banner error">
          Disconnected from server. Reconnecting...
        </div>
      )}
      {connectionStatus === 'error' && (
        <div className="connection-banner error">
          Cannot connect to server. Make sure the server is running on port 3001.
        </div>
      )}

      {view === VIEWS.HOME && (
        <HomePage
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          initialRoomId={window.pendingRoomId || ''}
          savedName={localStorage.getItem('playerName') || ''}
        />
      )}
      {view === VIEWS.LOBBY && (
        <LobbyPage
          roomId={roomId}
          roomData={roomData}
          myId={myId || socket.id}
          onStartGame={handleStartGame}
        />
      )}
      {view === VIEWS.GAME && (
        <GamePage
          roomId={roomId}
          roomData={roomData}
          myId={myId || socket.id}
          myName={myName}
        />
      )}
      {view === VIEWS.GAME_OVER && (
        <GameOverPage
          data={gameOverData}
          myId={myId || socket.id}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
