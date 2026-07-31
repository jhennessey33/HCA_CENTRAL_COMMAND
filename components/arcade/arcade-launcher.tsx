"use client";

import { useEffect, useState } from "react";
import { arcadeGames } from "./arcade-games";

export default function ArcadeLauncher() {
    const [isPinkThemeActive, setIsPinkThemeActive] =
        useState(false);

    const [selectedGameId, setSelectedGameId] =
        useState<string | null>(null);

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

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isPinkThemeActive) {
            setSelectedGameId(null);
        }
    }, [isPinkThemeActive]);

    if (!isPinkThemeActive) {
        return null;
    }

    const selectedGame = arcadeGames.find(
        (game) => game.id === selectedGameId,
    );

    if (selectedGame) {
        const GameComponent = selectedGame.component;

        return (
            <div className="mt-auto pt-4">
                <div className="mb-2 flex justify-end">
                    <button
                        type="button"
                        onClick={() =>
                            setSelectedGameId(null)
                        }
                        className="rounded-lg bg-pink-100 px-2 py-1 text-[10px] font-semibold text-pink-700 hover:bg-pink-200"
                    >
                        ← Arcade
                    </button>
                </div>

                <GameComponent />
            </div>
        );
    }

    return (
        <div className="mt-auto pt-4">
            <div className="rounded-2xl border border-pink-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                <div className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-pink-700">
                        HCA Arcade
                    </p>

                    <p className="text-[10px] text-slate-500">
                        Select a game
                    </p>
                </div>

                <div className="space-y-2">
                    {arcadeGames.map((game) => (
                        <button
                            key={game.id}
                            type="button"
                            onClick={() =>
                                setSelectedGameId(game.id)
                            }
                            className="flex w-full items-center justify-between rounded-xl border border-pink-100 bg-pink-50 px-3 py-2 text-left transition hover:border-pink-300 hover:bg-pink-100"
                        >
                            <div>
                                <p className="text-xs font-semibold text-slate-800">
                                    {game.icon} {game.name}
                                </p>

                                <p className="text-[10px] text-slate-500">
                                    {game.description}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="mt-3 rounded-xl bg-pink-50 p-2 text-center text-[10px] text-pink-700">
                    {arcadeGames.length} game
                    {arcadeGames.length === 1
                        ? ""
                        : "s"}{" "}
                    installed
                </div>
            </div>
        </div>
    );
}