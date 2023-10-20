import { DetailedView, ESStack, EventStackDefinition, RepositoryContext, ViewBuilder, ViewDefinition } from "../types";

export function createView<T = any>(type: string, esDefinition: EventStackDefinition, defaultObj?: T): ViewBuilder<T> {
    const self = {} as ViewBuilder<T>;
    const definition: ViewDefinition<T> = {
        type,
        esDefinition,
        default: defaultObj,
        baseViews: [],
        events: {},
        finalizer: undefined,
    };
    return Object.assign(self, {
        definition,
        event: (type: string, handler) => {
            definition.events[type] = {
                type,
                handler,
            };
            return self;
        },
        finalizer: (handler) => {
            definition.finalizer = handler;
            return self;
        },
        withView: <U>(otherDefinition: ViewDefinition<U>) => {
            definition.baseViews.push(otherDefinition);
            return self as ViewBuilder<T & U>;
        }
    } as ViewBuilder<T>);
}

export function compileAllViews(views: ViewDefinition[]) {
    return views.map((x) => [...compileAllViews(x.baseViews), x]).flat();
}

export function compileViewName(views: ViewDefinition[]) {
    return views.map((view) => `${view.type}${view.baseViews.length ? `<${compileViewName(view.baseViews)}>` : ""}`).join("|");
}

export async function compileDetailedViews(stack: ESStack, views: ViewDefinition[], maxEventId?: number, context?: RepositoryContext): Promise<DetailedView<any>> {
    let lastEventId: number | null = null;
    let lastImpactedId: number | null = null;

    const allViews = compileAllViews(views);
    const viewName = `${stack.namespace}<${compileViewName(allViews)}>`;

    const baseDefault = allViews.reduce((acc, view) => ({ ...acc, ...(view.default ?? {}) }), {});
    const cachedView = (await context?.viewCache?.getFromCache(viewName)) ?? {
        eventId: 0,
        view: baseDefault,
    };

    const events = await stack.slice(cachedView.eventId + 1, maxEventId);

    const result = events.reduce(function processEvent(acc, event) {
        lastEventId = event.id;
        return allViews.reduce(function processEventForView(acc, view) {
            function doThing() {
                const matchingHandler = view.events[event.type];
                if (!matchingHandler) return acc;
                lastImpactedId = event.id;
                const result = matchingHandler.handler(acc, event);
                return result;
            }

            const output = doThing();

            return output;
        }, acc);
    }, cachedView.view);

    if (lastEventId) await context?.viewCache?.updateCache(viewName, {
        eventId: lastEventId,
        view: result,
    });

    const finalizedResult = allViews.reduce(function runFinalizer(acc, view) {
        if (!view.finalizer) return acc;
        return view.finalizer(acc);
    }, result);

    return {
        view: finalizedResult,
        lastEventId,
        lastImpactedId,
    };
}

export async function compileView<T = null>(stack: ESStack, view: ViewDefinition<T>, context?: RepositoryContext): Promise<T> {
    return (await compileDetailedViews(stack, [view], undefined, context)).view;
}
