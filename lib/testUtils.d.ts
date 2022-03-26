import { EventStackDefinition, ViewDefinition } from "./types";
export interface BaseStackTestBuilder<T extends string = null> {
    withEvents(events: Array<Record<string, any>>): StackTestBuilder<T>;
    onAction(actionType: T, payload: Record<string, any>): StackTestBuilder<T>;
    commit(): StackTestBuilder<T>;
    reject(errorType?: string): StackTestBuilder<T>;
    assertView(view: ViewDefinition, expectedModel: any): StackTestBuilder<T>;
    test(): Promise<void>;
}
export declare type StackTestBuilder<T extends string = null> = BaseStackTestBuilder<T> & (() => Promise<void>);
export declare function stack<T extends string = null>(stackDef: EventStackDefinition<T>): StackTestBuilder<T>;
