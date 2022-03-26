import { ActionDefinition, EventStackBuilder, ESStack, LocalStore, ViewDefinition, Repository, RepositoryContext } from "./types";
export declare function defineEventStack(type: string): EventStackBuilder<null>;
export declare function compileView<T = null>(stack: ESStack, view: ViewDefinition<T>, context?: RepositoryContext): Promise<T>;
export declare function executeAction(stack: ESStack, action: ActionDefinition, actionPayload: any): Promise<void>;
export declare function esRepository(store: LocalStore, context?: RepositoryContext): Repository;
