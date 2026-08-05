"use client";

import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

type GameStatus = "READY" | "RUNNING" | "GAME_OVER";

type SectorId =
    | "TECH"
    | "FINANCIALS"
    | "ENERGY"
    | "HEALTHCARE"
    | "INDUSTRIALS"
    | "CONSUMER";

type MarketEventType =
    | "BULL_MARKET"
    | "EARNINGS_BEAT"
    | "MARKET_HALT"
    | "VOLATILITY_SPIKE";

type Sector = {
    id: SectorId;
    name: string;
    symbol: string;
    background: string;
    border: string;
    text: string;
};

type Tile = {
    id: number;
    sector: SectorId;
};

type Position = {
    row: number;
    column: number;
};

type MarketEvent = {
    type: MarketEventType;
    title: string;
    description: string;
    sector?: SectorId;
};

const GAME_ID = "market-match";
const BOARD_SIZE = 6;
const GAME_DURATION = 60;
const EVENT_DURATION = 6;

const SECTORS: Sector[] = [
    {
        id: "TECH",
        name: "Technology",
        symbol: "💻",
        background: "#dbeafe",
        border: "#60a5fa",
        text: "#1e40af",
    },
    {
        id: "FINANCIALS",
        name: "Financials",
        symbol: "🏦",
        background: "#dcfce7",
        border: "#4ade80",
        text: "#166534",
    },
    {
        id: "ENERGY",
        name: "Energy",
        symbol: "⚡",
        background: "#fef3c7",
        border: "#fbbf24",
        text: "#92400e",
    },
    {
        id: "HEALTHCARE",
        name: "Healthcare",
        symbol: "🏥",
        background: "#fce7f3",
        border: "#f472b6",
        text: "#9d174d",
    },
    {
        id: "INDUSTRIALS",
        name: "Industrials",
        symbol: "🏭",
        background: "#e2e8f0",
        border: "#94a3b8",
        text: "#334155",
    },
    {
        id: "CONSUMER",
        name: "Consumer",
        symbol: "🛍️",
        background: "#ede9fe",
        border: "#a78bfa",
        text: "#5b21b6",
    },
];

let nextTileId = 1;

function randomSector(): SectorId {
    const index = Math.floor(Math.random() * SECTORS.length);
    return SECTORS[index].id;
}

function createTile(sector?: SectorId): Tile {
    return {
        id: nextTileId++,
        sector: sector ?? randomSector(),
    };
}

function getSector(sectorId: SectorId) {
    return (
        SECTORS.find((sector) => sector.id === sectorId) ??
        SECTORS[0]
    );
}

function createBoard(): Tile[][] {
    const board: Tile[][] = [];

    for (let row = 0; row < BOARD_SIZE; row += 1) {
        const nextRow: Tile[] = [];

        for (
            let column = 0;
            column < BOARD_SIZE;
            column += 1
        ) {
            const unavailableSectors = new Set<SectorId>();

            if (
                column >= 2 &&
                nextRow[column - 1].sector ===
                    nextRow[column - 2].sector
            ) {
                unavailableSectors.add(
                    nextRow[column - 1].sector,
                );
            }

            if (
                row >= 2 &&
                board[row - 1][column].sector ===
                    board[row - 2][column].sector
            ) {
                unavailableSectors.add(
                    board[row - 1][column].sector,
                );
            }

            const availableSectors = SECTORS.filter(
                (sector) =>
                    !unavailableSectors.has(sector.id),
            );

            const selectedSector =
                availableSectors[
                    Math.floor(
                        Math.random() *
                            availableSectors.length,
                    )
                ].id;

            nextRow.push(createTile(selectedSector));
        }

        board.push(nextRow);
    }

    return board;
}

function cloneBoard(board: Tile[][]) {
    return board.map((row) => [...row]);
}

function positionsAreEqual(
    first: Position,
    second: Position,
) {
    return (
        first.row === second.row &&
        first.column === second.column
    );
}

function positionsAreAdjacent(
    first: Position,
    second: Position,
) {
    const rowDifference = Math.abs(
        first.row - second.row,
    );
    const columnDifference = Math.abs(
        first.column - second.column,
    );

    return rowDifference + columnDifference === 1;
}

