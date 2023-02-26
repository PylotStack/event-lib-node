import { DetailedView, ESStack, EventStackDefinition, RepositoryContext, ViewBuilder, ViewDefinition } from "../types";

export const FLOW_SYMBOL = Symbol.for("@sctrl/event-stack/flow");

function doesTriggerMatchFlow(flowTrigger, trigger) {
    if (flowTrigger.trigger !== trigger.triggerType) return false;
    if (trigger.triggerType === "event") {
        if (!flowTrigger.events.includes(trigger.eventType)) return false;
    }
    return true;
}

export function eval_step(flowDefinition, flowState, trigger) {
    const mappedKeys = Object.entries(flowDefinition).map(([key, value]) => {
        if (!value[FLOW_SYMBOL]) return [key, value];

        const flows = value[FLOW_SYMBOL]?.flows ?? [];

        const val = flows.filter(flow => doesTriggerMatchFlow(flow, trigger)).reduce((acc, flow) => {
            if (flow.condition?.if && !flow.condition.if.condition(flowState)) return acc;
            if (flow.action.set) {
                return trigger.eventData[flow.action.set.property];
            }
            if (flow.action.constant) {
                return flow.action.constant.value;
            }
            if (flow.action.add) {
                if(flow.action.add.property) {
                    return acc + trigger.eventData[flow.action.add.property];
                } else {
                    return acc + flow.action.add.value;
                }
            }
            if (flow.action.subtract) {
                return acc - trigger.eventData[flow.action.subtract.property];
            }

            throw new Error(`Unknown acion for flow`);
        }, flowState[key]);

        return [key, val];
    });

    const mappedState = Object.fromEntries(mappedKeys);
    return mappedState;
}

export function initFlowState(flowDefinition) {
    return eval_step(flowDefinition, {}, { triggerType: "init" });
}

