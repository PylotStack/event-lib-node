"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localViewCache = exports.localStore = exports.localStack = void 0;
const _ = require("lodash");
function localStack() {
    const events = [];
    async function commitEvent(ev) {
        const lastEvent = _.last(events);
        if (ev.id === 0 && lastEvent)
            throw new Error(`Unable to commit event with id: ${ev.id}. Events already exist.`);
        if (ev.id !== 0 && ev.id !== lastEvent.id + 1)
            throw new Error(`Unable to commit event with id: ${ev.id}. Invalid sequence`);
        events.push(ev);
    }
    async function commitAnonymousEvent(ev) {
        var _a;
        const lastEvent = _.last(events);
        ev.id = ((_a = lastEvent === null || lastEvent === void 0 ? void 0 : lastEvent.id) !== null && _a !== void 0 ? _a : -1) + 1;
        events.push(ev);
    }
    async function getEvent(id) {
        return events[id];
    }
    async function slice(...args) {
        return events.slice(...args);
    }
    return {
        commitEvent,
        commitAnonymousEvent,
        getEvent,
        slice,
    };
}
exports.localStack = localStack;
function localStore() {
    const stacks = new Map();
    async function getStack(name) {
        return stacks.get(name);
    }
    async function createStack(name) {
        const stack = localStack();
        stacks.set(name, stack);
        return stack;
    }
    async function getOrCreateStack(name) {
        const existingStack = await getStack(name);
        return existingStack
            ? existingStack
            : await createStack(name);
    }
    return {
        getStack,
        createStack,
        getOrCreateStack,
    };
}
exports.localStore = localStore;
function localViewCache() {
    let viewCache = {};
    async function getFromCache(identifier) {
        return viewCache[identifier];
    }
    async function updateCache(identifier, compiledView) {
        viewCache[identifier] = compiledView;
    }
    return {
        getFromCache,
        updateCache,
    };
}
exports.localViewCache = localViewCache;
//# sourceMappingURL=local.js.map