function swapTiles(
    board: Tile[][],
    first: Position,
    second: Position,
) {
    const nextBoard = cloneBoard(board);

    const firstTile = nextBoard[first.row][first.column];
    nextBoard[first.row][first.column] =
        nextBoard[second.row][second.column];
    nextBoard[second.row][second.column] = firstTile;

    return nextBoard;
}

function positionKey(row: number, column: number) {
    return `${row}:${column}`;
}

function findMatches(board: Tile[][]) {
    const matchedPositions = new Set<string>();

    for (let row = 0; row < BOARD_SIZE; row += 1) {
        let matchStart = 0;

        for (
            let column = 1;
            column <= BOARD_SIZE;
            column += 1
        ) {
            const currentSector =
                column < BOARD_SIZE
                    ? board[row][column].sector
                    : null;

            const startingSector =
                board[row][matchStart].sector;

            if (currentSector !== startingSector) {
                const matchLength = column - matchStart;

                if (matchLength >= 3) {
                    for (
                        let matchColumn = matchStart;
                        matchColumn < column;
                        matchColumn += 1
                    ) {
                        matchedPositions.add(
                            positionKey(row, matchColumn),
                        );
                    }
                }

                matchStart = column;
            }
        }
    }

    for (
        let column = 0;
        column < BOARD_SIZE;
        column += 1
    ) {
        let matchStart = 0;

        for (
            let row = 1;
            row <= BOARD_SIZE;
            row += 1
        ) {
            const currentSector =
                row < BOARD_SIZE
                    ? board[row][column].sector
                    : null;

            const startingSector =
                board[matchStart][column].sector;

            if (currentSector !== startingSector) {
                const matchLength = row - matchStart;

                if (matchLength >= 3) {
                    for (
                        let matchRow = matchStart;
                        matchRow < row;
                        matchRow += 1
                    ) {
                        matchedPositions.add(
                            positionKey(matchRow, column),
                        );
                    }
                }

                matchStart = row;
            }
        }
    }

    return matchedPositions;
}

function collapseBoard(
    board: Tile[][],
    matchedPositions: Set<string>,
) {
    const nextBoard: Tile[][] = Array.from(
        { length: BOARD_SIZE },
        () => Array<Tile>(BOARD_SIZE),
    );

    for (
        let column = 0;
        column < BOARD_SIZE;
        column += 1
    ) {
        const survivingTiles: Tile[] = [];

        for (
            let row = BOARD_SIZE - 1;
            row >= 0;
            row -= 1
        ) {
            if (
                !matchedPositions.has(
                    positionKey(row, column),
                )
            ) {
                survivingTiles.push(board[row][column]);
            }
        }

        let survivorIndex = 0;

        for (
            let row = BOARD_SIZE - 1;
            row >= 0;
            row -= 1
        ) {
            nextBoard[row][column] =
                survivorIndex < survivingTiles.length
                    ? survivingTiles[survivorIndex++]
                    : createTile();
        }
    }

    return nextBoard;
}

function boardHasPossibleMove(board: Tile[][]) {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (
            let column = 0;
            column < BOARD_SIZE;
            column += 1
        ) {
            const current = { row, column };

            if (column + 1 < BOARD_SIZE) {
                const right = {
                    row,
                    column: column + 1,
                };

                if (
                    findMatches(
                        swapTiles(board, current, right),
                    ).size > 0
                ) {
                    return true;
                }
            }

            if (row + 1 < BOARD_SIZE) {
                const below = {
                    row: row + 1,
                    column,
                };

                if (
                    findMatches(
                        swapTiles(board, current, below),
                    ).size > 0
                ) {
                    return true;
                }
            }
        }
    }

    return false;
}

function createPlayableBoard() {
    let board = createBoard();
    let attempts = 0;

    while (!boardHasPossibleMove(board) && attempts < 25) {
        board = createBoard();
        attempts += 1;
    }

    return board;
}

