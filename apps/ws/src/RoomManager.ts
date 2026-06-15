import type { User } from "./User";
import { OutgoingMessage } from "./types";
import { RedisManager } from "./RedisManager";

type TttSymbol = "X" | "O";
type TttWinner = TttSymbol | "draw" | null;

type TttPlayer = {
    userId: string;
    username: string;
};

type TttGameState = {
    board: Array<TttSymbol | null>;
    turn: TttSymbol;
    players: {
        X: TttPlayer | null;
        O: TttPlayer | null;
    };
};

const createEmptyBoard = (): Array<TttSymbol | null> => Array(9).fill(null);

const checkTttWinner = (board: Array<TttSymbol | null>): TttWinner => {
    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            return board[a];
        }
    }

    return board.every(Boolean) ? "draw" : null;
};

export class RoomManager {
    rooms: Map<string, User[]> = new Map();
    static instance: RoomManager;
    private subscribedRooms: Set<string> = new Set();
    private tttGames: Map<string, TttGameState> = new Map();

    private constructor() {
        this.rooms = new Map();
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new RoomManager();
        }
        return this.instance;
    }

    private createEmptyTttGame(): TttGameState {
        return {
            board: createEmptyBoard(),
            turn: "X",
            players: {
                X: null,
                O: null,
            },
        };
    }

    private getOrCreateTttGame(roomId: string) {
        let game = this.tttGames.get(roomId);
        if (!game) {
            game = this.createEmptyTttGame();
            this.tttGames.set(roomId, game);
        }
        return game;
    }

    private getTttSymbol(game: TttGameState, userId: string): TttSymbol | null {
        if (game.players.X?.userId === userId) {
            return "X";
        }
        if (game.players.O?.userId === userId) {
            return "O";
        }
        return null;
    }

    private resetTttBoard(game: TttGameState) {
        game.board = createEmptyBoard();
        game.turn = "X";
    }

    private createTttStateMessage(roomId: string): OutgoingMessage {
        const game = this.getOrCreateTttGame(roomId);
        return {
            type: "ttt_state",
            payload: {
                board: game.board,
                turn: game.turn,
                players: game.players,
                winner: checkTttWinner(game.board),
            },
        };
    }

    private broadcastTttState(roomId: string) {
        this.broadcastToRoom(this.createTttStateMessage(roomId), roomId);
    }

    public removeUser(user: User, spaceId: string) {
        if (!this.rooms.has(spaceId)) {
            return;
        }
        this.rooms.set(spaceId, (this.rooms.get(spaceId)?.filter((u) => u.id !== user.id) ?? []));

        if (this.rooms.get(spaceId)?.length === 0) {
            this.tttGames.delete(spaceId);
            this.subscribedRooms.delete(spaceId);
            RedisManager.getInstance().unsubscribe(`room:${spaceId}`);
            return;
        }

        if (user.userId) {
            this.leaveTtt(spaceId, user.userId);
        }
    }

    public addUser(spaceId: string, user: User) {
        if (!this.rooms.has(spaceId)) {
            this.rooms.set(spaceId, [user]);
            if (!this.subscribedRooms.has(spaceId)) {
                this.subscribedRooms.add(spaceId);
                RedisManager.getInstance().subscribe(`room:${spaceId}`, (_channel, message) => {
                    this.handleRedisMessage(spaceId, message);
                });
            }
            return;
        }
        this.rooms.set(spaceId, [...(this.rooms.get(spaceId) ?? []), user]);
    }

    public joinTtt(roomId: string, user: User) {
        if (!user.userId) {
            return;
        }

        const game = this.getOrCreateTttGame(roomId);
        const existingSymbol = this.getTttSymbol(game, user.userId);
        if (existingSymbol) {
            user.send(this.createTttStateMessage(roomId));
            return;
        }

        if (!game.players.X) {
            game.players.X = { userId: user.userId, username: user.username };
            this.resetTttBoard(game);
            this.broadcastTttState(roomId);
            return;
        }

        if (!game.players.O) {
            game.players.O = { userId: user.userId, username: user.username };
            this.resetTttBoard(game);
            this.broadcastTttState(roomId);
            return;
        }

        user.send({
            type: "ttt_error",
            payload: { message: "Two players are already playing Tic-Tac-Toe." },
        });
        user.send(this.createTttStateMessage(roomId));
    }

    public leaveTtt(roomId: string, userId: string) {
        const game = this.tttGames.get(roomId);
        if (!game) {
            return;
        }

        let changed = false;
        if (game.players.X?.userId === userId) {
            game.players.X = null;
            changed = true;
        }
        if (game.players.O?.userId === userId) {
            game.players.O = null;
            changed = true;
        }

        if (!changed) {
            return;
        }

        this.resetTttBoard(game);
        this.broadcastTttState(roomId);
    }

    public moveTtt(roomId: string, userId: string, cell: number, user: User) {
        const game = this.tttGames.get(roomId);
        if (!game) {
            user.send({
                type: "ttt_error",
                payload: { message: "Join Tic-Tac-Toe first." },
            });
            return;
        }

        const symbol = this.getTttSymbol(game, userId);
        if (!symbol) {
            user.send({
                type: "ttt_error",
                payload: { message: "You are not in the current Tic-Tac-Toe match." },
            });
            return;
        }

        if (cell < 0 || cell > 8 || !Number.isInteger(cell)) {
            return;
        }

        if (checkTttWinner(game.board)) {
            return;
        }

        if (game.turn !== symbol) {
            user.send({
                type: "ttt_error",
                payload: { message: "Wait for your turn." },
            });
            return;
        }

        if (game.board[cell]) {
            user.send({
                type: "ttt_error",
                payload: { message: "That tile is already taken." },
            });
            return;
        }

        game.board[cell] = symbol;
        if (!checkTttWinner(game.board)) {
            game.turn = symbol === "X" ? "O" : "X";
        }

        this.broadcastTttState(roomId);
    }

    public resetTtt(roomId: string, userId: string, user: User) {
        const game = this.tttGames.get(roomId);
        if (!game) {
            return;
        }

        if (!this.getTttSymbol(game, userId)) {
            user.send({
                type: "ttt_error",
                payload: { message: "Only active players can reset the board." },
            });
            return;
        }

        this.resetTttBoard(game);
        this.broadcastTttState(roomId);
    }

    public broadcast(message: OutgoingMessage, user: User, roomId: string) {
        RedisManager.getInstance().publish(`room:${roomId}`, JSON.stringify(message));

        if (!this.rooms.has(roomId)) {
            return;
        }
        this.rooms.get(roomId)?.forEach((u) => {
            if (u.id !== user.id) {
                u.send(message);
            }
        });
    }

    public broadcastToRoom(message: OutgoingMessage, roomId: string) {
        if (!this.rooms.has(roomId)) {
            return;
        }
        this.rooms.get(roomId)?.forEach((u) => {
            u.send(message);
        });
    }

    private handleRedisMessage(roomId: string, message: string) {
        try {
            const parsed: OutgoingMessage = JSON.parse(message);
            this.broadcastToRoom(parsed, roomId);
        } catch {
            console.error("Failed to parse Redis message");
        }
    }
}
