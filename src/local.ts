import * as _ from "lodash";
import { CompiledView, ESEvent, ESStack, LocalStore, ViewCache, ViewDefinition } from "./types";

export function localStack(namespace: string): ESStack {
    const events: ESEvent[] = [];

    async function commitEvent(ev: ESEvent) {
        const lastEvent = _.last(events);
        if (ev.id === 0 && lastEvent) throw new Error(`Unable to commit event with id: ${ev.id}. Events already exist.`);
        if (ev.id !== 0 && ev.id !== lastEvent.id + 1) throw new Error(`Unable to commit event with id: ${ev.id}. Invalid sequence`);
        events.push(ev);
    }

    async function commitAnonymousEvent(ev: ESEvent) {
        const lastEvent = _.last(events);
        ev.id = (lastEvent?.id ?? -1) + 1;
        events.push(ev);
    }

    async function getEvent(id: number) {
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

export function localStore(): LocalStore {
    const stacks = new Map<string, ESStack>();

    async function getStack(name: string): Promise<ESStack> {
        return stacks.get(name);
    }

    async function createStack(name: string): Promise<ESStack> {
        const stack = localStack(name);
        stacks.set(name, stack);
        return stack;
    }

    async function getOrCreateStack(name: string): Promise<ESStack> {
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

export function localViewCache(): ViewCache {
    let viewCache: Record<string, CompiledView> = {};

    async function getFromCache(identifier: string): Promise<CompiledView> {
        return viewCache[identifier];
    }

    async function updateCache(identifier: string, compiledView: CompiledView) {
        viewCache[identifier] = compiledView;
    }

    return {
        getFromCache,
        updateCache,
    };
}
