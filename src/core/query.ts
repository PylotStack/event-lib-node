import {
    DetailedView, ESEvent, ESStack, EventStackDefinition, QueryBuilder, QueryDefinition,
    RepositoryContext, ViewDefinition, ViewEventBuilderHandler
} from "../types";
import { compileDetailedViews } from "./view";

export function createQuery<T = any, ParameterType = any>(type: string, esDefinition: EventStackDefinition, defaultObj?: T): QueryBuilder<T, undefined, ParameterType> {
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
    const mappedFinalizer = query.finalizer ? (state: T) => query.finalizer(state, parameters) : undefined;
    const viewDefinition: ViewDefinition<T> = {
        ...query,
        events: mappedEvents,
        finalizer: mappedFinalizer,
    }
    return (await compileDetailedViews(stack, [viewDefinition], maxEventId, context));
}
