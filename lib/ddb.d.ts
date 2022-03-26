import { DynamoDB } from "aws-sdk";
import { LocalStore, ViewCache } from "./types";
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
export declare function ddbStore(tablename: string): LocalStore;
export declare function ddbViewCache(options: DDBViewCacheOptions): ViewCache;
