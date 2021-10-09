"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stack = void 0;
const local_1 = require("./local");
const lib_1 = require("./lib");
const types_1 = require("./types");
const _ = require("lodash");
const assert = require("assert");
function stack(stackDef) {
    const self = (() => self.test());
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
        var _a;
        return (_a = _.last(definition.testCases)) !== null && _a !== void 0 ? _a : createTestCase();
    }
    return Object.assign(self, {
        withEvents(events) {
            definition.baseEvents.push(...events);
            return self;
        },
        onAction(actionType, payload) {
            definition.testCases.push(Object.assign(createTestCase(), {
                actionType,
                payload,
            }));
            return self;
        },
        commit() {
            const testCase = lastTestCase();
            testCase.expectedActionResult = types_1.ActionHandlerEnum.COMMIT;
            return self;
        },
        reject(errorType) {
            const testCase = lastTestCase();
            testCase.expectedActionResult = types_1.ActionHandlerEnum.REJECT;
            testCase.expectedActionResultMessage = errorType;
            return self;
        },
        assertView(view, expectedModel) {
            const testCase = lastTestCase();
            testCase.expectedViews.push({ definition: view, state: expectedModel });
            return self;
        },
        async test() {
            const stack = (0, local_1.localStack)();
            for (let event of definition.baseEvents) {
                await stack.commitEvent(event);
            }
            for (let testCase of definition.testCases) {
                if (testCase.actionType) {
                    const res = await (0, lib_1.executeAction)(stack, stackDef.actions[testCase.actionType], testCase.payload).catch((err) => err);
                    if (testCase.expectedActionResult) {
                        if (testCase.expectedActionResult === types_1.ActionHandlerEnum.COMMIT && (res === null || res === void 0 ? void 0 : res.action))
                            throw new Error(`Expected result to be ${types_1.ActionHandlerEnum.COMMIT} but instead received ${res === null || res === void 0 ? void 0 : res.action}`);
                        if (testCase.expectedActionResult === types_1.ActionHandlerEnum.COMMIT && res)
                            throw res;
                        if (testCase.expectedActionResult === types_1.ActionHandlerEnum.REJECT && !res)
                            throw new Error(`Expected result to be ${types_1.ActionHandlerEnum.REJECT} but instead received ${types_1.ActionHandlerEnum.COMMIT}`);
                        if (testCase.expectedActionResult === types_1.ActionHandlerEnum.REJECT && !res.action)
                            throw res;
                        if (testCase.expectedActionResult === types_1.ActionHandlerEnum.REJECT && res.action !== types_1.ActionHandlerEnum.REJECT)
                            throw new Error(`Expected result to be ${types_1.ActionHandlerEnum.REJECT} but instead received ${res.action}`);
                        if (testCase.expectedActionResult === types_1.ActionHandlerEnum.REJECT && res.result !== testCase.expectedActionResultMessage)
                            throw new Error(`Expected result to be ${testCase.expectedActionResultMessage} but instead received ${res.result}`);
                    }
                }
                for (let expectedView of testCase.expectedViews) {
                    const data = await (0, lib_1.compileView)(stack, expectedView.definition);
                    assert.deepStrictEqual(data, expectedView.state);
                }
            }
        },
    });
}
exports.stack = stack;
//# sourceMappingURL=testUtils.js.map