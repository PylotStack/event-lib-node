import axios from "axios";
import { ESEvent, ESStack, LocalStore } from "./types";

export interface SCtrlStackOptions {
    namespace: string;
}

const TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdhbml6YXRpb25OYW1lIjoiZmlyc3Rfb3JnIiwiaWF0IjoxNjM4NDgxMTg5LCJleHAiOjE2Mzg0ODE0ODksInN1YiI6ImF1dGgwfDYxODYxZmNlYWI3OWM5MDA3MTM1ODc5YSJ9.G-fr71FtQHr1V02L--h70SGFhhbmQVj_xJ9Ad-JjaZojEQi8r6QamQUYFNiSHBqkbHfEnVYDtrOUgbJRgahyTQcSRnY8k7K7nW1j0OcBKuCnV12bwuFsUQmJFIerqOesVqy2ZnaiyyoZRxasm7tgDpJ5DqhYl5LuqEqml6fG9_LXjSc2RcyINWrZ2LUoraVwclxfK7XsbZU20SNCv7Z7dSHnFOMkoiAIY6qH29Ujou_znmI2M2aKf2HoZDSEyvRToKRKsX5bCNKJYu9lKZHMdyz35gKHmNyNaNBViU9t2iLou2F6bRfyCNyOkKZBi3VO68kQo_z2DUFkC5GspRdyX_9QD_FGIFLMn3Rog9S9Xe3s4Oz0Sg9raCNsaSSywj8jio6-Op15X5FLTUnhRjp5xB594jrEYHLneTiz6DX2Fy2_7yBKmqcH1jIqsEduBilO2J7akdi2COYaNYuKgq72kXpUXKhJLYFz9VUwXNLLSkln0MBS8Zcb08Gz7sGUdg58";

// const DOMAIN_BASE = `https://event-api-dev.nestrick.me`;
const DOMAIN_BASE = `http://localhost:3001`;

function createSCtrlStack(options: SCtrlStackOptions): ESStack {
    async function commitEvent(ev: ESEvent) {
        await axios({
            method: "POST",
            url: `${DOMAIN_BASE}/v1/event/write`,
            headers: {
                Authorization: `Bearer ${TOKEN}`,
            },
            data: JSON.stringify({
                namespace: options.namespace,
                id: ev.id,
                data: ev,
            }),
        });
    }

    async function commitAnonymousEvent(ev: ESEvent) {
        await axios({
            method: "POST",
            url: `${DOMAIN_BASE}/v1/event/write`,
            headers: {
                Authorization: `Bearer ${TOKEN}`,
            },
            data: JSON.stringify({
                anonymous: true,
                namespace: options.namespace,
                data: ev,
            }),
        });
    }

    async function getEvent(id: number) {
        const { data } = await axios({
            method: "GET",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
            },
            url: `${DOMAIN_BASE}/v1/event/query/${encodeURIComponent(options.namespace)}/${encodeURIComponent(id)}`,
        });

        return data?.items?.[0];
    }

    async function slice(start?: number, end?: number) {
        end = end || Number.MAX_SAFE_INTEGER;
        const { data } = await axios({
            method: "GET",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
            },
            url: `${DOMAIN_BASE}/v1/event/query/${encodeURIComponent(options.namespace)}/${start}-${end}`,
        });

        return data?.items;
    }

    return {
        namespace: options.namespace,
        commitAnonymousEvent,
        commitEvent,
        getEvent,
        slice,
    };
}

export function sctrlStore(organizationName: string): LocalStore {
    const stacks = new Map<string, ESStack>();

    function name(stackSet: string, stack: string) {
        return `${organizationName}|${stackSet}|${stack}`;
    }

    async function getStack(stackSet: string, stackName: string): Promise<ESStack> {
        return stacks.get(name(stackSet, stackName));
    }

    async function createStack(stackSet: string, stackName: string): Promise<ESStack> {
        const _name = name(stackSet, stackName);
        const stack = createSCtrlStack({
            namespace: _name,
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