function readScore(data: unknown) {
    if (!data || typeof data !== "object") {
        return 0;
    }

    const record = data as Record<string, unknown>;

    return Math.max(
        0,
        Number(record.score ?? record.highScore) || 0,
    );
}

function readHolder(data: unknown) {
    if (!data || typeof data !== "object") {
        return "Nobody";
    }

    const record = data as Record<string, unknown>;

    const value =
        record.recordHolder ??
        record.holder ??
        record.user ??
        record.name;

    return typeof value === "string" && value.trim()
        ? value
        : "Nobody";
}

function wait(milliseconds: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

export default function MarketMatchGame() {
    const [board, setBoard] = useState<Tile[][]>(() =>
        createPlayableBoard(),
    );

    const [selectedPosition, setSelectedPosition] =
        useState<Position | null>(null);

    const [matchedTiles, setMatchedTiles] = useState<
        Set<string>
    >(new Set());

    const [status, setStatus] =
        useState<GameStatus>("READY");

    const [score, setScore] = useState(0);
    const [timeRemaining, setTimeRemaining] =
        useState(GAME_DURATION);

    const [combo, setCombo] = useState(0);
    const [isResolving, setIsResolving] =
        useState(false);

    const [highScore, setHighScore] = useState(0);
    const [recordHolder, setRecordHolder] =
        useState("Nobody");

    const [marketEvent, setMarketEvent] =
        useState<MarketEvent | null>(null);

    const boardRef = useRef(board);
    const scoreRef = useRef(0);
    const statusRef = useRef<GameStatus>("READY");
    const highScoreRef = useRef(0);
    const eventRef = useRef<MarketEvent | null>(null);
    const eventTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        boardRef.current = board;
    }, [board]);

    useEffect(() => {
        scoreRef.current = score;
    }, [score]);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    useEffect(() => {
        eventRef.current = marketEvent;
    }, [marketEvent]);

    const loadRecord = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/arcade/high-score?game=${encodeURIComponent(
                    GAME_ID,
                )}`,
                {
                    cache: "no-store",
                },
            );

            if (!response.ok) {
                return;
            }

            const data: unknown = await response.json();
            const nextHighScore = readScore(data);

            highScoreRef.current = nextHighScore;
            setHighScore(nextHighScore);
            setRecordHolder(readHolder(data));
        } catch {
            // Leaderboard failure does not block gameplay.
        }
    }, []);

    useEffect(() => {
        void loadRecord();
    }, [loadRecord]);

    const submitScore = useCallback(
        async (finalScore: number) => {
            if (
                finalScore <= 0 ||
                finalScore <= highScoreRef.current
            ) {
                return;
            }

            highScoreRef.current = finalScore;
            setHighScore(finalScore);

            try {
                const response = await fetch(
                    "/api/arcade/high-score",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            game: GAME_ID,
                            score: finalScore,
                        }),
                    },
                );

                if (response.ok) {
                    await loadRecord();
                }
            } catch {
                // Keep the optimistic record until refresh.
            }
        },
        [loadRecord],
    );

    const clearActiveEvent = useCallback(() => {
        if (eventTimeoutRef.current !== null) {
            window.clearTimeout(eventTimeoutRef.current);
            eventTimeoutRef.current = null;
        }

        eventRef.current = null;
        setMarketEvent(null);
    }, []);

    const activateMarketEvent = useCallback(
        (event: MarketEvent) => {
            clearActiveEvent();

            eventRef.current = event;
            setMarketEvent(event);

            eventTimeoutRef.current = window.setTimeout(
                () => {
                    eventRef.current = null;
                    setMarketEvent(null);
                    eventTimeoutRef.current = null;
                },
                EVENT_DURATION * 1000,
            );
        },
        [clearActiveEvent],
    );

    const triggerRandomEvent = useCallback(() => {
        if (statusRef.current !== "RUNNING") {
            return;
        }

        const eventTypes: MarketEventType[] = [
            "BULL_MARKET",
            "EARNINGS_BEAT",
            "MARKET_HALT",
            "VOLATILITY_SPIKE",
        ];

        const selectedType =
            eventTypes[
                Math.floor(
                    Math.random() * eventTypes.length,
                )
            ];

        if (selectedType === "BULL_MARKET") {
            activateMarketEvent({
                type: "BULL_MARKET",
                title: "Bull Market",
                description: "All matches score double.",
            });

            return;
        }

        if (selectedType === "EARNINGS_BEAT") {
            const selectedSector =
                SECTORS[
                    Math.floor(
                        Math.random() * SECTORS.length,
                    )
                ];

            activateMarketEvent({
                type: "EARNINGS_BEAT",
                title: "Earnings Beat",
                description: `${selectedSector.name} matches score double.`,
                sector: selectedSector.id,
            });

            return;
        }

        if (selectedType === "MARKET_HALT") {
            activateMarketEvent({
                type: "MARKET_HALT",
                title: "Market Halt",
                description: "The timer is temporarily frozen.",
            });

            return;
        }

        setSelectedPosition(null);
        setBoard(createPlayableBoard());

        activateMarketEvent({
            type: "VOLATILITY_SPIKE",
            title: "Volatility Spike",
            description: "The market board has been shuffled.",
        });
    }, [activateMarketEvent]);

    const finishGame = useCallback(() => {
        if (statusRef.current !== "RUNNING") {
            return;
        }

        statusRef.current = "GAME_OVER";
        setStatus("GAME_OVER");
        setSelectedPosition(null);
        setCombo(0);
        clearActiveEvent();

        void submitScore(scoreRef.current);
    }, [clearActiveEvent, submitScore]);

    useEffect(() => {
        if (status !== "RUNNING") {
            return;
        }

        const timer = window.setInterval(() => {
            if (
                eventRef.current?.type === "MARKET_HALT"
            ) {
                return;
            }

            setTimeRemaining((currentTime) => {
                if (currentTime <= 1) {
                    window.clearInterval(timer);
                    window.setTimeout(finishGame, 0);
                    return 0;
                }

                return currentTime - 1;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [finishGame, status]);

    useEffect(() => {
        if (status !== "RUNNING") {
            return;
        }

        const firstEvent = window.setTimeout(
            triggerRandomEvent,
            9000,
        );

        const eventInterval = window.setInterval(
            triggerRandomEvent,
            14000,
        );

        return () => {
            window.clearTimeout(firstEvent);
            window.clearInterval(eventInterval);
        };
    }, [status, triggerRandomEvent]);

    useEffect(() => {
        return () => {
            if (eventTimeoutRef.current !== null) {
                window.clearTimeout(
                    eventTimeoutRef.current,
                );
            }
        };
    }, []);

    const startGame = useCallback(() => {
        clearActiveEvent();

        const nextBoard = createPlayableBoard();

        boardRef.current = nextBoard;
        scoreRef.current = 0;
        statusRef.current = "RUNNING";

        setBoard(nextBoard);
        setScore(0);
        setTimeRemaining(GAME_DURATION);
        setCombo(0);
        setMatchedTiles(new Set());
        setSelectedPosition(null);
        setIsResolving(false);
        setStatus("RUNNING");
    }, [clearActiveEvent]);

    const calculateMatchPoints = useCallback(
        (
            currentBoard: Tile[][],
            matches: Set<string>,
            cascade: number,
        ) => {
            let basePoints = matches.size * 100;

            if (
                eventRef.current?.type ===
                "BULL_MARKET"
            ) {
                basePoints *= 2;
            }

            if (
                eventRef.current?.type ===
                    "EARNINGS_BEAT" &&
                eventRef.current.sector
            ) {
                let earningsTiles = 0;

                for (const key of matches) {
                    const [row, column] = key
                        .split(":")
                        .map(Number);

                    if (
                        currentBoard[row][column]
                            .sector ===
                        eventRef.current.sector
                    ) {
                        earningsTiles += 1;
                    }
                }

                basePoints += earningsTiles * 100;
            }

            return basePoints * Math.max(1, cascade);
        },
        [],
    );

    const resolveBoard = useCallback(
        async (startingBoard: Tile[][]) => {
            let workingBoard = startingBoard;
            let cascade = 1;

            setIsResolving(true);

            while (
                statusRef.current === "RUNNING"
            ) {
                const matches = findMatches(workingBoard);

                if (matches.size === 0) {
                    break;
                }

                setCombo(cascade);
                setMatchedTiles(matches);

                const points = calculateMatchPoints(
                    workingBoard,
                    matches,
                    cascade,
                );

                scoreRef.current += points;
                setScore(scoreRef.current);

                await wait(220);

                workingBoard = collapseBoard(
                    workingBoard,
                    matches,
                );

                boardRef.current = workingBoard;
                setBoard(workingBoard);
                setMatchedTiles(new Set());

                cascade += 1;

                await wait(180);
            }

            if (
                statusRef.current === "RUNNING" &&
                !boardHasPossibleMove(workingBoard)
            ) {
                workingBoard = createPlayableBoard();
                boardRef.current = workingBoard;
                setBoard(workingBoard);

                activateMarketEvent({
                    type: "VOLATILITY_SPIKE",
                    title: "No Available Trades",
                    description:
                        "The market board has been reshuffled.",
                });
            }

            window.setTimeout(() => {
                setCombo(0);
            }, 650);

            setIsResolving(false);
        },
        [activateMarketEvent, calculateMatchPoints],
    );

    const handleTileClick = useCallback(
        (position: Position) => {
            if (
                statusRef.current !== "RUNNING" ||
                isResolving
            ) {
                return;
            }

            if (!selectedPosition) {
                setSelectedPosition(position);
                return;
            }

            if (
                positionsAreEqual(
                    selectedPosition,
                    position,
                )
            ) {
                setSelectedPosition(null);
                return;
            }

            if (
                !positionsAreAdjacent(
                    selectedPosition,
                    position,
                )
            ) {
                setSelectedPosition(position);
                return;
            }

            const swappedBoard = swapTiles(
                boardRef.current,
                selectedPosition,
                position,
            );

            const matches = findMatches(swappedBoard);

            setSelectedPosition(null);

            if (matches.size === 0) {
                const originalBoard =
                    boardRef.current;

                boardRef.current = swappedBoard;
                setBoard(swappedBoard);

                window.setTimeout(() => {
                    boardRef.current = originalBoard;
                    setBoard(originalBoard);
                }, 180);

                return;
            }

            boardRef.current = swappedBoard;
            setBoard(swappedBoard);

            void resolveBoard(swappedBoard);
        },
        [
            isResolving,
            resolveBoard,
            selectedPosition,
        ],
    );

    const eventSector =
        marketEvent?.sector !== undefined
            ? getSector(marketEvent.sector)
            : null;

    return (
        <div className="rounded-2xl border border-pink-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-bold text-slate-900">
                        Market Match
                    </h3>

                    <div className="text-[10px] text-slate-500">
                        🏆 {recordHolder} •{" "}
                        {highScore.toLocaleString()}
                    </div>

                    <p className="text-[10px] text-slate-500">
                        Match 3 or more sectors • 60-second
                        score attack
                    </p>
                </div>

                <div className="flex gap-1">
                    <div className="rounded-lg bg-slate-100 px-2 py-1 text-center">
                        <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">
                            Time
                        </div>

                        <div
                            className={`text-xs font-bold ${
                                timeRemaining <= 10
                                    ? "text-rose-600"
                                    : "text-slate-800"
                            }`}
                        >
                            {timeRemaining}
                        </div>
                    </div>

                    <div className="rounded-lg bg-pink-50 px-2 py-1 text-center">
                        <div className="text-[8px] font-semibold uppercase tracking-wide text-pink-500">
                            Score
                        </div>

                        <div className="text-xs font-bold text-pink-700">
                            {score.toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-2 min-h-10">
                {marketEvent ? (
                    <div className="rounded-xl border border-pink-200 bg-gradient-to-r from-pink-50 to-violet-50 px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-pink-700">
                                    {eventSector?.symbol ?? "📊"}{" "}
                                    {marketEvent.title}
                                </p>

                                <p className="text-[9px] text-slate-600">
                                    {marketEvent.description}
                                </p>
                            </div>

                            <span className="rounded-full bg-white px-2 py-0.5 text-[8px] font-semibold text-pink-600 shadow-sm">
                                MARKET EVENT
                            </span>
                        </div>
                    </div>
                ) : combo > 1 ? (
                    <div className="rounded-xl bg-amber-50 px-2 py-1.5 text-center text-[10px] font-bold text-amber-700">
                        🔥 {combo}× CASCADE COMBO
                    </div>
                ) : (
                    <div className="rounded-xl bg-slate-50 px-2 py-1.5 text-center text-[9px] text-slate-500">
                        Select a tile, then select an adjacent
                        tile to swap.
                    </div>
                )}
            </div>

            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-1.5">
                <div className="grid grid-cols-6 gap-1">
                    {board.map((row, rowIndex) =>
                        row.map((tile, columnIndex) => {
                            const sector = getSector(
                                tile.sector,
                            );

                            const position = {
                                row: rowIndex,
                                column: columnIndex,
                            };

                            const isSelected =
                                selectedPosition !== null &&
                                positionsAreEqual(
                                    selectedPosition,
                                    position,
                                );

                            const isMatched =
                                matchedTiles.has(
                                    positionKey(
                                        rowIndex,
                                        columnIndex,
                                    ),
                                );

                            return (
                                <button
                                    key={tile.id}
                                    type="button"
                                    disabled={
                                        status !==
                                            "RUNNING" ||
                                        isResolving
                                    }
                                    onClick={() =>
                                        handleTileClick(
                                            position,
                                        )
                                    }
                                    title={sector.name}
                                    aria-label={`${sector.name} tile at row ${
                                        rowIndex + 1
                                    }, column ${
                                        columnIndex + 1
                                    }`}
                                    className={`flex aspect-square items-center justify-center rounded-lg border text-base shadow-sm transition duration-150 ${
                                        isSelected
                                            ? "scale-105 ring-2 ring-pink-500 ring-offset-1"
                                            : "hover:scale-105"
                                    } ${
                                        isMatched
                                            ? "scale-75 opacity-20"
                                            : "opacity-100"
                                    } disabled:cursor-default`}
                                    style={{
                                        backgroundColor:
                                            sector.background,
                                        borderColor:
                                            sector.border,
                                        color: sector.text,
                                    }}
                                >
                                    <span
                                        className={
                                            isMatched
                                                ? "animate-ping"
                                                : ""
                                        }
                                    >
                                        {sector.symbol}
                                    </span>
                                </button>
                            );
                        }),
                    )}
                </div>

                {status !== "RUNNING" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[1px]">
                        <div className="text-center text-white">
                            <div className="mb-1 text-3xl">
                                📈
                            </div>

                            <p className="text-base font-bold">
                                {status === "GAME_OVER"
                                    ? "Closing Bell"
                                    : "Market Match"}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-200">
                                {status === "GAME_OVER"
                                    ? `Final score: ${score.toLocaleString()}`
                                    : "Build combos before time expires."}
                            </p>

                            <button
                                type="button"
                                onClick={startGame}
                                className="mt-3 rounded-lg bg-pink-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-pink-700"
                            >
                                {status === "GAME_OVER"
                                    ? "Trade Again"
                                    : "Open Market"}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1">
                {SECTORS.map((sector) => (
                    <div
                        key={sector.id}
                        className="truncate rounded-lg border px-1.5 py-1 text-center text-[8px] font-semibold"
                        style={{
                            backgroundColor:
                                sector.background,
                            borderColor: sector.border,
                            color: sector.text,
                        }}
                    >
                        {sector.symbol} {sector.name}
                    </div>
                ))}
            </div>

            <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500">
                <span>
                    {status === "RUNNING"
                        ? isResolving
                            ? "Processing trades..."
                            : marketEvent?.type ===
                                "MARKET_HALT"
                              ? "Trading halted"
                              : "Market open"
                        : status === "GAME_OVER"
                          ? "Market closed"
                          : "Ready to trade"}
                </span>

                <span>100 points per tile</span>
            </div>
        </div>
    );
}