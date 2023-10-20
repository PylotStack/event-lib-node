import { localViewCache } from "../storage/local";
import { createView, compileDetailedViews, compileView, } from "./view";
import {
    ActionDefinition, ActionHandlerContext, ActionHandlerEnum, ActionHandlerResult,
    EventStackBuilder, EventStackDefinition, ESStack, LocalStore, ModelBuilder,
    ModelDefinition, ModelMapContext, ViewDefinition, Repository, BaseViewBuilder,
    BaseModel, RepositoryContext, QueryDefinition, BaseQueryBuilder, Executor,
} from "../types";
import { compileQuery, createQuery } from "./query";
import { createLocalModelRunner } from "./model";

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
                esDefinition: definition,
            } as ActionDefinition<U>;
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
            return modelDefinition;
        },
    } as EventStackBuilder);
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

const unsearchedEventSymbol = Symbol("unsearchedEventSymbol");
export async function executeAction(stack: ESStack, action: ActionDefinition, actionPayload: any): Promise<void> {
    let knownEventId: typeof unsearchedEventSymbol | number = unsearchedEventSymbol;

    const actionHandler = {
        [ActionHandlerEnum.REJECT]: (result: ActionHandlerResult) => {
            const err: any = new Error(`${result.action}: ${result.type}`);
            err.action = result.action;
            err.result = result.type;
            throw err;
        },
        [ActionHandlerEnum.COMMIT]: async (result: ActionHandlerResult) => {
            const payload = result.payloadOverride ?? actionPayload;
            const newEventId = knownEventId !== unsearchedEventSymbol ? knownEventId + 1 : null;
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
        const viewResults = await compileDetailedViews(stack, definitions, knownEventId !== unsearchedEventSymbol ? knownEventId + 1 : undefined);
        knownEventId = viewResults.lastEventId ?? 0;
        return viewResults.view;
    }

    async function view<T>(definition: ViewDefinition<T>): Promise<T> {
        return await views<T>([definition]);
    }

    async function query<T, U>(definition: QueryDefinition<T, U>, parameters: U): Promise<T> {
        const queryResult = await compileQuery(stack, definition, parameters, knownEventId !== unsearchedEventSymbol ? knownEventId + 1 : undefined);
        knownEventId = queryResult.lastEventId ?? 0;
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

    async function findOrCreateModel<T, ActionKeywords extends string>(id: string, model: ModelDefinition<T, ActionKeywords>): Promise<T & BaseModel<T> | undefined> {
        const stack = await store.getOrCreateStack(model.esDefinition.type, id);
        const runner = createLocalModelRunner(model);
        const modelInstance = await runner.fromStack(stack, context);
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

export const defaultExecutor: (() => Executor) = () => ({
    executeAction,
    compileView,
    compileQuery,
});
