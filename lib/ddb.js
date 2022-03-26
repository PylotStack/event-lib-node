"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ddbViewCache = exports.ddbStore = void 0;
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
        namespace: options.namespace,
        commitAnonymousEvent,
        commitEvent,
        getEvent,
        slice,
    };
}
function ddbStore(tablename) {
    const ddb = new aws_sdk_1.DynamoDB.DocumentClient({
        region: "us-west-2",
    });
    const stacks = new Map();
    function name(stackSet, stack) {
        return `${stackSet}|${stack}`;
    }
    async function getStack(stackSet, stackName) {
        return stacks.get(name(stackSet, stackName));
    }
    async function createStack(stackSet, stackName) {
        const _name = name(stackSet, stackName);
        const stack = createDDBStack({
            ddb,
            namespace: _name,
            tablename,
        });
        stacks.set(_name, stack);
        return stack;
    }
    async function getOrCreateStack(stackSet, stackName) {
        const existingStack = await getStack(stackSet, stackName);
        return existingStack
            ? existingStack
            : await createStack(stackSet, stackName);
    }
    return {
        getStack,
        createStack,
        getOrCreateStack,
    };
}
exports.ddbStore = ddbStore;
function ddbViewCache(options) {
    var _a;
    options.ddb = (_a = options.ddb) !== null && _a !== void 0 ? _a : new aws_sdk_1.DynamoDB.DocumentClient({
        region: "us-west-2",
    });
    async function getFromCache(identifier) {
        const res = await options.ddb.get({
            TableName: options.tablename,
            Key: {
                namespace: options.namespace,
                viewName: identifier,
            }
        }).promise();
        return res === null || res === void 0 ? void 0 : res.Item;
    }
    async function updateCache(identifier, compiledView) {
        var _a;
        try {
            await options.ddb.put({
                TableName: options.tablename,
                Item: {
                    namespace: options.namespace,
                    viewName: identifier,
                    ...compiledView,
                },
                ConditionExpression: "attribute_not_exists(#ns) OR #evid < :evid",
                ExpressionAttributeNames: {
                    "#ns": "namespace",
                    "#evid": "eventId",
                },
                ExpressionAttributeValues: {
                    ":evid": compiledView.eventId,
                }
            }).promise();
        }
        catch (ex) {
            if (~((_a = ex === null || ex === void 0 ? void 0 : ex.message) === null || _a === void 0 ? void 0 : _a.indexOf("ConditionalCheckFailed")))
                return;
            throw ex;
        }
    }
    return {
        getFromCache,
        updateCache,
    };
}
exports.ddbViewCache = ddbViewCache;
//# sourceMappingURL=ddb.js.map