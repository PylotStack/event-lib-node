import { localStack } from "./local";
import { executeAction, compileView } from "./lib";
import { EventStackDefinition, ViewDefinition, ActionHandlerEnum } from "./types";
import * as _ from "lodash";
import * as assert from "assert";

export interface BaseStackTestBuilder<T extends string = null>  {
    withEvents(events: Array<Record<string, any>>): StackTestBuilder<T>;
    onAction(actionType: T, payload: Record<string, any>): StackTestBuilder<T>;
    commit(): StackTestBuilder<T>;
    reject(errorType?: string): StackTestBuilder<T>;
    assertView(view: ViewDefinition, expectedModel: any): StackTestBuilder<T>;
    test(): Promise<void>;
}

export type StackTestBuilder<T extends string = null> = BaseStackTestBuilder<T> & (() => Promise<void>);

export function stack<T extends string = null>(stackDef: EventStackDefinition<T>): StackTestBuilder<T> {
    const self: StackTestBuilder = (() => self.test()) as unknown as StackTestBuilder;

    let definition = {
        baseEvents: [],
        testCases: [],
    };

    function createTestCase() {
        return {
            expectedViews: [],
        };
    }

    function lastTestCase() {
        return _.last(definition.testCases) ?? createTestCase();
    }

    return Object.assign(self, {
        withEvents(events: Array<Record<string, any>>) {
            definition.baseEvents.push(...events);
            return self;
        },
        onAction(actionType: string, payload: Record<string, any>) {
            definition.testCases.push(Object.assign(createTestCase(), {
                actionType,
                payload,
            }));
            return self;
        },
        commit() {
            const testCase = lastTestCase();
            testCase.expectedActionResult = ActionHandlerEnum.COMMIT;
            return self;
        },
        reject(errorType?: string) {
            const testCase = lastTestCase();
            testCase.expectedActionResult = ActionHandlerEnum.REJECT;
            testCase.expectedActionResultMessage = errorType;
            return self;
        },
        assertView(view: ViewDefinition, expectedModel: any) {
            const testCase = lastTestCase();
            testCase.expectedViews.push({ definition: view, state: expectedModel });
            return self;
        },
        async test() {
            const stack = localStack("test");
            for (let event of definition.baseEvents) {
                await stack.commitEvent(event);
            }
            for (let testCase of definition.testCases) {
                if (testCase.actionType) {
                    const res = await executeAction(stack, stackDef.actions[testCase.actionType], testCase.payload).catch((err) => err);
                    if (testCase.expectedActionResult) {
                        if (testCase.expectedActionResult === ActionHandlerEnum.COMMIT && res?.action) throw new Error(`Expected result to be ${ActionHandlerEnum.COMMIT} but instead received ${res?.action}`);
                        if (testCase.expectedActionResult === ActionHandlerEnum.COMMIT && res) throw res;
                        if (testCase.expectedActionResult === ActionHandlerEnum.REJECT && !res) throw new Error(`Expected result to be ${ActionHandlerEnum.REJECT} but instead received ${ActionHandlerEnum.COMMIT}`);
                        if (testCase.expectedActionResult === ActionHandlerEnum.REJECT && !res.action) throw res;
                        if (testCase.expectedActionResult === ActionHandlerEnum.REJECT && res.action !== ActionHandlerEnum.REJECT) throw new Error(`Expected result to be ${ActionHandlerEnum.REJECT} but instead received ${res.action}`);
                        if (testCase.expectedActionResult === ActionHandlerEnum.REJECT && res.result !== testCase.expectedActionResultMessage) throw new Error(`Expected result to be ${testCase.expectedActionResultMessage} but instead received ${res.result}`);
                    }
                }

                for (let expectedView of testCase.expectedViews) {
                    const data = await compileView(stack, expectedView.definition);
                    assert.deepStrictEqual(data, expectedView.state);
                }

            }
        },
    });
}