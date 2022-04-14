import { uniq } from "./utils";
import { localViewCache } from "./local";
import {
    ActionDefinition, ActionHandlerContext, ActionHandlerEnum, ActionHandlerResult, DetailedView,
    ESEvent, EventStackBuilder, EventStackDefinition, ESStack, LocalStore, MapView, ModelBuilder,
    ModelDefinition, ModelMapContext, ViewBuilder, ViewDefinition, Repository, BaseViewBuilder,
    BaseModel, RepositoryContext, QueryBuilder, QueryDefinition, BaseQueryBuilder, ViewEventBuilderHandler, MapQuery,
} from "./types";


//////

function createQuery<T = any, ParameterType = any>(type: string, esDefinition: EventStackDefinition, defaultObj?: T): QueryBuilder<T, undefined, ParameterType> {
    const self = {} as QueryBuilder<T, undefined, ParameterType>;
    const definition: QueryDefinition<T, ParameterType> = {
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
            return self as QueryBuilder<T & U, undefined, ParameterType>;
        }
    } as QueryBuilder<T, undefined, ParameterType>);
}

export async function compileQuery<T = null, U = null>(stack: ESStack, query: QueryDefinition<T, U>, parameters: U, maxEventId?: number, context?: RepositoryContext): Promise<DetailedView<T>> {
    const mappedEvents = Object.fromEntries(Object.entries(query.events).map(([type, event]) => {
        return [type, {
            type,
            handler: (state: T, ev: ESEvent) => event.handler(state, ev, parameters) as ViewEventBuilderHandler<T>
        }];
    }));
    const viewDefinition: ViewDefinition<T> = {
        ...query,
        events: mappedEvents,
    }
    return (await compileDetailedViews(stack, [viewDefinition], maxEventId, context));
}

//////

