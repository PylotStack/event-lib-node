import { localStack } from "./local";
import { executeAction, compileView } from "./lib";
import { ESEvent, EventStackDefinition, ViewDefinition, ActionHandlerEnum } from "./types";
import * as _ from "lodash";
import { CloudFormation } from "aws-sdk";
import * as assert from "assert";

export interface BaseStackTestBuilder {
    withEvents(events: Array<Record<string, any>>): StackTestBuilder;
    onAction(actionType: string, payload: Record<string, any>): StackTestBuilder;
    commit(): StackTestBuilder;
    reject(errorType?: string): StackTestBuilder;
    assertView(view: ViewDefinition, expectedModel: any): StackTestBuilder;
    test(): Promise<void>;
}

export type StackTestBuilder = BaseStackTestBuilder & (() => Promise<void>);

export function stack(stackDef: EventStackDefinition): StackTestBuilder {
    const self: StackTestBuilder = (() => self.test()) as unknown as StackTestBuilder;

    let definition = {
        baseEvents: [],
        testCases: [],
    };

    return Object.assign(self, {
        withEvents(events: Array<Record<string, any>>) {
            definition.baseEvents.push(...events);
            return self;
        },
        onAction(actionType: string, payload: Record<string, any>) {
            definition.testCases.push({
                actionType,
                payload,
                expectedViews: [],
            });
            return self;
        },
        commit() {
            const testCase = _.last(definition.testCases);
            testCase.expectedActionResult = ActionHandlerEnum.COMMIT;
            return self;
        },
        reject(errorType?: string) {
            const testCase = _.last(definition.testCases);
            testCase.expectedActionResult = ActionHandlerEnum.REJECT;
            testCase.expectedActionResultMessage = errorType;
            return self;
        },
        assertView(view: ViewDefinition, expectedModel: any) {
            const testCase = _.last(definition.testCases);
            testCase.expectedViews.push({ definition: view, state: expectedModel });
            return self;
        },
        async test() {
            const stack = localStack();
            for (let event of definition.baseEvents) {
                await stack.commitEvent(event);
            }
            for (let testCase of definition.testCases) {
                const res = await executeAction(stack, stackDef.actions[testCase.actionType], testCase.payload).catch((err) => err);
                if (testCase.expectedActionResult) {
                    if (testCase.expectedActionResult === ActionHandlerEnum.COMMIT && res?.action) throw new Error(`Expected result to be ${ActionHandlerEnum.COMMIT} but instead received ${res?.action}`);
                    if (testCase.expectedActionResult === ActionHandlerEnum.COMMIT && res) throw res;
                    if (testCase.expectedActionResult === ActionHandlerEnum.REJECT && !res) throw new Error(`Expected result to be ${ActionHandlerEnum.REJECT} but instead received ${ActionHandlerEnum.COMMIT}`);
                    if (testCase.expectedActionResult === ActionHandlerEnum.REJECT && !res.action) throw res;
                    if (testCase.expectedActionResult === ActionHandlerEnum.REJECT && res.action !== ActionHandlerEnum.REJECT) throw new Error(`Expected result to be ${ActionHandlerEnum.REJECT} but instead received ${res.action}`);
                    if (testCase.expectedActionResult === ActionHandlerEnum.REJECT && res.result !== testCase.expectedActionResultMessage) throw new Error(`Expected result to be ${testCase.expectedActionResultMessage} but instead received ${res.result}`);
                }

                for (let expectedView of testCase.expectedViews) {
                    const data = await compileView(stack, expectedView.definition);
                    assert.deepStrictEqual(data, expectedView.state);
                }

            }
        },
    });
}