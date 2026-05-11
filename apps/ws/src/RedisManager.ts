import { Redis } from "ioredis";
import { REDIS_URL } from "./config";

type MessageCallback = (channel: string, message: string) => void;

export class RedisManager {
    private static instance: RedisManager;
    private publisher: Redis;
    private subscriber: Redis;
    private callbacks: Map<string, MessageCallback[]> = new Map();

    private constructor() {
        this.publisher = new Redis(REDIS_URL);
        this.subscriber = new Redis(REDIS_URL);

        this.subscriber.on("message", (channel, message) => {
            const cbs = this.callbacks.get(channel);
            cbs?.forEach((cb) => cb(channel, message));
        });
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new RedisManager();
        }
        return this.instance;
    }

    publish(channel: string, message: string) {
        this.publisher.publish(channel, message);
    }

    subscribe(channel: string, callback: MessageCallback) {
        if (!this.callbacks.has(channel)) {
            this.callbacks.set(channel, []);
            this.subscriber.subscribe(channel);
        }
        this.callbacks.get(channel)!.push(callback);
    }

    unsubscribe(channel: string) {
        this.subscriber.unsubscribe(channel);
        this.callbacks.delete(channel);
    }
}
