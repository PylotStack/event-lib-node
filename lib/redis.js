"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisViewCache = void 0;
function redisViewCache(options) {
    async function getFromCache(identifier) {
        const res = await options.redis.hgetall(identifier);
        if (!res || !res.view)
            return;
        return JSON.parse(res.view);
    }
    async function updateCache(identifier, compiledView) {
        const res = await options.redis.hmset(identifier, "eventId", compiledView.eventId, "view", JSON.stringify(compiledView));
    }
    return {
        getFromCache,
        updateCache,
    };
}
exports.redisViewCache = redisViewCache;
//# sourceMappingURL=redis.js.map