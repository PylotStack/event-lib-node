import { LocalStore } from "./types";
export interface SCtrlStackOptions {
    namespace: string;
}
export declare function sctrlStore(organizationName: string): LocalStore;
