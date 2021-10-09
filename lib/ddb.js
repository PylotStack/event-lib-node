"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ddbStore = void 0;
const aws_sdk_1 = require("aws-sdk");
function createDDBStack(options) {
    async function commitEvent(ev) {
        var _a, _b;
        if (ev.id < 0)
            return;
        const event = {
            ...ev,
            namespace: options.namespace,
        };
        const transactItems = [
            {
                Put: {
                    TableName: options.tablename,
                    Item: event,
                    ConditionExpression: "attribute_not_exists(#ns)",
                    ExpressionAttributeNames: {
                        "#ns": "namespace",
                    },
                },
            }
        ];
        if (event.id !== 0) {
            transactItems.push({
                ConditionCheck: {
                    TableName: options.tablename,
                    Key: {
                        namespace: event.namespace,
                        id: event.id - 1
                    },
                    ConditionExpression: "attribute_exists(#ns)",
                    ExpressionAttributeNames: {
                        "#ns": "namespace",
                    },
                },
            });
        }
        try {
            await options.ddb.transactWrite({
                TransactItems: transactItems,
            }).promise();
        }
        catch (ex) {
            if (~((_a = ex === null || ex === void 0 ? void 0 : ex.message) === null || _a === void 0 ? void 0 : _a.indexOf("[ConditionalCheckFailed"))) {
                console.log(`An event with id: ${event.id} already exists`);
            }
            if (~((_b = ex === null || ex === void 0 ? void 0 : ex.message) === null || _b === void 0 ? void 0 : _b.indexOf("ConditionalCheckFailed]"))) {
                console.log(`Event too far ahead. An event with id: ${event.id - 1} doesn't exist yet so an event with id: ${event.id} cannot be created.`);
            }
            throw ex;
        }
    }
    async function commitAnonymousEvent(ev) {
        var _a, _b;
        const res = await options.ddb.query({
            TableName: options.tablename,
            KeyConditionExpression: "#ns=:ns",
            ScanIndexForward: false,
            ExpressionAttributeNames: {
                "#ns": "namespace",
            },
            ExpressionAttributeValues: {
                ":ns": options.namespace,
            },
            Limit: 1,
        }).promise();
        const lastEvent = (_a = res === null || res === void 0 ? void 0 : res.Items) === null || _a === void 0 ? void 0 : _a[0];
        const nextEventId = ((_b = lastEvent === null || lastEvent === void 0 ? void 0 : lastEvent.id) !== null && _b !== void 0 ? _b : -1) + 1;
        return await commitEvent({
            ...ev,
            id: nextEventId,
        });
    }
    async function getEvent(id) {
        const event = await options.ddb.get({
            TableName: options.tablename,
            Key: {
                namespace: options.namespace,
                id: id,
            },
        }).promise();
        return event.Item;
    }
    async function slice(start, end) {
        const res = await options.ddb.query({
            TableName: options.tablename,
            KeyConditionExpression: "#ns=:ns and #id >= :start",
            ExpressionAttributeNames: {
                "#ns": "namespace",
                "#id": "id",
            },
            ExpressionAttributeValues: {
                ":ns": options.namespace,
                ":start": start,
            },
        }).promise();
        const items = res.Items;
        return items;
    }
    return {
        commitAnonymousEvent,
        commitEvent,
        getEvent,
        slice,
    };
}
function ddbStore() {
    const ddb = new aws_sdk_1.DynamoDB.DocumentClient({
        region: "us-west-2",
    });
    const stacks = new Map();
    async function getStack(name) {
        return stacks.get(name);
    }
    async function createStack(name) {
        const stack = createDDBStack({
            ddb,
            namespace: name,
            tablename: `sctrl2-events`,
        });
        stacks.set(name, stack);
        return stack;
    }
    async function getOrCreateStack(name) {
        const existingStack = await getStack(name);
        return existingStack
            ? existingStack
            : await createStack(name);
    }
    return {
        getStack,
        createStack,
        getOrCreateStack,
    };
}
exports.ddbStore = ddbStore;
//# sourceMappingURL=ddb.js.map