import type { User } from "./User";
import { OutgoingMessage } from "./types";
import { RedisManager } from "./RedisManager";

export class RoomManager {
    rooms: Map<string, User[]> = new Map();
    static instance: RoomManager;
    private subscribedRooms: Set<string> = new Set();

    private constructor() {
        this.rooms = new Map();
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new RoomManager();
        }
        return this.instance;
    }

    public removeUser(user: User, spaceId: string) {
        if (!this.rooms.has(spaceId)) {
            return;
        }
        this.rooms.set(spaceId, (this.rooms.get(spaceId)?.filter((u) => u.id !== user.id) ?? []));

        if (this.rooms.get(spaceId)?.length === 0) {
            this.subscribedRooms.delete(spaceId);
            RedisManager.getInstance().unsubscribe(`room:${spaceId}`);
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
