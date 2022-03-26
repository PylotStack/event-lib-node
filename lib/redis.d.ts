import { Redis } from "ioredis";
import { ViewCache } from "./types";
export interface RedisViewCacheOptions {
    redis: Redis;
}
export declare function redisViewCache(options: RedisViewCacheOptions): ViewCache;
