"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esRepository = exports.executeAction = exports.compileView = exports.defineEventStack = void 0;
const _ = require("lodash");
const local_1 = require("./local");
const types_1 = require("./types");
function createView(type, esDefinition, defaultObj) {
    const self = {};
    const definition = {
        type,
        esDefinition,
        default: defaultObj,
        baseViews: [],
        events: {},
        finalizer: undefined,
    };
    return Object.assign(self, {
        definition,
        event: (type, handler) => {
            definition.events[type] = {
                type,
                handler,
            };
            return self;
        },
        finalizer: (handler) => {
            definition.finalizer = handler;
            return self;
        },
        withView: (otherDefinition) => {
            definition.baseViews.push(otherDefinition);
            return self;
        }
    });
}
function createModelBuilder(definition) {
    return {
        definition,
        fromStack: async (stack, context) => {
            const model = {};
            const mapViewMemory = {};
            async function processModel() {
                const keysToUpdate = Object.entries(rawModelDefinition).map(([key, value]) => {
                    if (!mapViewMemory[value])
                        return;
                    return [key, mapViewMemory[value]];
                }).filter(Boolean);
                const viewsToPull = _.uniq(keysToUpdate.map(([key, value]) => value.viewDefinition));
                const viewResults = await Promise.all(viewsToPull.map(async (view) => [view, await compileView(stack, view, context)]));
                const viewMap = new Map(viewResults);
                keysToUpdate.forEach(function updateValues([key, value]) {
                    const viewResult = viewMap.get(value.viewDefinition);
                    if (!value.transformer) {
                        model[key] = viewResult;
                        return;
                    }
                    if (typeof value.transformer === "string") {
                        model[key] = viewResult === null || viewResult === void 0 ? void 0 : viewResult[value.transformer];
                        return;
                    }
                    model[key] = value.transformer(viewResult);
                });
            }
            const mapView = ((viewDefinition, transformer) => {
                const symbol = Symbol();
                mapViewMemory[symbol] = {
                    viewDefinition,
                    transformer
                };
                return symbol;
            });
            const ctx = {
                mapAction: (actionType, handler) => {
                    return async function _invokeAction(...args) {
                        const payload = handler(...args);
                        await executeAction(stack, definition.esDefinition.actions[actionType], payload);
                        await processModel();
                    };
                },
                mapView,
            };
            const baseModel = {
                _refresh: async () => {
                    await processModel();
                    return model;
                },
            };
            var rawModelDefinition = definition.modelMapper(ctx);
            Object.assign(model, rawModelDefinition, baseModel);
            await processModel();
            return model;
        },
    };
}
function defineEventStack(type) {
    const self = {};
    const definition = {
        type,
        actions: {},
        views: {},
    };
    return Object.assign(self, {
        definition: definition,
        action: (type, handler) => {
            definition.actions[type] = {
                type,
                handler,
            };
            return self;
        },
        createView: (type, defaultObj) => {
            const view = createView(type, definition, defaultObj);
            definition.views[type] = view.definition;
            return view;
        },
        mapModel: (mapper) => {
            const modelDefinition = {
                esDefinition: definition,
                modelMapper: mapper,
            };
            return createModelBuilder(modelDefinition);
        },
    });
}
exports.defineEventStack = defineEventStack;
function compileAllViews(views) {
    return views.map((x) => [...compileAllViews(x.baseViews), x]).flat();
}
function compileViewName(views) {
    return views.map((view) => `${view.type}${view.baseViews.length ? `<${compileViewName(view.baseViews)}>` : ""}`).join("|");
}
async function compileDetailedViews(stack, views, maxEventId, context) {
    var _a, _b, _c;
    let lastEventId = null;
    let lastImpactedId = null;
    const allViews = compileAllViews(views);
    const viewName = `${stack.namespace}<${compileViewName(allViews)}>`;
    const baseDefault = allViews.reduce((acc, view) => { var _a; return ({ ...acc, ...((_a = view.default) !== null && _a !== void 0 ? _a : {}) }); }, {});
    const cachedView = (_b = (await ((_a = context === null || context === void 0 ? void 0 : context.viewCache) === null || _a === void 0 ? void 0 : _a.getFromCache(viewName)))) !== null && _b !== void 0 ? _b : {
        eventId: -1,
        view: baseDefault,
    };
    const events = await stack.slice(cachedView.eventId + 1, maxEventId);
    const result = events.reduce(function processEvent(acc, event) {
        lastEventId = event.id;
        return allViews.reduce(function processEventForView(acc, view) {
            const matchingHandler = view.events[event.type];
            if (!matchingHandler)
                return acc;
            lastImpactedId = event.id;
            const result = matchingHandler.handler(acc, event);
            return result;
        }, acc);
    }, cachedView.view);
    if (lastEventId)
        await ((_c = context === null || context === void 0 ? void 0 : context.viewCache) === null || _c === void 0 ? void 0 : _c.updateCache(viewName, {
            eventId: lastEventId,
            view: result,
        }));
    const finalizedResult = allViews.reduce(function runFinalizer(acc, view) {
        if (!view.finalizer)
            return acc;
        return view.finalizer(acc);
    }, result);
    return {
        view: finalizedResult,
        lastEventId,
        lastImpactedId,
    };
}
async function compileView(stack, view, context) {
    return (await compileDetailedViews(stack, [view], undefined, context)).view;
}
exports.compileView = compileView;
const baseContext = {
    reject: (type) => {
        return {
            action: types_1.ActionHandlerEnum.REJECT,
            type,
        };
    },
    commit: (payloadOverride) => {
        return {
            action: types_1.ActionHandlerEnum.COMMIT,
            type: types_1.ActionHandlerEnum.COMMIT,
            payloadOverride,
        };
    }
};
async function executeAction(stack, action, actionPayload) {
    let knownEventId = undefined;
    const actionHandler = {
        [types_1.ActionHandlerEnum.REJECT]: (result) => {
            const err = new Error(`${result.action}: ${result.type}`);
            err.action = result.action;
            err.result = result.type;
            throw err;
        },
        [types_1.ActionHandlerEnum.COMMIT]: async (result) => {
            var _a;
            const payload = (_a = result.payloadOverride) !== null && _a !== void 0 ? _a : actionPayload;
            const newEventId = knownEventId ? knownEventId + 1 : null;
            const commitMethod = newEventId ? stack.commitEvent : stack.commitAnonymousEvent;
            await commitMethod({
                id: newEventId !== null && newEventId !== void 0 ? newEventId : 0,
                metadata: {
                    timestamp: (new Date()).toISOString(),
                },
                payload,
                type: action.type,
            });
        },
    };
    async function views(definitions) {
        const viewResults = await compileDetailedViews(stack, definitions, knownEventId ? knownEventId + 1 : undefined);
        knownEventId = viewResults.lastEventId;
        return viewResults.view;
    }
    async function view(definition) {
        return await views([definition]);
    }
    const context = {
        ...baseContext,
        views,
        view,
    };
    const result = await action.handler(context, actionPayload);
    const handler = actionHandler[result.action];
    if (!handler)
        throw new Error(`Unable to find action handler for result type: ${result.action} -> ${result.type} `);
    await handler(result);
}
exports.executeAction = executeAction;
function esRepository(store, context) {
    context = context !== null && context !== void 0 ? context : {
        viewCache: (0, local_1.localViewCache)(),
    };
    async function findOrCreateModel(id, model) {
        const stack = await store.getOrCreateStack(model.definition.esDefinition.type, id);
        const modelInstance = await model.fromStack(stack, context);
        return modelInstance;
    }
    async function findOrCreateView(id, view) {
        const stack = await store.getOrCreateStack(view.definition.esDefinition.type, id);
        const modelInstance = await compileView(stack, view.definition, context);
        return modelInstance;
    }
    return {
        findOrCreateModel,
        findOrCreateView,
    };
}
exports.esRepository = esRepository;
//# sourceMappingURL=lib.js.map