"use client";

import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

const GAME_WIDTH = 240;
const GAME_HEIGHT = 240;

const BIRD_X = 60;
const BIRD_SIZE = 12;

const PIPE_WIDTH = 32;
const PIPE_GAP = 75;
const PIPE_SPEED = 2.2;

const GRAVITY = 0.35;
const JUMP_FORCE = -5.5;

const PIPE_SPACING = 130;



type Pipe = {
    x: number;
    gapY: number;
    passed?: boolean;
};



export default function FlappyBirdGame() {
    const canvasRef =
        useRef<HTMLCanvasElement | null>(null);

    const gameContainerRef =
        useRef<HTMLDivElement | null>(null);

    const animationFrameRef =
        useRef<number>(0);

    const birdYRef = useRef(120);
    const birdVelocityRef = useRef(0);

    const pipesRef = useRef<Pipe[]>([]);

    const highScoreRef = useRef(0);





    const [score, setScore] = useState(0);
    const [highScore, setHighScore] =
        useState(0);

    const [recordHolder, setRecordHolder] =
        useState("Nobody");

    const [status, setStatus] = useState<
        "PAUSED" | "RUNNING" | "GAME_OVER"
    >("PAUSED");

    const resetGame = useCallback(() => {
        birdYRef.current = GAME_HEIGHT / 2;

        birdVelocityRef.current = 0;

        pipesRef.current = [
            {
                x: GAME_WIDTH - 40,
                gapY: 100,
                passed: false,
            },
        ];



        setScore(0);
        setStatus("PAUSED");
    }, []);
    const loadRecord = useCallback(async () => {
        try {
            const response = await fetch(
                "/api/arcade/high-score?game=flappy-bird",
            );

            if (!response.ok) {
                return;
            }

            const data =
                await response.json();

            setHighScore(data.score ?? 0);

            setRecordHolder(
                data.holderName ?? "Nobody",
            );

            highScoreRef.current =
                data.score ?? 0;
        } catch (error) {
            console.error(
                "Failed to load record",
                error,
            );
        }
    }, []);


    useEffect(() => {
        highScoreRef.current =
            highScore;
    }, [highScore]);

    useEffect(() => {
        void loadRecord();
    }, [loadRecord]);

    useEffect(() => {
        resetGame();
    }, [resetGame]);

    useEffect(() => {
        if (status === "GAME_OVER") {
            void loadRecord();
        }
    }, [status, loadRecord]);


    const flap = useCallback(() => {
        if (status !== "RUNNING") {
            return;
        }

        birdVelocityRef.current = JUMP_FORCE;
    }, [status]);

    function startGame() {
        if (status === "GAME_OVER") {
            birdYRef.current = GAME_HEIGHT / 2;
            birdVelocityRef.current = 0;

            pipesRef.current = [
                {
                    x: GAME_WIDTH - 40,
                    gapY:
                        50 +
                        Math.random() * 100,
                    passed: false,
                },
            ];

            setScore(0);
        }


        setStatus("RUNNING");

        requestAnimationFrame(() => {
            gameContainerRef.current?.focus();
        });
    }

    useEffect(() => {
        function handleKey(
            event: KeyboardEvent,
        ) {
            if (
                event.code === "Space" ||
                event.key === "w" ||
                event.key === "W" ||
                event.key === "ArrowUp"
            ) {
                event.preventDefault();

                if (
                    status === "GAME_OVER" ||
                    status === "PAUSED"
                ) {
                    startGame();

                    requestAnimationFrame(() => {
                        birdVelocityRef.current =
                            JUMP_FORCE;
                    });

                    return;
                }

                if (status === "RUNNING") {
                    flap();
                }
            }
        }

        window.addEventListener(
            "keydown",
            handleKey,
        );

        return () =>
            window.removeEventListener(
                "keydown",
                handleKey,
            );
    }, [flap, status]);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const context =
            canvas.getContext("2d");

        if (!context) {
            return;
        }

        const ctx = context;

        let lastFrameTime =
            performance.now();

        function drawBird() {
            ctx.fillStyle =
                "#F472B6";

            ctx.beginPath();
            ctx.arc(
                BIRD_X,
                birdYRef.current,
                BIRD_SIZE,
                0,
                Math.PI * 2,
            );
            ctx.fill();

            ctx.fillStyle =
                "#FFFFFF";

            ctx.beginPath();
            ctx.arc(
                BIRD_X + 4,
                birdYRef.current - 3,
                2,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }

        function drawPipes() {
            ctx.fillStyle =
                "#22C55E";

            pipesRef.current.forEach(
                (pipe) => {
                    const topHeight =
                        pipe.gapY -
                        PIPE_GAP / 2;

                    const bottomY =
                        pipe.gapY +
                        PIPE_GAP / 2;

                    ctx.fillRect(
                        pipe.x,
                        0,
                        PIPE_WIDTH,
                        topHeight,
                    );

                    ctx.fillRect(
                        pipe.x,
                        bottomY,
                        PIPE_WIDTH,
                        GAME_HEIGHT - bottomY,
                    );
                },
            );
        }

        function gameLoop(
            currentTime: number,
        ) {
            const delta =
                currentTime - lastFrameTime;

            lastFrameTime = currentTime;

            if (status === "RUNNING") {
                // Bird physics

                birdVelocityRef.current +=
                    GRAVITY;

                birdYRef.current +=
                    birdVelocityRef.current;

                // Spawn pipes based on distance

                const lastPipe =
                    pipesRef.current[
                    pipesRef.current.length - 1
                    ];

                if (
                    !lastPipe ||
                    lastPipe.x < GAME_WIDTH - PIPE_SPACING

                ) {
                    pipesRef.current.push({
                        x: GAME_WIDTH,
                        gapY:
                            60 +
                            Math.random() * 120,
                        passed: false,
                    });
                }


                // Move pipes

                pipesRef.current =
                    pipesRef.current.filter(
                        (pipe) => {
                            pipe.x -=
                                PIPE_SPEED *
                                (delta / 16);

                            // Scoring

                            if (
                                !pipe.passed &&
                                pipe.x +
                                PIPE_WIDTH <
                                BIRD_X
                            ) {
                                pipe.passed =
                                    true;

                                setScore((current) => {
                                    const nextScore = current + 1;

                                    if (
                                        nextScore >
                                        highScoreRef.current
                                    ) {
                                        highScoreRef.current =
                                            nextScore;

                                        setHighScore(nextScore);

                                        void fetch(
                                            "/api/arcade/high-score",
                                            {
                                                method: "POST",

                                                headers: {
                                                    "Content-Type":
                                                        "application/json",
                                                },

                                                body: JSON.stringify({
                                                    game: "flappy-bird",
                                                    score: nextScore,
                                                }),
                                            },
                                        );
                                    }

                                    return nextScore;
                                });
                            }

                            return (
                                pipe.x >
                                -PIPE_WIDTH
                            );
                        },
                    );

                // Wall collision

                if (
                    birdYRef.current <
                    BIRD_SIZE ||
                    birdYRef.current >
                    GAME_HEIGHT -
                    BIRD_SIZE
                ) {
                    setStatus(
                        "GAME_OVER",
                    );
                }

                // Pipe collision

                for (const pipe of pipesRef.current) {
                    const birdLeft =
                        BIRD_X -
                        BIRD_SIZE;

                    const birdRight =
                        BIRD_X +
                        BIRD_SIZE;

                    const birdTop =
                        birdYRef.current -
                        BIRD_SIZE;

                    const birdBottom =
                        birdYRef.current +
                        BIRD_SIZE;

                    const pipeLeft =
                        pipe.x;

                    const pipeRight =
                        pipe.x +
                        PIPE_WIDTH;

                    const insidePipeX =
                        birdRight >
                        pipeLeft &&
                        birdLeft <
                        pipeRight;

                    if (!insidePipeX) {
                        continue;
                    }

                    const topGap =
                        pipe.gapY -
                        PIPE_GAP / 2;

                    const bottomGap =
                        pipe.gapY +
                        PIPE_GAP / 2;

                    const hitPipe =
                        birdTop <
                        topGap ||
                        birdBottom >
                        bottomGap;

                    if (hitPipe) {
                        setStatus(
                            "GAME_OVER",
                        );
                    }
                }
            }

            // Draw

            ctx.clearRect(
                0,
                0,
                GAME_WIDTH,
                GAME_HEIGHT,
            );

            // Background

            const gradient =
                ctx.createLinearGradient(
                    0,
                    0,
                    0,
                    GAME_HEIGHT,
                );

            gradient.addColorStop(
                0,
                "#FCE7F3",
            );

            gradient.addColorStop(
                1,
                "#F9A8D4",
            );

            ctx.fillStyle =
                gradient;

            ctx.fillRect(
                0,
                0,
                GAME_WIDTH,
                GAME_HEIGHT,
            );

            drawPipes();
            drawBird();

            animationFrameRef.current =
                requestAnimationFrame(
                    gameLoop,
                );
        }

        animationFrameRef.current =
            requestAnimationFrame(
                gameLoop,
            );

        return () =>
            cancelAnimationFrame(
                animationFrameRef.current,
            );
    }, [status]);

    return (
        <div className="rounded-2xl border border-pink-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-pink-700">
                            Flappy Bird
                        </p>

                        <span className="text-[10px] font-semibold text-slate-500">
                            🏆 {recordHolder} • {highScore}
                        </span>
                    </div>

                    <p className="text-[10px] text-slate-500">
                        Space / W / ↑
                    </p>
                </div>

                <div className="rounded-lg bg-pink-50 px-2 py-1 text-xs font-bold text-pink-700">
                    {score}
                </div>
            </div>

            <div
                ref={gameContainerRef}
                tabIndex={0}
                onClick={() => {
                    if (status === "RUNNING") {
                        flap();
                    }
                }}
                className="overflow-hidden rounded-xl border border-slate-700"
            >
                <canvas
                    ref={canvasRef}
                    width={GAME_WIDTH}
                    height={GAME_HEIGHT}
                    className="aspect-square w-full"
                />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium text-slate-500">
                    {status === "RUNNING"
                        ? "Flying"
                        : status ===
                            "GAME_OVER"
                            ? "Crashed"
                            : "Click Play"}
                </p>

                <div className="flex gap-1.5">
                    {status === "RUNNING" ? (
                        <button
                            type="button"
                            onClick={() =>
                                setStatus(
                                    "PAUSED",
                                )
                            }
                            className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                        >
                            Pause
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={startGame}
                            className="rounded-lg bg-pink-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-pink-700"
                        >
                            {status ===
                                "GAME_OVER"
                                ? "Restart"
                                : "Play"}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={resetGame}
                        className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    );
}