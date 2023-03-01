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
    query: <T, U>(definition: QueryDefinition<T, U>, parameters: U) => Promise<T>
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
    event: <Z extends V>(type: U, handler: QueryEventBuilderHandler<T, Z>) => PostEventQueryBuilder<T, U, Z>;
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
    flows: any[];
    events: Record<string, ViewEventBuilderDefinition<ViewType>>;
    baseViews: ViewDefinition[];
    finalizer: ViewFinalizerHandler<ViewType>;
}

export type ActionHandler<T = any> = (context: ActionHandlerContext, payload: T) => ActionHandlerResult;
export type AsyncActionHandler<T = any> = (context: ActionHandlerContext, payload: T) => Promise<ActionHandlerResult>;

export type ViewEventBuilderHandler<ViewType = any> = (state: ViewType, ev: ESEvent) => any;
export type ViewFinalizerHandler<ViewType = any> = (state: ViewType) => any;

export interface ActionDefinition<TypeStr extends string = null, T = any> {
    esDefinition: EventStackDefinition;
    type: TypeStr;
    handler: ActionHandler<T> | AsyncActionHandler<T>;
}

export interface EventStackDefinition<Str extends string = null> {
    type: string;
    actions: Record<Str, ActionDefinition>;
    views: Record<string, ViewDefinition>;
    queries: Record<string, QueryDefinition>;
}

export interface BaseViewBuilder<T = any> {
    definition: ViewDefinition<T>;
}
export interface PostEventViewBuilder<T = any, U extends string = null> extends BaseViewBuilder<T> {
    definition: ViewDefinition<T>;
    event: (type: U, handler: ViewEventBuilderHandler<T>) => PostEventViewBuilder<T, U>;
    flow: (flow: any) => PostEventViewBuilder<T, U>;
    finalizer: (handler: ViewFinalizerHandler<T>) => BaseViewBuilder<T>;
}

export interface ViewBuilder<T = any, U extends string = null> extends PostEventViewBuilder<T, U> {
    withView: <V>(viewDefinition: ViewDefinition<V>) => ViewBuilder<T & V, U>;
}

export type MapAction<DictType extends { [u in U]: V }, U extends string, V = any> = <T extends (...args: any) => DictType[W], W extends U = null>(actionType: W, handler: T) => ((...args: Parameters<T>) => Promise<void>);
export type MapView =
    (<T>(viewDefinition: ViewDefinition<T>) => T) &
    (<T, U extends keyof T>(viewDefinition: ViewDefinition<T>, property: U) => T[U]) &
    (<T, K, U extends (view: T) => any>(viewDefinition: ViewDefinition<T>, transformer: U) => ReturnType<U>);
export type MapDeferredView =
    (<T>(viewDefinition: ViewDefinition<T>) => () => Promise<T>) &
    (<T, U extends keyof T>(viewDefinition: ViewDefinition<T>, property: U) => () => Promise<T[U]>) &
    (<T, K, U extends (view: T) => any>(viewDefinition: ViewDefinition<T>, transformer: U) => () => Promise<ReturnType<U>>);
export type MapQuery = <QueryModel, QueryParams, HandlerArgs extends (...args: any) => QueryParams>(queryDefinition: QueryDefinition<QueryModel, QueryParams>, handler: HandlerArgs) => ((...args: Parameters<HandlerArgs>) => Promise<QueryModel>);


export interface ModelMapContext<DictType extends Record<ActionKeywords, ActionDefinition> = any, ActionKeywords extends string = null> {
    mapAction: MapAction<DictType, ActionKeywords>;
    mapView: MapView;
    mapDeferredView: MapDeferredView;
    mapQuery: MapQuery;
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
    findOrCreateModel: <T, U extends string>(id: string, model: ModelBuilder<T, U>) => Promise<T & BaseModel<T>>,
    findOrCreateView: <T>(id: string, view: BaseViewBuilder<T>) => Promise<T | undefined>,
    findOrCreateQuery: <T, U>(id: string, view: BaseQueryBuilder<T, U>, parameters: U) => Promise<T | undefined>,
}

export interface EventStackBuilder<T extends Record<Str, ActionDefinition> = any, Str extends string = null> {
    definition: EventStackDefinition<Str>;
    action: <U extends string, V = any>(type: U, handler: ActionHandler<V> | AsyncActionHandler<V>) => EventStackBuilder<T & { [u in U]: V }, Str | U>;
    createView: <U = any>(type: string, defaultObj?: U) => ViewBuilder<U, Str>;
    createFlow: <U = any>(type: string, flowDefinition: any) => ViewBuilder<U, Str>;
    createQuery: <W = any>(type: string, defaultObj?: W) => QueryBuilder<W, Str, any>;
    mapModel: <U>(mapper: (ctx: ModelMapContext<T, Str>) => U) => ModelBuilder<U, Str>;
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
    executor?: Executor;
}

export type ExecuteAction = (stack: ESStack, action: ActionDefinition, actionPayload: any) => Promise<void>;
export type CompileView = <T = null>(stack: ESStack, view: ViewDefinition<T>, context?: RepositoryContext) => Promise<T>;
export type CompileQuery = <T = null, U = null>(stack: ESStack, query: QueryDefinition<T, U>, parameters: U, maxEventId?: number, context?: RepositoryContext) => Promise<DetailedView<T>>;

export interface Executor {
    executeAction: ExecuteAction;
    compileView: CompileView;
    compileQuery: CompileQuery;
}
