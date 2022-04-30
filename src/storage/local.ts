import { last } from "../utils";
import { CompiledView, ESEvent, ESStack, LocalStore, ViewCache, ViewDefinition } from "../types";

export function localStack(namespace: string): ESStack {
    const events: ESEvent[] = [];

    async function commitEvent(ev: ESEvent) {
        const lastEvent = last(events);
        if (ev.id === 0 && lastEvent) throw new Error(`Unable to commit event with id: ${ev.id}. Events already exist.`);
        if (ev.id !== 0 && ev.id !== lastEvent.id + 1) throw new Error(`Unable to commit event with id: ${ev.id}. Invalid sequence`);
        events.push(ev);
    }

    async function commitAnonymousEvent(ev: ESEvent) {
        const lastEvent = last(events);
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

    function name(stackSet: string, stack: string) {
        return `${stackSet}|${stack}`;
    }

    async function getStack(stackSet: string, stackName: string): Promise<ESStack> {
        return stacks.get(name(stackSet, stackName));
    }

    async function createStack(stackSet: string, stackName: string): Promise<ESStack> {
        const _name = name(stackSet, stackName);
        const stack = localStack(_name);
        stacks.set(_name, stack);
        return stack;
    }

    async function getOrCreateStack(stackSet: string, stackName: string): Promise<ESStack> {
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
