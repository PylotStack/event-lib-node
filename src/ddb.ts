import { DynamoDB } from "aws-sdk";
import { ESEvent, ESStack, LocalStore } from "./types";

export interface DDBStackOptions {
    ddb: DynamoDB.DocumentClient;
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
        commitAnonymousEvent,
        commitEvent,
        getEvent,
        slice,
    };
}

export function ddbStore(): LocalStore {
    const ddb = new DynamoDB.DocumentClient({
        region: "us-west-2",
    });
    const stacks = new Map<string, ESStack>();

    async function getStack(name: string): Promise<ESStack> {
        return stacks.get(name);
    }

    async function createStack(name: string): Promise<ESStack> {
        const stack = createDDBStack({
            ddb,
            namespace: name,
            tablename: `sctrl2-events`,
        });
        stacks.set(name, stack);
        return stack;
    }

    async function getOrCreateStack(name: string): Promise<ESStack> {
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
