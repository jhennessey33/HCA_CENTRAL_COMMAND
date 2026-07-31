import PinkThemeSnake from "./snake-game";
import FlappyBirdGame from "./flappy-bird-game";
export type ArcadeGame = {
    id: string;
    name: string;
    description: string;
    icon: string;
    component: React.ComponentType;
};

export const arcadeGames: ArcadeGame[] = [
    {
        id: "snake",
        name: "Snake",
        description: "Classic snake",
        icon: "🐍",
        component: PinkThemeSnake,
    },



{
    id: "flappy-bird",
    name: "Flappy Bird",
    description: "Thread the pipes",
    icon: "🐦",
    component: FlappyBirdGame,
}
];