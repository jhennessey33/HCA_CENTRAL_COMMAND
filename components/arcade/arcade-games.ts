import PinkThemeSnake from "./snake-game";
import FlappyBirdGame from "./flappy-bird-game";
import CrossyCubicle from "@/components/arcade/CrossyCubicle";
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
    },

    {
        id: "crossy-cubicle",
        name: "Crossy Cubicle",
        description: "Cross the road, dodge traffic, and climb the leaderboard.",
        icon: "🚸",
        component: CrossyCubicle,
    },
];