export const flow = {
    default: (value: any, context: any = {}) => {
        const self = {};
        return Object.assign(self, {
            [FLOW_SYMBOL]: {
                ...(context[FLOW_SYMBOL] ?? {}),
                flows: [
                    ...(context[FLOW_SYMBOL]?.flows ?? []),
                    {
                        trigger: "init",
                        action: {
                            "constant": {
                                value,
                            },
                        },
                    },
                ],
            },
            onEvent: (type: string) => flow.onEvent(type, self),
            default: (value: any) => flow.default(value, self),
        });
    },
    onEvent: (type: string, context: any = {}) => {
        const self: any = {};

        function set(property: string, context: any = self) {
            const self2 = {};
            if (!context[FLOW_SYMBOL].builderCurrentTrigger) throw new Error(`Expected builder to be in action.`);

            return Object.assign(self2, {
                [FLOW_SYMBOL]: {
                    ...context[FLOW_SYMBOL],
                    builderCurrentTrigger: undefined,
                    flows: [
                        ...(context[FLOW_SYMBOL].flows ?? []),
                        {
                            trigger: context[FLOW_SYMBOL].builderCurrentTrigger.triggerType,
                            events: context[FLOW_SYMBOL].builderCurrentTrigger.events,
                            condition: context[FLOW_SYMBOL].builderCurrentTrigger.condition,
                            action: {
                                "set": {
                                    property,
                                },
                            },
                        },
                    ],
                },
                onEvent: (type: string) => flow.onEvent(type, self2),
            });
        }

        function constant<T>(value: T, context: any = self) {
            const self2 = {};
            if (!context[FLOW_SYMBOL].builderCurrentTrigger) throw new Error(`Expected builder to be in action.`);

            return Object.assign(self2, {
                [FLOW_SYMBOL]: {
                    ...context[FLOW_SYMBOL],
                    builderCurrentTrigger: undefined,
                    flows: [
                        ...(context[FLOW_SYMBOL].flows ?? []),
                        {
                            trigger: context[FLOW_SYMBOL].builderCurrentTrigger.triggerType,
                            events: context[FLOW_SYMBOL].builderCurrentTrigger.events,
                            condition: context[FLOW_SYMBOL].builderCurrentTrigger.condition,
                            action: {
                                "constant": {
                                    value,
                                },
                            },
                        },
                    ],
                },
                onEvent: (type: string) => flow.onEvent(type, self2),
            });
        }

        function add<T>(property: string, context: any = self) {
            const self2 = {};
            if (!context[FLOW_SYMBOL].builderCurrentTrigger) throw new Error(`Expected builder to be in action.`);

            return Object.assign(self2, {
                [FLOW_SYMBOL]: {
                    ...context[FLOW_SYMBOL],
                    builderCurrentTrigger: undefined,
                    flows: [
                        ...(context[FLOW_SYMBOL].flows ?? []),
                        {
                            trigger: context[FLOW_SYMBOL].builderCurrentTrigger.triggerType,
                            events: context[FLOW_SYMBOL].builderCurrentTrigger.events,
                            condition: context[FLOW_SYMBOL].builderCurrentTrigger.condition,
                            action: {
                                "add": {
                                    property,
                                },
                            },
                        },
                    ],
                },
                onEvent: (type: string) => flow.onEvent(type, self2),
            });
        }

        function subtract<T>(property: string, context: any = self) {
            const self2 = {};
            if (!context[FLOW_SYMBOL].builderCurrentTrigger) throw new Error(`Expected builder to be in action.`);

            return Object.assign(self2, {
                [FLOW_SYMBOL]: {
                    ...context[FLOW_SYMBOL],
                    builderCurrentTrigger: undefined,
                    flows: [
                        ...(context[FLOW_SYMBOL].flows ?? []),
                        {
                            trigger: context[FLOW_SYMBOL].builderCurrentTrigger.triggerType,
                            events: context[FLOW_SYMBOL].builderCurrentTrigger.events,
                            condition: context[FLOW_SYMBOL].builderCurrentTrigger.condition,
                            action: {
                                "subtract": {
                                    property,
                                },
                            },
                        },
                    ],
                },
                onEvent: (type: string) => flow.onEvent(type, self2),
            });
        }

        function increment<T>(step: number, context: any = self) {
            const self2 = {};
            if (!context[FLOW_SYMBOL].builderCurrentTrigger) throw new Error(`Expected builder to be in action.`);

            return Object.assign(self2, {
                [FLOW_SYMBOL]: {
                    ...context[FLOW_SYMBOL],
                    builderCurrentTrigger: undefined,
                    flows: [
                        ...(context[FLOW_SYMBOL].flows ?? []),
                        {
                            trigger: context[FLOW_SYMBOL].builderCurrentTrigger.triggerType,
                            events: context[FLOW_SYMBOL].builderCurrentTrigger.events,
                            condition: context[FLOW_SYMBOL].builderCurrentTrigger.condition,
                            action: {
                                "add": {
                                    value: step,
                                },
                            },
                        },
                    ],
                },
                onEvent: (type: string) => flow.onEvent(type, self2),
            });
        }

        function _if(condition, context: any = self) {
            const self2 = {};
            if (!context[FLOW_SYMBOL].builderCurrentTrigger) throw new Error(`Expected builder to be in action.`);

            return Object.assign(self2, {
                [FLOW_SYMBOL]: {
                    ...context[FLOW_SYMBOL],
                    builderCurrentTrigger: {
                        ...context[FLOW_SYMBOL].builderCurrentTrigger,
                        condition: {
                            if: {
                                condition,
                            },
                        },
                    },
                },
                set: (value: any) => set(value, self2),
                constant: (value: any) => constant(value, self2),
                add: (property: string) => add(property, self2),
                increment: (step: number) => increment(step, self2),
                subtract: (property: string) => subtract(property, self2),
                onEvent: (type: string) => flow.onEvent(type, self2),
            });
        }

        return Object.assign(self, context, {
            [FLOW_SYMBOL]: {
                ...context[FLOW_SYMBOL],
                builderCurrentTrigger: {
                    triggerType: "event",
                    events: [...(context[FLOW_SYMBOL]?.builderCurrentTrigger?.events ?? []), type],
                },
            },
            set,
            constant,
            add,
            increment,
            subtract,
            if: _if,
            onEvent: (type: string) => flow.onEvent(type, self),
            default: (value: any) => flow.default(value, self),
        });
    },
    eval: function* (flowDefinition) {
        let currentTrigger = null;
        let currentState = eval_step(flowDefinition, {}, { triggerType: "init" });

        do {
            currentTrigger = yield currentState;
            currentState = eval_step(flowDefinition, currentState, currentTrigger);
        } while (currentTrigger !== null);

        return yield currentState;
    },
};

