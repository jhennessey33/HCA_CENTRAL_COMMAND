"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type Status = "PAUSED" | "RUNNING" | "GAME_OVER";
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Vehicle = { x: number; width: number; color: string };
type WorldRow = {
  worldY: number;
  kind: "GRASS" | "ROAD";
  speed: number;
  direction: 1 | -1;
  vehicles: Vehicle[];
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

const GAME_WIDTH = 240;
const GAME_HEIGHT = 240;
const CELL = 20;
const COLS = 12;
const ROWS = 12;
const GAME_ID = "crossy-cubicle";
const START_COLUMN = 5;
const PLAYER_ANCHOR_ROW = 7;
const VEHICLE_COLORS = ["#0f172a", "#334155", "#7c3aed", "#0284c7", "#e11d48", "#ea580c"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function isSafeRow(worldY: number) {
  if (worldY <= 1) return true;
  if (worldY % 5 === 0) return true;
  return worldY % 13 === 0 || worldY % 13 === 1;
}

function createWorldRow(worldY: number): WorldRow {
  if (isSafeRow(worldY)) {
    return { worldY, kind: "GRASS", speed: 0, direction: 1, vehicles: [] };
  }

  const random = seededRandom(worldY * 9176 + 481);
  const direction: 1 | -1 = random() > 0.5 ? 1 : -1;
  const difficulty = Math.min(1, worldY / 140);
  const speed = 28 + random() * 26 + difficulty * 48;
  const vehicleCount = random() > 0.68 ? 2 : 3;
  const spacing = GAME_WIDTH / vehicleCount;
  const widthChoices = [28, 34, 40, 46];

  return {
    worldY,
    kind: "ROAD",
    speed,
    direction,
    vehicles: Array.from({ length: vehicleCount }, (_, index) => {
      const width = widthChoices[Math.floor(random() * widthChoices.length)];
      return {
        x: index * spacing + random() * Math.max(8, spacing - width),
        width,
        color: VEHICLE_COLORS[Math.floor(random() * VEHICLE_COLORS.length)],
      };
    }),
  };
}

function readScore(data: unknown) {
  if (!data || typeof data !== "object") return 0;
  const record = data as Record<string, unknown>;
  return Math.max(0, Number(record.score ?? record.highScore) || 0);
}

function readHolder(data: unknown) {
  if (!data || typeof data !== "object") return "Nobody";
  const record = data as Record<string, unknown>;
  const value = record.recordHolder ?? record.holder ?? record.user ?? record.name;
  return typeof value === "string" && value.trim() ? value : "Nobody";
}

export default function CrossyCubicle() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);
  const lastFrameRef = useRef(0);
  const statusRef = useRef<Status>("PAUSED");
  const scoreRef = useRef(0);
  const distanceRef = useRef(0);
  const bestDistanceRef = useRef(0);
  const playerColumnRef = useRef(START_COLUMN);
  const cameraBottomRef = useRef(0);
  const rowsRef = useRef<Map<number, WorldRow>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const highScoreRef = useRef(0);
  const moveLockRef = useRef(false);
  const deathLockRef = useRef(false);

  const [status, setStatus] = useState<Status>("PAUSED");
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [recordHolder, setRecordHolder] = useState("Nobody");

  const ensureRows = useCallback((bottom: number) => {
    for (let worldY = Math.max(0, bottom - 2); worldY <= bottom + ROWS + 3; worldY += 1) {
      if (!rowsRef.current.has(worldY)) rowsRef.current.set(worldY, createWorldRow(worldY));
    }

    for (const worldY of rowsRef.current.keys()) {
      if (worldY < bottom - 3 || worldY > bottom + ROWS + 5) rowsRef.current.delete(worldY);
    }
  }, []);

  const setGameStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const loadRecord = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/arcade/high-score?game=${encodeURIComponent(GAME_ID)}`,
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const data: unknown = await response.json();
      const nextHighScore = readScore(data);
      highScoreRef.current = nextHighScore;
      setHighScore(nextHighScore);
      setRecordHolder(readHolder(data));
    } catch {
      // Leaderboard failure never blocks local gameplay.
    }
  }, []);

  useEffect(() => {
    void loadRecord();
  }, [loadRecord]);

  useEffect(() => {
    if (status === "GAME_OVER") void loadRecord();
  }, [status, loadRecord]);

  const submitScore = useCallback(async (finalScore: number) => {
    if (finalScore <= 0 || finalScore <= highScoreRef.current) return;
    highScoreRef.current = finalScore;
    setHighScore(finalScore);

    try {
      const response = await fetch("/api/arcade/high-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: GAME_ID, score: finalScore }),
      });
      if (response.ok) await loadRecord();
    } catch {
      // Keep the optimistic local record until a later refresh.
    }
  }, [loadRecord]);

  const playerScreenRow = useCallback(() => {
    return ROWS - 1 - (distanceRef.current - cameraBottomRef.current);
  }, []);

  const addBurst = useCallback((color: string, amount: number) => {
    const centerX = playerColumnRef.current * CELL + CELL / 2;
    const centerY = playerScreenRow() * CELL + CELL / 2;
    for (let index = 0; index < amount; index += 1) {
      const angle = (Math.PI * 2 * index) / amount + Math.random() * 0.25;
      const speed = 28 + Math.random() * 55;
      particlesRef.current.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.55 + Math.random() * 0.3,
        color,
      });
    }
  }, [playerScreenRow]);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    distanceRef.current = 0;
    bestDistanceRef.current = 0;
    playerColumnRef.current = START_COLUMN;
    cameraBottomRef.current = 0;
    rowsRef.current = new Map();
    particlesRef.current = [];
    deathLockRef.current = false;
    moveLockRef.current = false;
    lastFrameRef.current = 0;
    ensureRows(0);
    setScore(0);
    setDistance(0);
  }, [ensureRows]);

  useEffect(() => {
    ensureRows(0);
  }, [ensureRows]);

  const startGame = useCallback(() => {
    if (statusRef.current === "GAME_OVER") resetGame();
    setGameStatus("RUNNING");
  }, [resetGame, setGameStatus]);

  const finishGame = useCallback(() => {
    if (deathLockRef.current) return;
    deathLockRef.current = true;
    addBurst("#e11d48", 20);
    setGameStatus("GAME_OVER");
    void submitScore(scoreRef.current);
  }, [addBurst, setGameStatus, submitScore]);

  const movePlayer = useCallback((direction: Direction) => {
    if (statusRef.current !== "RUNNING" || moveLockRef.current) return;
    moveLockRef.current = true;
    window.setTimeout(() => {
      moveLockRef.current = false;
    }, 62);

    if (direction === "LEFT") {
      playerColumnRef.current = clamp(playerColumnRef.current - 1, 0, COLS - 1);
    }
    if (direction === "RIGHT") {
      playerColumnRef.current = clamp(playerColumnRef.current + 1, 0, COLS - 1);
    }
    if (direction === "UP") distanceRef.current += 1;
    if (direction === "DOWN") distanceRef.current = Math.max(cameraBottomRef.current, distanceRef.current - 1);

    if (distanceRef.current > bestDistanceRef.current) {
      bestDistanceRef.current = distanceRef.current;
      const milestoneBonus = distanceRef.current % 10 === 0 ? 25 : 0;
      scoreRef.current += 10 + milestoneBonus;
      setScore(scoreRef.current);
    }

    let screenRow = ROWS - 1 - (distanceRef.current - cameraBottomRef.current);
    if (screenRow < PLAYER_ANCHOR_ROW) {
      cameraBottomRef.current += PLAYER_ANCHOR_ROW - screenRow;
      screenRow = PLAYER_ANCHOR_ROW;
      ensureRows(cameraBottomRef.current);
    }

    setDistance(bestDistanceRef.current);
    if (bestDistanceRef.current > 0 && bestDistanceRef.current % 10 === 0 && direction === "UP") {
      addBurst("#f9a8d4", 12);
    }
  }, [addBurst, ensureRows]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const controlCodes = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "Space",
      ];
      if (controlCodes.includes(event.code)) event.preventDefault();

      if (event.code === "Space") {
        if (statusRef.current !== "RUNNING") startGame();
        return;
      }
      if (event.code === "ArrowUp" || event.code === "KeyW") movePlayer("UP");
      if (event.code === "ArrowDown" || event.code === "KeyS") movePlayer("DOWN");
      if (event.code === "ArrowLeft" || event.code === "KeyA") movePlayer("LEFT");
      if (event.code === "ArrowRight" || event.code === "KeyD") movePlayer("RIGHT");
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [movePlayer, startGame]);

  useEffect(() => {
    const fillRoundedRect = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number
    ) => {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
      context.fill();
    };

    const loop = (time: number) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) {
        frameRef.current = requestAnimationFrame(loop);
        return;
      }

      const previous = lastFrameRef.current || time;
      const delta = Math.min((time - previous) / 1000, 0.034);
      lastFrameRef.current = time;

      if (statusRef.current === "RUNNING") {
        for (const row of rowsRef.current.values()) {
          if (row.kind !== "ROAD") continue;
          for (const vehicle of row.vehicles) {
            vehicle.x += row.speed * row.direction * delta;
            if (row.direction === 1 && vehicle.x > GAME_WIDTH + 4) {
              vehicle.x = -vehicle.width - 4;
            }
            if (row.direction === -1 && vehicle.x + vehicle.width < -4) {
              vehicle.x = GAME_WIDTH + 4;
            }
          }
        }

        const currentRow = rowsRef.current.get(distanceRef.current);
        if (currentRow?.kind === "ROAD") {
          const playerLeft = playerColumnRef.current * CELL + 4;
          const playerSize = CELL - 8;
          const collision = currentRow.vehicles.some(
            (vehicle) =>
              playerLeft < vehicle.x + vehicle.width - 3 &&
              playerLeft + playerSize > vehicle.x + 3
          );
          if (collision) finishGame();
        }
      }

      particlesRef.current = particlesRef.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * delta,
          y: particle.y + particle.vy * delta,
          vy: particle.vy + 68 * delta,
          life: particle.life - delta,
        }))
        .filter((particle) => particle.life > 0);

      context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      context.fillStyle = "#f8fafc";
      context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      for (let screenRow = 0; screenRow < ROWS; screenRow += 1) {
        const worldY = cameraBottomRef.current + ROWS - 1 - screenRow;
        const row = rowsRef.current.get(worldY) ?? createWorldRow(worldY);
        const y = screenRow * CELL;

        if (row.kind === "ROAD") {
          context.fillStyle = worldY % 2 === 0 ? "#475569" : "#3f4b5b";
          context.fillRect(0, y, GAME_WIDTH, CELL);
          context.fillStyle = "rgba(255,255,255,0.34)";
          for (let x = 5; x < GAME_WIDTH; x += 30) context.fillRect(x, y + 9, 15, 2);
        } else {
          const milestone = worldY > 0 && worldY % 10 === 0;
          context.fillStyle = milestone ? "#fbcfe8" : worldY % 13 <= 1 ? "#bbf7d0" : "#dcfce7";
          context.fillRect(0, y, GAME_WIDTH, CELL);
          context.fillStyle = milestone ? "rgba(190,24,93,0.18)" : "rgba(22,101,52,0.13)";
          for (let x = (worldY % 2) * 10; x < GAME_WIDTH; x += 40) context.fillRect(x, y + 5, 3, 3);
          if (milestone) {
            context.fillStyle = "#9d174d";
            context.font = "bold 7px system-ui, sans-serif";
            context.textAlign = "right";
            context.fillText(`${worldY} ROWS`, GAME_WIDTH - 5, y + 13);
          }
        }

        if (row.kind === "ROAD") {
          for (const vehicle of row.vehicles) {
            const vehicleY = y + 3;
            context.fillStyle = "rgba(15,23,42,0.22)";
            fillRoundedRect(context, vehicle.x + 1, vehicleY + 2, vehicle.width, CELL - 5, 4);
            context.fillStyle = vehicle.color;
            fillRoundedRect(context, vehicle.x, vehicleY, vehicle.width, CELL - 6, 4);
            context.fillStyle = "#bae6fd";
            const windowX = row.direction === 1 ? vehicle.x + vehicle.width - 10 : vehicle.x + 3;
            fillRoundedRect(context, windowX, vehicleY + 3, 7, 5, 2);
            context.fillStyle = "#020617";
            context.fillRect(vehicle.x + 6, vehicleY + CELL - 7, 6, 2);
            context.fillRect(vehicle.x + vehicle.width - 12, vehicleY + CELL - 7, 6, 2);
          }
        }
      }

      const screenRow = playerScreenRow();
      const playerX = playerColumnRef.current * CELL + 3;
      const playerY = screenRow * CELL + 3;
      context.fillStyle = "rgba(157,23,77,0.2)";
      context.beginPath();
      context.ellipse(playerX + 7, playerY + 15, 8, 3, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#ec4899";
      fillRoundedRect(context, playerX, playerY, CELL - 6, CELL - 6, 4);
      context.fillStyle = "#fff";
      context.fillRect(playerX + 3, playerY + 4, 3, 3);
      context.fillRect(playerX + 8, playerY + 4, 3, 3);
      context.fillStyle = "#831843";
      context.fillRect(playerX + 4, playerY + 5, 1, 1);
      context.fillRect(playerX + 9, playerY + 5, 1, 1);

      for (const particle of particlesRef.current) {
        context.globalAlpha = Math.min(1, particle.life * 2);
        context.fillStyle = particle.color;
        context.fillRect(particle.x - 2, particle.y - 2, 4, 4);
      }
      context.globalAlpha = 1;

      context.fillStyle = "rgba(15,23,42,0.7)";
      fillRoundedRect(context, 5, 5, 63, 16, 6);
      context.fillStyle = "#fff";
      context.font = "bold 8px system-ui, sans-serif";
      context.textAlign = "left";
      context.fillText(`DISTANCE ${bestDistanceRef.current}`, 11, 16);

      if (statusRef.current !== "RUNNING") {
        context.fillStyle = "rgba(15,23,42,0.52)";
        context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        context.fillStyle = "#fff";
        context.textAlign = "center";
        context.font = "bold 17px system-ui, sans-serif";
        context.fillText(statusRef.current === "GAME_OVER" ? "Game Over" : "Crossy Cubicle", GAME_WIDTH / 2, 105);
        context.font = "10px system-ui, sans-serif";
        context.fillText(statusRef.current === "GAME_OVER" ? "Press Space to retry" : "Press Space to play", GAME_WIDTH / 2, 124);
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [finishGame, playerScreenRow]);


  return (
    <div className="rounded-2xl border border-pink-200 bg-white/95 p-3 shadow-sm backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Crossy Cubicle</h3>
          <div className="text-[10px] text-slate-500">🏆 {recordHolder} • {highScore}</div>
          <p className="text-[10px] text-slate-500">WASD / Arrow Keys • Space to start • {distance} rows</p>
        </div>
        <div className="rounded-lg bg-pink-50 px-2 py-1 text-xs font-bold text-pink-700">{score}</div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-50">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="aspect-square w-full"
          aria-label="Infinite Crossy Cubicle game board"
        />
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={startGame}
          disabled={status === "RUNNING"}
          className="rounded-lg bg-pink-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-pink-700 disabled:cursor-default disabled:opacity-50"
        >
          {status === "GAME_OVER" ? "Play Again" : status === "RUNNING" ? "Playing" : "Play"}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>{status === "RUNNING" ? "Game Active" : status === "GAME_OVER" ? "Game Over" : "Click Play"}</span>
        <span>+10 per row • +25 milestones</span>
      </div>
    </div>
  );
}
