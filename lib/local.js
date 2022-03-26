"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localViewCache = exports.localStore = exports.localStack = void 0;
const _ = require("lodash");
function localStack(namespace) {
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
        namespace,
        commitEvent,
        commitAnonymousEvent,
        getEvent,
        slice,
    };
}
exports.localStack = localStack;
function localStore() {
    const stacks = new Map();
    function name(stackSet, stack) {
        return `${stackSet}|${stack}`;
    }
    async function getStack(stackSet, stackName) {
        return stacks.get(name(stackSet, stackName));
    }
    async function createStack(stackSet, stackName) {
        const _name = name(stackSet, stackName);
        const stack = localStack(_name);
        stacks.set(_name, stack);
        return stack;
    }
    async function getOrCreateStack(stackSet, stackName) {
        const existingStack = await getStack(stackSet, stackName);
        return existingStack
            ? existingStack
            : await createStack(stackSet, stackName);
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