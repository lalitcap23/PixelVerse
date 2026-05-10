import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";
import { OutgoingMessage } from "./types";
import client from "@repo/db/client";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_PASSWORD } from "./config";

function getRandomString(length: number) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export class User {
    public id: string;
    public userId?: string;
    public username: string = "Anonymous";   // ← display name
    private spaceId?: string;
    public x: number;
    public y: number;
    private ws: WebSocket;

    constructor(ws: WebSocket) {
        this.id = getRandomString(10);
        this.x = 0;
        this.y = 0;
        this.ws = ws;
        this.initHandlers();
    }

    initHandlers() {
        this.ws.on("message", async (data) => {
            const parsedData = JSON.parse(data.toString());

            switch (parsedData.type) {

                // ── JOIN ─────────────────────────────────────────────────────
                case "join": {
                    const spaceId = parsedData.payload.spaceId;
                    const token   = parsedData.payload.token;

                    let decoded: JwtPayload;
                    try {
                        decoded = jwt.verify(token, JWT_PASSWORD) as JwtPayload;
                    } catch {
                        this.ws.close();
                        return;
                    }

                    const userId = decoded.userId;
                    if (!userId) { this.ws.close(); return; }

                    this.userId = userId;

                    // Fetch user record to get username
                    const userRecord = await client.user.findUnique({ where: { id: userId } });
                    if (userRecord) this.username = userRecord.username;

                    const space = await client.space.findFirst({ where: { id: spaceId } });
                    if (!space) { this.ws.close(); return; }

                    this.spaceId = spaceId;
                    RoomManager.getInstance().addUser(spaceId, this);
                    this.x = Math.floor(Math.random() * space.width);
                    this.y = Math.floor(Math.random() * space.height);

                    // Tell the joining user about the space + existing users
                    this.send({
                        type: "space-joined",
                        payload: {
                            spawn: { x: this.x, y: this.y },
                            userId: this.userId,
                            username: this.username,
                            users: RoomManager.getInstance().rooms.get(spaceId)
                                ?.filter(u => u.id !== this.id)
                                ?.map(u => ({
                                    userId:   u.userId,
                                    username: u.username,
                                    x: u.x,
                                    y: u.y,
                                })) ?? [],
                        },
                    });

                    // Tell everyone else a new user arrived
                    RoomManager.getInstance().broadcast({
                        type: "user-joined",
                        payload: {
                            userId:   this.userId,
                            username: this.username,
                            x: this.x,
                            y: this.y,
                        },
                    }, this, this.spaceId);
                    break;
                }

                // ── MOVE ─────────────────────────────────────────────────────
                case "move": {
                    const moveX = parsedData.payload.x;
                    const moveY = parsedData.payload.y;
                    const xDiff = Math.abs(this.x - moveX);
                    const yDiff = Math.abs(this.y - moveY);

                    if ((xDiff === 1 && yDiff === 0) || (xDiff === 0 && yDiff === 1)) {
                        this.x = moveX;
                        this.y = moveY;
                        RoomManager.getInstance().broadcast({
                            type: "movement",
                            payload: {
                                userId:   this.userId,
                                username: this.username,
                                x: this.x,
                                y: this.y,
                            },
                        }, this, this.spaceId!);
                        return;
                    }

                    this.send({
                        type: "movement-rejected",
                        payload: { x: this.x, y: this.y },
                    });
                    break;
                }

                // ── GLOBAL CHAT ───────────────────────────────────────────────
                case "chat": {
                    const message = (parsedData.payload.message as string)?.trim();
                    if (!message || message.length > 300) return;

                    // Broadcast to ALL in the room (including sender so they see it)
                    RoomManager.getInstance().broadcastToRoom({
                        type: "chat",
                        payload: {
                            userId:    this.userId,
                            username:  this.username,
                            message,
                            timestamp: Date.now(),
                        },
                    }, this.spaceId!);
                    break;
                }

                // ── PROXIMITY CHAT ────────────────────────────────────────────
                case "proximity-chat": {
                    const message = (parsedData.payload.message as string)?.trim();
                    if (!message || message.length > 300) return;

                    const PROX = 3;
                    const room = RoomManager.getInstance().rooms.get(this.spaceId!);
                    if (!room) return;

                    // Send only to users within PROX tiles + back to self
                    room.forEach(u => {
                        const dist = Math.abs(u.x - this.x) + Math.abs(u.y - this.y);
                        if (dist <= PROX || u.id === this.id) {
                            u.send({
                                type: "proximity-chat",
                                payload: {
                                    userId:    this.userId,
                                    username:  this.username,
                                    message,
                                    x:         this.x,
                                    y:         this.y,
                                    timestamp: Date.now(),
                                },
                            });
                        }
                    });
                    break;
                }
            }
        });
    }

    destroy() {
        RoomManager.getInstance().broadcast({
            type: "user-left",
            payload: { userId: this.userId },
        }, this, this.spaceId!);
        RoomManager.getInstance().removeUser(this, this.spaceId!);
    }

    send(payload: OutgoingMessage) {
        this.ws.send(JSON.stringify(payload));
    }
}