function createView<T = any>(type: string, esDefinition: EventStackDefinition, defaultObj?: T): ViewBuilder<T> {
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

function createModelBuilder<T, ActionKeywords extends string>(definition: ModelDefinition<T, ActionKeywords>): ModelBuilder<T, ActionKeywords> {
    return {
        definition,
        fromStack: async (stack: ESStack, context?: RepositoryContext) => {
            const model: T & BaseModel<T> = {} as T & BaseModel<T>;
            const mapViewMemory = {};

            async function processModel() {
                const keysToUpdate = Object.entries(rawModelDefinition).map(([key, value]) => {
                    if (!mapViewMemory[value]) return;
                    return [key, mapViewMemory[value]];
                }).filter(Boolean);
                const viewsToPull = uniq(keysToUpdate.map(([key, value]) => value.viewDefinition));
                const viewResults = await Promise.all(viewsToPull.map(async (view) => [view, await compileView(stack, view, context)]));
                const viewMap = new Map<any, any>(viewResults as Array<[any, any]>);
                keysToUpdate.forEach(function updateValues([key, value]) {
                    const viewResult = viewMap.get(value.viewDefinition);
                    if (!value.transformer) {
                        model[key] = viewResult;
                        return;
                    }
                    if (typeof value.transformer === "string") {
                        model[key] = viewResult?.[value.transformer];
                        return;
                    }
                    model[key] = value.transformer(viewResult);
                });
            }

            const mapView: MapView = (<T>(viewDefinition: ViewDefinition<T>, transformer?: any) => {
                const symbol = Symbol();
                mapViewMemory[symbol] = {
                    viewDefinition,
                    transformer
                };
                return symbol;
            }) as MapView;

            const mapQuery: MapQuery = <T, U>(queryDefinition: QueryDefinition<T, U>, handler) => {
                return async function _invokeQuery(...args) {
                    const parameters = handler(...args as any);
                    return (await compileQuery(stack, queryDefinition, parameters, undefined, context)).view;
                };
            };

            const ctx: ModelMapContext = {
                mapAction: (actionType: string, handler) => {
                    return async function _invokeAction(...args) {
                        const payload = handler(...args as any);
                        await executeAction(stack, definition.esDefinition.actions[actionType], payload);
                        await processModel();
                    };
                },
                mapView,
                mapQuery,
            };

            const baseModel: BaseModel<T> = {
                _refresh: async () => {
                    await processModel();
                    return model;
                },
            };

            var rawModelDefinition = definition.modelMapper(ctx);
            Object.assign(model, rawModelDefinition, baseModel);
            await processModel();
            return model;
        },
    }
}

export function defineEventStack(type: string): EventStackBuilder<{}, null> {
    const self = {} as EventStackBuilder<{}, null>;
    const definition: EventStackDefinition = {
        type,
        actions: {},
        views: {},
        queries: {},
    };
    return Object.assign(self, {
        definition: definition,
        action: <U extends string>(type: U, handler) => {
            definition.actions[type as string] = {
                type,
                handler,
            };
            return self as EventStackBuilder;
        },
        createView: <T>(type: string, defaultObj?: T) => {
            const view = createView<T>(type, definition, defaultObj);
            definition.views[type] = view.definition;
            return view;
        },
        createQuery: <T = any, ParameterType = any>(type: string, defaultObj?: T) => {
            const query = createQuery<T, ParameterType>(type, definition, defaultObj);
            definition.queries[type] = query.definition;
            return query;
        },
        mapModel: <T>(mapper: (ctx: ModelMapContext) => T) => {
            const modelDefinition: ModelDefinition<T, null> = {
                esDefinition: definition,
                modelMapper: mapper,
            };
            return createModelBuilder(modelDefinition);
        },
    } as EventStackBuilder);
}

function compileAllViews(views: ViewDefinition[]) {
    return views.map((x) => [...compileAllViews(x.baseViews), x]).flat();
}

function compileViewName(views: ViewDefinition[]) {
    return views.map((view) => `${view.type}${view.baseViews.length ? `<${compileViewName(view.baseViews)}>` : ""}`).join("|");
}

async function compileDetailedViews(stack: ESStack, views: ViewDefinition[], maxEventId?: number, context?: RepositoryContext): Promise<DetailedView<any>> {
    let lastEventId: number | null = null;
    let lastImpactedId: number | null = null;

    const allViews = compileAllViews(views);
    const viewName = `${stack.namespace}<${compileViewName(allViews)}>`;

    const baseDefault = allViews.reduce((acc, view) => ({ ...acc, ...(view.default ?? {}) }), {});
    const cachedView = (await context?.viewCache?.getFromCache(viewName)) ?? {
        eventId: -1,
        view: baseDefault,
    };

    const events = await stack.slice(cachedView.eventId + 1, maxEventId);

    const result = events.reduce(function processEvent(acc, event) {
        lastEventId = event.id;
        return allViews.reduce(function processEventForView(acc, view) {
            const matchingHandler = view.events[event.type];
            if (!matchingHandler) return acc;
            lastImpactedId = event.id;
            const result = matchingHandler.handler(acc, event);
            return result;
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

const baseContext = {
    reject: (type: string) => {
        return {
            action: ActionHandlerEnum.REJECT,
            type,
        };
    },
    commit: (payloadOverride?: any) => {
        return {
            action: ActionHandlerEnum.COMMIT,
            type: ActionHandlerEnum.COMMIT,
            payloadOverride,
        };
    }
};

export async function executeAction(stack: ESStack, action: ActionDefinition, actionPayload: any): Promise<void> {
    let knownEventId = undefined;

    const actionHandler = {
        [ActionHandlerEnum.REJECT]: (result: ActionHandlerResult) => {
            const err: any = new Error(`${result.action}: ${result.type}`);
            err.action = result.action;
            err.result = result.type;
            throw err;
        },
        [ActionHandlerEnum.COMMIT]: async (result: ActionHandlerResult) => {
            const payload = result.payloadOverride ?? actionPayload;
            const newEventId = knownEventId ? knownEventId + 1 : null;
            const commitMethod = newEventId ? stack.commitEvent : stack.commitAnonymousEvent;
            await commitMethod({
                id: newEventId ?? 0,
                metadata: {
                    timestamp: (new Date()).toISOString(),
                },
                payload,
                type: action.type,
            });
        },
    };

    async function views<T>(definitions: ViewDefinition[]): Promise<T> {
        const viewResults = await compileDetailedViews(stack, definitions, knownEventId ? knownEventId + 1 : undefined);
        knownEventId = viewResults.lastEventId;
        return viewResults.view;
    }

    async function view<T>(definition: ViewDefinition<T>): Promise<T> {
        return await views<T>([definition]);
    }

    async function query<T, U>(definition: QueryDefinition<T, U>, parameters: U): Promise<T> {
        const queryResult = await compileQuery(stack, definition, parameters, knownEventId ? knownEventId + 1 : undefined);
        knownEventId = queryResult.lastEventId;
        return queryResult.view;
    }

    const context: ActionHandlerContext = {
        ...baseContext,
        views,
        view,
        query,
    };

    const result = await action.handler(context, actionPayload);
    const handler = actionHandler[result.action];
    if (!handler) throw new Error(`Unable to find action handler for result type: ${result.action} -> ${result.type} `);
    await handler(result);
}

export function esRepository(store: LocalStore, context?: RepositoryContext): Repository {
    context = context ?? {
        viewCache: localViewCache(),
    };

    async function findOrCreateModel<T, ActionKeywords extends string>(id: string, model: ModelBuilder<T, ActionKeywords>): Promise<T & BaseModel<T> | undefined> {
        const stack = await store.getOrCreateStack(model.definition.esDefinition.type, id);
        const modelInstance = await model.fromStack(stack, context);
        return modelInstance;
    }

    async function findOrCreateView<T>(id: string, view: BaseViewBuilder<T>): Promise<T | undefined> {
        const stack = await store.getOrCreateStack(view.definition.esDefinition.type, id);
        const modelInstance = await compileView(stack, view.definition, context);
        return modelInstance;
    }

    async function findOrCreateQuery<T, U>(id: string, query: BaseQueryBuilder<T, U>, parameters: U): Promise<T | undefined> {
        const stack = await store.getOrCreateStack(query.definition.esDefinition.type, id);
        const modelInstance = (await compileQuery(stack, query.definition, parameters, undefined, context)).view;
        return modelInstance;
    }

    return {
        findOrCreateModel,
        findOrCreateView,
        findOrCreateQuery,
    };
}