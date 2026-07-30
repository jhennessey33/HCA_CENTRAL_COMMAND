"use client";
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

type Point = {
    x: number;
    y: number;
};

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const BOARD_SIZE = 12;
const STARTING_SNAKE: Point[] = [
    { x: 5, y: 6 },
    { x: 4, y: 6 },
    { x: 3, y: 6 },
];

const STARTING_FOOD: Point = {
    x: 8,
    y: 6,
};

function pointsMatch(first: Point, second: Point) {
    return first.x === second.x && first.y === second.y;
}

function createFood(snake: Point[]) {
    const availableCells: Point[] = [];

    for (let y = 0; y < BOARD_SIZE; y += 1) {
        for (let x = 0; x < BOARD_SIZE; x += 1) {
            const cell = { x, y };

            if (!snake.some((segment) => pointsMatch(segment, cell))) {
                availableCells.push(cell);
            }
        }
    }

    if (availableCells.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(
        Math.random() * availableCells.length,
    );

    return availableCells[randomIndex];
}

function getNextHead(head: Point, direction: Direction): Point {
    if (direction === "UP") {
        return {
            x: head.x,
            y: head.y - 1,
        };
    }

    if (direction === "DOWN") {
        return {
            x: head.x,
            y: head.y + 1,
        };
    }

    if (direction === "LEFT") {
        return {
            x: head.x - 1,
            y: head.y,
        };
    }

    return {
        x: head.x + 1,
        y: head.y,
    };
}

function isOppositeDirection(
    currentDirection: Direction,
    nextDirection: Direction,
) {
    return (
        (currentDirection === "UP" && nextDirection === "DOWN") ||
        (currentDirection === "DOWN" && nextDirection === "UP") ||
        (currentDirection === "LEFT" && nextDirection === "RIGHT") ||
        (currentDirection === "RIGHT" && nextDirection === "LEFT")
    );
}

export default function PinkThemeSnake() {
    const [isPinkThemeActive, setIsPinkThemeActive] =
        useState(false);

    const [snake, setSnake] =
        useState<Point[]>(STARTING_SNAKE);

    const [food, setFood] =
        useState<Point | null>(STARTING_FOOD);

    const foodRef =
        useRef<Point | null>(STARTING_FOOD);

    const directionRef =
        useRef<Direction>("RIGHT");

    const inputQueueRef =
        useRef<Direction[]>([]);

    const [status, setStatus] = useState<
        "PAUSED" | "RUNNING" | "GAME_OVER" | "WON"
    >("PAUSED");

    const [score, setScore] = useState(0);
    const boardRef =
        useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        foodRef.current = food;
    }, [food]);

    useEffect(() => {
        const rootElement = document.documentElement;

        function syncPinkThemeState() {
            setIsPinkThemeActive(
                rootElement.classList.contains("hca-pink-theme"),
            );
        }

        syncPinkThemeState();

        const observer = new MutationObserver(syncPinkThemeState);

        observer.observe(rootElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => {
            observer.disconnect();
        };
    }, []);

    const resetGame = useCallback(() => {
        setSnake(STARTING_SNAKE);
        setFood(STARTING_FOOD);

        directionRef.current = "RIGHT";
        inputQueueRef.current = [];

        setScore(0);
        setStatus("PAUSED");
    }, []);

    useEffect(() => {
        if (!isPinkThemeActive) {
            resetGame();
        }
    }, [isPinkThemeActive, resetGame]);

    useEffect(() => {
        if (status !== "RUNNING") {
            return;
        }

        const MOVE_INTERVAL = 90;

        let lastMoveTime =
            performance.now();

        let animationFrameId = 0;

        function gameLoop(
            currentTime: number,
        ) {
            while (
                currentTime - lastMoveTime >= MOVE_INTERVAL
            ) {
                lastMoveTime += MOVE_INTERVAL;

                // move snake


                setSnake((currentSnake) => {
                    const queuedDirection =
                        inputQueueRef.current.shift();

                    if (
                        queuedDirection &&
                        !isOppositeDirection(
                            directionRef.current,
                            queuedDirection,
                        )
                    ) {
                        directionRef.current =
                            queuedDirection;
                    }

                    const nextHead =
                        getNextHead(
                            currentSnake[0],
                            directionRef.current,
                        );

                    const hitWall =
                        nextHead.x < 0 ||
                        nextHead.x >= BOARD_SIZE ||
                        nextHead.y < 0 ||
                        nextHead.y >= BOARD_SIZE;

                    if (hitWall) {
                        setStatus(
                            "GAME_OVER",
                        );

                        return currentSnake;
                    }

                    const ateFood =
                        foodRef.current != null &&
                        pointsMatch(
                            nextHead,
                            foodRef.current,
                        );

                    const collisionBody =
                        ateFood
                            ? currentSnake
                            : currentSnake.slice(
                                0,
                                -1,
                            );

                    const hitSnake =
                        collisionBody.some(
                            (segment) =>
                                pointsMatch(
                                    segment,
                                    nextHead,
                                ),
                        );

                    if (hitSnake) {
                        setStatus(
                            "GAME_OVER",
                        );

                        return currentSnake;
                    }

                    const nextSnake = [
                        nextHead,
                        ...currentSnake,
                    ];

                    if (!ateFood) {
                        nextSnake.pop();
                        return nextSnake;
                    }

                    setScore(
                        (score) => score + 1,
                    );

                    const nextFood =
                        createFood(nextSnake);

                    setFood(nextFood);

                    if (!nextFood) {
                        setStatus("WON");
                    }

                    return nextSnake;
                });
            }

            animationFrameId =
                requestAnimationFrame(
                    gameLoop,
                );
        }

        animationFrameId =
            requestAnimationFrame(
                gameLoop,
            );

        return () =>
            cancelAnimationFrame(
                animationFrameId,
            );
    }, [status]);

    function startGame() {
        if (
            status === "GAME_OVER" ||
            status === "WON"
        ) {
            setSnake(STARTING_SNAKE);
            setFood(STARTING_FOOD);
            directionRef.current = "RIGHT";
            inputQueueRef.current = [];
            setScore(0);
        }

        setStatus("RUNNING");

        requestAnimationFrame(() => {
            boardRef.current?.focus();
        });
    }

    function handleKeyDown(
        event: React.KeyboardEvent<HTMLDivElement>,
    ) {
        const directionByKey: Record<
            string,
            Direction
        > = {
            ArrowUp: "UP",
            w: "UP",
            W: "UP",

            ArrowDown: "DOWN",
            s: "DOWN",
            S: "DOWN",

            ArrowLeft: "LEFT",
            a: "LEFT",
            A: "LEFT",

            ArrowRight: "RIGHT",
            d: "RIGHT",
            D: "RIGHT",
        };

        const nextDirection =
            directionByKey[event.key];

        if (!nextDirection) {
            return;
        }

        event.preventDefault();

        if (event.repeat) {
            return;
        }

        const queue =
            inputQueueRef.current;

        const referenceDirection =
            queue.length > 0
                ? queue[queue.length - 1]
                : directionRef.current;

        if (
            isOppositeDirection(
                referenceDirection,
                nextDirection,
            )
        ) {
            return;
        }

        if (
            referenceDirection === nextDirection
        ) {
            return;
        }

        if (queue.length < 3) {
            queue.push(nextDirection);
        }
    }


    if (!isPinkThemeActive) {
        return null;
    }

    return (
        <div className="mt-auto pt-4">
            <div className="rounded-2xl border border-pink-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-pink-700">
                            HCA Snake
                        </p>

                        <p className="text-[10px] text-slate-500">
                            Arrow keys or WASD
                        </p>
                    </div>

                    <div className="rounded-lg bg-pink-50 px-2 py-1 text-xs font-bold tabular-nums text-pink-700">
                        {score}
                    </div>
                </div>

                <div
                    ref={boardRef}
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                    onClick={() => boardRef.current?.focus()}
                    aria-label="Snake game board. Use arrow keys or WASD to move."
                    className="grid aspect-square w-full grid-cols-12 overflow-hidden rounded-xl border border-slate-700 bg-cover bg-center bg-no-repeat outline-none ring-pink-400 focus:ring-2"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(15, 23, 42, 0.35), rgba(15, 23, 42, 0.35)), url('/assets/pink-icon.png')",
                    }}
                >

                    {Array.from({
                        length: BOARD_SIZE * BOARD_SIZE,
                    }).map((_, index) => {
                        const point = {
                            x: index % BOARD_SIZE,
                            y: Math.floor(index / BOARD_SIZE),
                        };

                        const snakeIndex = snake.findIndex((segment) =>
                            pointsMatch(segment, point),
                        );

                        const isSnake = snakeIndex >= 0;
                        const isHead = snakeIndex === 0;
                        const isFood =
                            food != null && pointsMatch(food, point);

                        return (
                            <div
                                key={index}
                                className={
                                    isHead
                                        ? "bg-pink-300"
                                        : isSnake
                                            ? "bg-pink-500"
                                            : isFood
                                                ? "rounded-full bg-amber-300"
                                                : "bg-transparent"
                                }
                            />
                        );
                    })}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-medium text-slate-500">
                        {status === "RUNNING"
                            ? "Game active"
                            : status === "GAME_OVER"
                                ? "Game over"
                                : status === "WON"
                                    ? "Board cleared"
                                    : "Click Play"}
                    </p>

                    <div className="flex gap-1.5">
                        {status === "RUNNING" ? (
                            <button
                                type="button"
                                onClick={() => setStatus("PAUSED")}
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
                                {status === "GAME_OVER" ||
                                    status === "WON"
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
        </div>
    );
}