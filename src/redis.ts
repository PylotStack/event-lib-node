import { Redis } from "ioredis";
import { CompiledView, ViewCache } from "./types";

export interface RedisViewCacheOptions {
    redis: Redis;
}

export function redisViewCache(options: RedisViewCacheOptions): ViewCache {
    async function getFromCache(identifier: string): Promise<CompiledView> {
        const res = await options.redis.hgetall(identifier);
        if (!res || !res.view) return;
        return JSON.parse(res.view) as CompiledView;
    }

    async function updateCache(identifier: string, compiledView: CompiledView) {
        const res = await options.redis.hmset(identifier, "eventId", compiledView.eventId, "view", JSON.stringify(compiledView));
    }

    return {
        getFromCache,
        updateCache,
    };
}