export const example = {
    name: flow
        .onEvent("TURN_ON").set(true)
        .onEvent("TURN_OFF").set(false),
};

export function createView<T = any>(type: string, esDefinition: EventStackDefinition, defaultObj?: T): ViewBuilder<T> {
    const self = {} as ViewBuilder<T>;
    const definition: ViewDefinition<T> = {
        type,
        esDefinition,
        default: defaultObj,
        baseViews: [],
        flows: [],
        events: {},
        finalizer: undefined,
    };
    return Object.assign(self, {
        definition,
        event: (type: string, handler) => {
            definition.events[type] = {
                type,
                handler,
            };
            return self;
        },
        flow: (flowDefinition) => {
            definition.flows.push(flowDefinition);
            return self;
        },
        finalizer: (handler) => {
            definition.finalizer = handler;
            return self;
        },
        withView: <U>(otherDefinition: ViewDefinition<U>) => {
            definition.baseViews.push(otherDefinition);
            return self as ViewBuilder<T & U>;
        }
    } as ViewBuilder<T>);
}

export function compileAllViews(views: ViewDefinition[]) {
    return views.map((x) => [...compileAllViews(x.baseViews), x]).flat();
}

export function compileViewName(views: ViewDefinition[]) {
    return views.map((view) => `${view.type}${view.baseViews.length ? `<${compileViewName(view.baseViews)}>` : ""}`).join("|");
}

export async function compileDetailedViews(stack: ESStack, views: ViewDefinition[], maxEventId?: number, context?: RepositoryContext): Promise<DetailedView<any>> {
    let lastEventId: number | null = null;
    let lastImpactedId: number | null = null;

    const allViews = compileAllViews(views);
    const viewName = `${stack.namespace}<${compileViewName(allViews)}>`;

    const baseDefault = allViews.reduce((acc, view) => ({ ...acc, ...(view.default ?? {}) }), {});
    const cachedView = (await context?.viewCache?.getFromCache(viewName)) ?? {
        eventId: -1,
        view: baseDefault,
    };

    const events = await stack.slice(cachedView.eventId + 1, maxEventId);

    const result = events.reduce(function processEvent(acc, event) {
        lastEventId = event.id;
        return allViews.reduce(function processEventForView(acc, view) {
            function doThing() {
                const matchingHandler = view.events[event.type];
                if (!matchingHandler) return acc;
                lastImpactedId = event.id;
                const result = matchingHandler.handler(acc, event);
                return result;
            }

            const output = doThing();

            return view.flows.reduce((acc, flow) => {
                return eval_step(flow, acc, {
                    triggerType: "event",
                    eventType: event.type,
                    eventData: event.payload,
                });
            }, output);
        }, acc);
    }, cachedView.view);

    if (lastEventId) await context?.viewCache?.updateCache(viewName, {
        eventId: lastEventId,
        view: result,
    });

    const finalizedResult = allViews.reduce(function runFinalizer(acc, view) {
        if (!view.finalizer) return acc;
        return view.finalizer(acc);
    }, result);

    return {
        view: finalizedResult,
        lastEventId,
        lastImpactedId,
    };
}

export async function compileView<T = null>(stack: ESStack, view: ViewDefinition<T>, context?: RepositoryContext): Promise<T> {
    return (await compileDetailedViews(stack, [view], undefined, context)).view;
}
