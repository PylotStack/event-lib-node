import { last } from "../utils";
import { CompiledView, ESEvent, ESStack, LocalStore, ViewCache, ViewDefinition } from "../types";
import * as fs from "node:fs";
import { InvalidSequenceError } from "./shared";

export interface NaiveFSStackOptions {
    directory: string;
}

export function naiveFsStack(namespace: string, options: NaiveFSStackOptions): ESStack {
    const filename = `${options.directory}/${namespace}.json`;

    async function _getEvents() {
        const fileContents = await fs.promises.readFile(filename, { encoding: "utf-8" }).catch((err) => {
            if (err.code === "ENOENT") return "";
            throw err;
        });
        const events = fileContents.split("\n").filter(Boolean).map((x) => JSON.parse(x));
        return events;
    }

    async function commitEvent(ev: ESEvent) {
        if (ev.id < 1) throw new Error(`Unable to commit event with id: ${ev.id}. Invalid id`);
        const events = await _getEvents();
        const lastEvent = last(events);
        if (ev.id === 1 && lastEvent) throw new Error(`Unable to commit event with id: ${ev.id}. Events already exist.`);
        if (ev.id !== 1 && ev.id !== lastEvent.id + 1) throw new InvalidSequenceError(`Unable to commit event with id: ${ev.id}. Invalid sequence`);
        const serializedEvent = JSON.stringify(ev);
        await fs.promises.appendFile(filename, `${serializedEvent}\n`, {
            encoding: "utf-8",
        });
    }

    async function commitAnonymousEvent(ev: ESEvent) {
        const events = await _getEvents();
        const lastEvent = last(events);
        ev.id = (lastEvent?.id ?? 0) + 1;
        const serializedEvent = JSON.stringify(ev);
        await fs.promises.appendFile(filename, `${serializedEvent}\n`);
    }

    async function getEvent(id: number) {
        const events = await _getEvents();
        return events.find((x) => x.id === id);
    }

    async function slice(start: number, end: number) {
        start = Number.isSafeInteger(start) ? start - 1 : undefined;
        end = Number.isSafeInteger(end) ? end - 1 : undefined;
        const events = await _getEvents();
        return events.slice(start, end);
    }

    return {
        namespace,
        commitEvent,
        commitAnonymousEvent,
        getEvent,
        slice,
    };
}

export function fsStore(options: NaiveFSStackOptions): LocalStore {
    const stacks = new Map<string, ESStack>();

    function name(stackSet: string, stack: string) {
        return `${stackSet}|${stack}`;
    }

    async function getStack(stackSet: string, stackName: string): Promise<ESStack> {
        return stacks.get(name(stackSet, stackName));
    }

    async function createStack(stackSet: string, stackName: string): Promise<ESStack> {
        const _name = name(stackSet, stackName);
        const stack = naiveFsStack(_name, options);
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

export function fsViewCache(): ViewCache {
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
