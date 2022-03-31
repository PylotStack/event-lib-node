export interface ESEvent<Payload = Record<string, any>> {
    id: number;
    type: string;
    metadata: Record<string, any>;
    payload: Payload;
}

export interface ESStack {
    namespace: string;
    commitEvent: (ev: ESEvent) => Promise<void>;
    commitAnonymousEvent: (ev: ESEvent) => Promise<void>;
    getEvent: (id: number) => Promise<ESEvent<Record<string, any>>>;
    slice: (...args: any[]) => Promise<ESEvent<Record<string, any>>[]>;
}

export interface LocalStore {
    getStack: (stackSet: string, stack: string) => Promise<ESStack>;
    createStack: (stackSet: string, stack: string) => Promise<ESStack>;
    getOrCreateStack: (stackSet: string, stack: string) => Promise<ESStack>;
};

export enum ActionHandlerEnum {
    COMMIT = "COMMIT",
    REJECT = "REJECT",
};

export interface ActionHandlerResult {
    action: ActionHandlerEnum;
    type: string;
    payloadOverride?: any;
}

export interface ActionHandlerContext {
    reject: (type: string) => ActionHandlerResult;
    commit: (payloadOverride?: any) => ActionHandlerResult;
    view: <T>(view: ViewDefinition<T>) => Promise<T>;
    views: <T>(views: ViewDefinition[]) => Promise<T>;
}

export interface DetailedView<T> {
    view: T;
    lastEventId: number | null;
    lastImpactedId: number | null;
}

//////// 

export type QueryEventBuilderHandler<QueryType = any, ParameterType = any> = (state: QueryType, ev: ESEvent, parameters: ParameterType) => any;


export interface QueryEventBuilderDefinition<QueryType = any, ParameterType = any> {
    type: string;
    handler: QueryEventBuilderHandler<QueryType, ParameterType>;
}

export interface QueryDefinition<QueryType = any, ParameterType = any> {
    esDefinition: EventStackDefinition;
    type: string;
    default: QueryType;
    events: Record<string, QueryEventBuilderDefinition<QueryType, ParameterType>>;
    baseViews: ViewDefinition[];
    finalizer: ViewFinalizerHandler<QueryType>;
}


export interface BaseQueryBuilder<T = any, U = any> {
    definition: QueryDefinition<T, U>;
}
export interface PostEventQueryBuilder<T = any, U extends string = null, V = any> extends BaseQueryBuilder<T, V> {
    definition: QueryDefinition<T, V>;
    event: (type: U, handler: QueryEventBuilderHandler<T, V>) => PostEventQueryBuilder<T, U, V>;
    finalizer: (handler: ViewFinalizerHandler<T>) => BaseQueryBuilder<T>;
}

export interface QueryBuilder<T = any, U extends string = null, W = any> extends PostEventQueryBuilder<T, U, W> {
    withView: <V>(viewDefinition: ViewDefinition<V>) => QueryBuilder<T & V, U, W>;
}


/////

export interface ViewEventBuilderDefinition<ViewType = any> {
    type: string;
    handler: ViewEventBuilderHandler<ViewType>;
}

export interface ViewDefinition<ViewType = any> {
    esDefinition: EventStackDefinition;
    type: string;
    default: ViewType;
    events: Record<string, ViewEventBuilderDefinition<ViewType>>;
    baseViews: ViewDefinition[];
    finalizer: ViewFinalizerHandler<ViewType>;
}

export type ActionHandler = (context: ActionHandlerContext, payload: any) => ActionHandlerResult;
export type AsyncActionHandler = (context: ActionHandlerContext, payload: any) => Promise<ActionHandlerResult>;

export type ViewEventBuilderHandler<ViewType = any> = (state: ViewType, ev: ESEvent) => any;
export type ViewFinalizerHandler<ViewType = any> = (state: ViewType) => any;

export interface ActionDefinition {
    type: string;
    handler: ActionHandler | AsyncActionHandler;
}

export interface EventStackDefinition<T extends string = null> {
    type: string;
    actions: Record<T, ActionDefinition>;
    views: Record<string, ViewDefinition>;
    queries: Record<string, QueryDefinition>;
}

export interface BaseViewBuilder<T = any> {
    definition: ViewDefinition<T>;
}
export interface PostEventViewBuilder<T = any, U extends string = null> extends BaseViewBuilder<T> {
    definition: ViewDefinition<T>;
    event: (type: U, handler: ViewEventBuilderHandler<T>) => PostEventViewBuilder<T, U>;
    finalizer: (handler: ViewFinalizerHandler<T>) => BaseViewBuilder<T>;
}

export interface ViewBuilder<T = any, U extends string = null> extends PostEventViewBuilder<T, U> {
    withView: <V>(viewDefinition: ViewDefinition<V>) => ViewBuilder<T & V, U>;
}

export type MapAction<U extends string> = <T extends (...args: any) => any>(actionType: U, handler: T) => ((...args: Parameters<T>) => Promise<void>);
export type MapView =
    (<T>(viewDefinition: ViewDefinition<T>) => T) &
    (<T, U extends keyof T>(viewDefinition: ViewDefinition<T>, property: U) => T[U]) &
    (<T, K, U extends (view: T) => any>(viewDefinition: ViewDefinition<T>, transformer: U) => ReturnType<U>);

export interface ModelMapContext<ActionKeywords extends string = null> {
    mapAction: MapAction<ActionKeywords>;
    mapView: MapView;
}

export interface ModelDefinition<T, ActionKeywords extends string> {
    esDefinition: EventStackDefinition;
    modelMapper: (ctx: ModelMapContext<ActionKeywords>) => T;
}

export interface BaseModel<T> {
    _refresh: () => Promise<T>;
}

export interface ModelBuilder<T, ActionKeywords extends string> {
    definition: ModelDefinition<T, ActionKeywords>;
    fromStack: (stack: ESStack, context: RepositoryContext) => Promise<T & BaseModel<T>>;
}

export interface Repository {
    findOrCreateModel: <T, U extends string>(id: string, model: ModelBuilder<T, U>) => Promise<T & BaseModel<T> | undefined>,
    findOrCreateView: <T>(id: string, view: BaseViewBuilder<T>) => Promise<T | undefined>,
    findOrCreateQuery: <T, U>(id: string, view: BaseQueryBuilder<T, U>, parameters: U) => Promise<T | undefined>,
}


export interface EventStackBuilder<T extends string = null> {
    definition: EventStackDefinition<T>;
    action: <U extends string>(type: U, handler: ActionHandler | AsyncActionHandler) => EventStackBuilder<T | U>;
    createView: <U = any>(type: string, defaultObj?: U) => ViewBuilder<U, T>;
    createQuery: <U = any, W = any>(type: string, defaultObj?: W, parameters?: U) => QueryBuilder<W, T, U>;
    mapModel: <U>(mapper: (ctx: ModelMapContext<T>) => U) => ModelBuilder<U, T>;
}

export interface CompiledView {
    eventId: number;
    view: any
}

export interface ViewCache {
    getFromCache: (identifier: string) => Promise<CompiledView>;
    updateCache: (identifier: string, compiledView: CompiledView) => Promise<void>;
}

export interface RepositoryContext {
    viewCache?: ViewCache;
}
