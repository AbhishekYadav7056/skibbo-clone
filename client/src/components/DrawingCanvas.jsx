import React, { useRef, useEffect, useState, useCallback } from 'react';
import socket from '../socket.js';

const COLORS = [
  '#000000', '#ffffff', '#ff0000', '#ff6600', '#ffff00', '#00cc00',
  '#0066ff', '#9900ff', '#ff66cc', '#996633', '#808080', '#c0c0c0',
  '#ff9999', '#ffcc99', '#ffff99', '#99ff99', '#99ccff', '#cc99ff',
];

const BRUSH_SIZES = [2, 5, 10, 18, 28];

export default function DrawingCanvas({ isDrawer, phase, roomId }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState('brush'); // brush | eraser | fill
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef(null);
  const strokesRef = useRef([]); // local stroke history for undo
  const currentStrokeRef = useRef([]);

  // ── Canvas setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    socket.emit('request_canvas_sync');

    socket.on('draw_data', (data) => {
      handleRemoteDrawData(data);
    });

    socket.on('canvas_cleared', () => {
      clearCanvas(false);
    });

    socket.on('canvas_redraw', ({ history }) => {
      replayHistory(history);
    });

    return () => {
      socket.off('draw_data');
      socket.off('canvas_cleared');
      socket.off('canvas_redraw');
    };
  }, []);

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  function getCtx() {
    return canvasRef.current?.getContext('2d');
  }

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function drawLine(ctx, x0, y0, x1, y1, c, size, erase) {
    ctx.beginPath();
    ctx.strokeStyle = erase ? '#ffffff' : c;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // ── Mouse / Touch handlers ─────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (!isDrawer || phase !== 'drawing') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    setIsDrawing(true);
    lastPos.current = pos;
    currentStrokeRef.current = [];

    if (tool === 'fill') {
      floodFill(pos.x, pos.y, color);
      socket.emit('canvas_fill', { x: pos.x, y: pos.y, color });
      return;
    }

    socket.emit('draw_start', { x: pos.x, y: pos.y, color, size: brushSize, erase: tool === 'eraser' });
    currentStrokeRef.current.push({ type: 'start', x: pos.x, y: pos.y, color, size: brushSize, erase: tool === 'eraser' });
  }, [isDrawer, phase, color, brushSize, tool]);

  const onPointerMove = useCallback((e) => {
    if (!isDrawing || !isDrawer || phase !== 'drawing') return;
    if (tool === 'fill') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    const ctx = getCtx();
    if (!ctx || !lastPos.current) return;

    const erase = tool === 'eraser';
    drawLine(ctx, lastPos.current.x, lastPos.current.y, pos.x, pos.y, color, brushSize, erase);
    socket.emit('draw_move', { x: pos.x, y: pos.y });
    currentStrokeRef.current.push({ type: 'move', x: pos.x, y: pos.y });
    lastPos.current = pos;
  }, [isDrawing, isDrawer, phase, color, brushSize, tool]);

  const onPointerUp = useCallback(() => {
    if (!isDrawer || phase !== 'drawing') return;
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tool !== 'fill') {
      socket.emit('draw_end');
      currentStrokeRef.current.push({ type: 'end' });
      strokesRef.current.push([...currentStrokeRef.current]);
    }
    lastPos.current = null;
    currentStrokeRef.current = [];
  }, [isDrawer, phase, isDrawing, tool]);

  // ── Remote draw handler ────────────────────────────────────────────────────
  function handleRemoteDrawData(data) {
    const ctx = getCtx();
    if (!ctx) return;

    if (data.type === 'fill') {
      floodFill(data.x, data.y, data.color);
      return;
    }
    if (data.type === 'start') {
      lastPos.current = { x: data.x, y: data.y };
      return;
    }
    if (data.type === 'move') {
      if (!lastPos.current) return;
      drawLine(ctx, lastPos.current.x, lastPos.current.y, data.x, data.y, data.color ?? color, data.size ?? brushSize, data.erase ?? false);
      lastPos.current = { x: data.x, y: data.y };
      return;
    }
    if (data.type === 'end') {
      lastPos.current = null;
      return;
    }
  }

  function replayHistory(history) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let pos = null;
    let currentColor = '#000000';
    let currentSize = 5;
    let currentErase = false;

    for (const item of history) {
      if (item.type === 'fill') {
        floodFill(item.x, item.y, item.color);
      } else if (item.type === 'start') {
        pos = { x: item.x, y: item.y };
        currentColor = item.color ?? '#000000';
        currentSize = item.size ?? 5;
        currentErase = item.erase ?? false;
      } else if (item.type === 'move') {
        if (pos) {
          drawLine(ctx, pos.x, pos.y, item.x, item.y, currentColor, currentSize, currentErase);
          pos = { x: item.x, y: item.y };
        }
      } else if (item.type === 'end') {
        pos = null;
      }
    }
  }

  // ── Flood fill ─────────────────────────────────────────────────────────────
  function floodFill(startX, startY, fillColorHex) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    const idx = (sy * w + sx) * 4;

    const targetR = data[idx], targetG = data[idx + 1], targetB = data[idx + 2], targetA = data[idx + 3];

    const fillRGB = hexToRgb(fillColorHex);
    if (!fillRGB) return;
    if (targetR === fillRGB.r && targetG === fillRGB.g && targetB === fillRGB.b) return;

    const stack = [[sx, sy]];
    const visited = new Uint8Array(w * h);

    const matchColor = (i) =>
      Math.abs(data[i] - targetR) < 32 &&
      Math.abs(data[i + 1] - targetG) < 32 &&
      Math.abs(data[i + 2] - targetB) < 32 &&
      Math.abs(data[i + 3] - targetA) < 32;

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const i = y * w + x;
      if (visited[i]) continue;
      const pi = i * 4;
      if (!matchColor(pi)) continue;
      visited[i] = 1;
      data[pi] = fillRGB.r;
      data[pi + 1] = fillRGB.g;
      data[pi + 2] = fillRGB.b;
      data[pi + 3] = 255;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return isNaN(r) ? null : { r, g, b };
  }

  // ── Canvas actions ─────────────────────────────────────────────────────────
  function clearCanvas(emit = true) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    strokesRef.current = [];
    if (emit) socket.emit('canvas_clear');
  }

  function handleUndo() {
    if (!isDrawer) return;
    socket.emit('draw_undo');
    strokesRef.current.pop();
  }

  return (
    <div className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        width={800}
        height={520}
        className={`drawing-canvas ${isDrawer && phase === 'drawing' ? 'active' : ''}`}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        style={{ cursor: isDrawer && phase === 'drawing' ? (tool === 'eraser' ? 'cell' : tool === 'fill' ? 'crosshair' : 'crosshair') : 'default' }}
      />

      {isDrawer && phase === 'drawing' && (
        <div className="drawing-toolbar">
          {/* Colors */}
          <div className="toolbar-section">
            <div className="color-grid">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`color-btn ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c, border: c === '#ffffff' ? '1px solid #ccc' : 'none' }}
                  onClick={() => { setColor(c); setTool('brush'); }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Brush sizes */}
          <div className="toolbar-section">
            <div className="brush-sizes">
              {BRUSH_SIZES.map(s => (
                <button
                  key={s}
                  className={`brush-size-btn ${brushSize === s && tool === 'brush' ? 'selected' : ''}`}
                  onClick={() => { setBrushSize(s); setTool('brush'); }}
                >
                  <div className="brush-preview" style={{ width: s, height: s, backgroundColor: '#000', borderRadius: '50%' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div className="toolbar-section tools-row">
            <button
              className={`tool-btn ${tool === 'brush' ? 'active' : ''}`}
              onClick={() => setTool('brush')}
              title="Brush"
            >🖊️</button>
            <button
              className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
              onClick={() => setTool('eraser')}
              title="Eraser"
            >🧹</button>
            <button
              className={`tool-btn ${tool === 'fill' ? 'active' : ''}`}
              onClick={() => setTool('fill')}
              title="Fill"
            >🪣</button>
            <button
              className="tool-btn"
              onClick={handleUndo}
              title="Undo"
            >↩️</button>
            <button
              className="tool-btn tool-clear"
              onClick={() => clearCanvas(true)}
              title="Clear Canvas"
            >🗑️</button>
          </div>
        </div>
      )}

      {!isDrawer && phase === 'drawing' && (
        <div className="viewer-badge">👁️ You are watching</div>
      )}
      {phase !== 'drawing' && (
        <div className="canvas-overlay-msg">
          {phase === 'word_selection' ? '⏳ Waiting for word selection...' : ''}
        </div>
      )}
    </div>
  );
}
