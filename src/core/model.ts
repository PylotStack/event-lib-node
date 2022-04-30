import { compileView } from "./view";
import { compileQuery } from "./query";
import { executeAction } from "./lib";
import {
    ModelDefinition, ModelBuilder, ESStack, RepositoryContext, BaseModel,
    MapView, ViewDefinition, MapQuery, QueryDefinition, ModelMapContext
} from "../types";
import { uniq } from "../utils";

export function createModelBuilder<T, ActionKeywords extends string>(definition: ModelDefinition<T, ActionKeywords>): ModelBuilder<T, ActionKeywords> {
    return {
        definition,
        fromStack: async (stack: ESStack, context?: RepositoryContext) => {
            const model: T & BaseModel<T> = {} as T & BaseModel<T>;
            const mapViewMemory = {};

            async function processModel() {
                const keysToUpdate = Object.entries(rawModelDefinition).map(([key, value]) => {
                    if (!mapViewMemory[value]) return;
                    return [key, mapViewMemory[value]];
                }).filter(Boolean);
                const viewsToPull = uniq(keysToUpdate.map(([key, value]) => value.viewDefinition));
                const viewResults = await Promise.all(viewsToPull.map(async (view) => [view, await compileView(stack, view, context)]));
                const viewMap = new Map<any, any>(viewResults as Array<[any, any]>);
                keysToUpdate.forEach(function updateValues([key, value]) {
                    const viewResult = viewMap.get(value.viewDefinition);
                    if (!value.transformer) {
                        model[key] = viewResult;
                        return;
                    }
                    if (typeof value.transformer === "string") {
                        model[key] = viewResult?.[value.transformer];
                        return;
                    }
                    model[key] = value.transformer(viewResult);
                });
            }

            const mapView: MapView = (<T>(viewDefinition: ViewDefinition<T>, transformer?: any) => {
                const symbol = Symbol();
                mapViewMemory[symbol] = {
                    viewDefinition,
                    transformer
                };
                return symbol;
            }) as MapView;

            const mapQuery: MapQuery = <T, U>(queryDefinition: QueryDefinition<T, U>, handler) => {
                return async function _invokeQuery(...args) {
                    const parameters = handler(...args as any);
                    return (await compileQuery(stack, queryDefinition, parameters, undefined, context)).view;
                };
            };

            const ctx: ModelMapContext = {
                mapAction: (actionType: string, handler) => {
                    return async function _invokeAction(...args) {
                        const payload = handler(...args as any);
                        await executeAction(stack, definition.esDefinition.actions[actionType], payload);
                        await processModel();
                    };
                },
                mapView,
                mapQuery,
            };

            const baseModel: BaseModel<T> = {
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
    }
}