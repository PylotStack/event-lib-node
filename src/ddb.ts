import { DynamoDB } from "aws-sdk";
import { compileView } from "./lib";
import { CompiledView, ESEvent, ESStack, LocalStore, ViewCache } from "./types";

export interface DDBStackOptions {
    ddb: DynamoDB.DocumentClient;
    tablename: string;
    namespace: string;
}

export interface DDBViewCacheOptions {
    ddb?: DynamoDB.DocumentClient;
    tablename: string;
    namespace: string;
}

function createDDBStack(options: DDBStackOptions): ESStack {
    async function commitEvent(ev: ESEvent) {
        if (ev.id < 0) return;

        const event = {
            ...ev,
            namespace: options.namespace,
        };

        const transactItems: DynamoDB.DocumentClient.TransactWriteItemList = [
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
        } catch (ex) {
            if (~ex?.message?.indexOf("[ConditionalCheckFailed")) {
                console.log(`An event with id: ${event.id} already exists`);
            }

            if (~ex?.message?.indexOf("ConditionalCheckFailed]")) {
                console.log(`Event too far ahead. An event with id: ${event.id - 1} doesn't exist yet so an event with id: ${event.id} cannot be created.`);
            }

            throw ex;
        }
    }

    async function commitAnonymousEvent(ev: ESEvent) {
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

        const lastEvent = res?.Items?.[0];
        const nextEventId = (lastEvent?.id ?? -1) + 1;

        return await commitEvent({
            ...ev,
            id: nextEventId,
        });
    }

    async function getEvent(id: number) {
        const event = await options.ddb.get({
            TableName: options.tablename,
            Key: {
                namespace: options.namespace,
                id: id,
            },
        }).promise();

        return event.Item as ESEvent;
    }

    async function slice(start?: number, end?: number) {
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

        const items: ESEvent[] = res.Items as ESEvent[];
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

export function ddbStore(tablename: string): LocalStore {
    const ddb = new DynamoDB.DocumentClient({
        region: "us-west-2",
    });
    const stacks = new Map<string, ESStack>();

    function name(stackSet: string, stack: string) {
        return `${stackSet}|${stack}`;
    }

    async function getStack(stackSet: string, stackName: string): Promise<ESStack> {
        return stacks.get(name(stackSet, stackName));
    }

    async function createStack(stackSet: string, stackName: string): Promise<ESStack> {
        const _name = name(stackSet, stackName);
        const stack = createDDBStack({
            ddb,
            namespace: _name,
            tablename,
        });
        stacks.set(_name, stack);
        return stack;
    }

    async function getOrCreateStack(stackSet: string, stackName: string): Promise<ESStack> {
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


export function ddbViewCache(options: DDBViewCacheOptions): ViewCache {
    options.ddb = options.ddb ?? new DynamoDB.DocumentClient({
        region: "us-west-2",
    });

    async function getFromCache(identifier: string): Promise<CompiledView> {
        const res = await options.ddb.get({
            TableName: options.tablename,
            Key: {
                namespace: options.namespace,
                viewName: identifier,
            }
        }).promise();

        return res?.Item as CompiledView;
    }

    async function updateCache(identifier: string, compiledView: CompiledView) {
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
        } catch (ex) {
            if (~ex?.message?.indexOf("ConditionalCheckFailed")) return;
            throw ex;
        }
    }

    return {
        getFromCache,
        updateCache,
    };
}
