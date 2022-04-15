import { localStore } from "../src/local";
import { defineEventStack, esRepository } from "../src/lib";

interface UserSummaryView {
    isRegistered: boolean;
    isActivated: boolean;
}

interface UserPublicProfileView {
    name: string;
    startDate: string;
}

export const userProfile = defineEventStack("user")
    .action("REGISTER_ACCOUNT", async (ctx, payload) => {
        const user = await ctx.view(summaryView.definition);
        if (user.isRegistered) return ctx.reject("ALREADY_REGISTERED");
        if (!payload.email) return ctx.reject("MISSING_EMAIL");
        if (!payload.password) return ctx.reject("MISSING_PASSWORD");

        return ctx.commit({
            ...payload,
            password: `HASH_${payload.password}`,
            registrationDate: (new Date()).toISOString(),
        });
    })
    .action("DEACTIVATE", (ctx) => ctx.commit({}))
    .action("ACTIVATE", (ctx) => ctx.commit({}));

export const summaryView = userProfile
    .createView<UserSummaryView>("summary_view", { isRegistered: false, isActivated: false, })
    .event("REGISTER_ACCOUNT", (state, ev) => ({
        ...state,
        isRegistered: true,
        isActivated: true,
    }))
    .event("DEACTIVATE", (state, ev) => ({
        ...state,
        isActivated: false,
    }))
    .event("ACTIVATE", (state, ev) => ({
        ...state,
        isActivated: true,
    }));

export const publicUserProfile = userProfile
    .createView<UserPublicProfileView>("public_profile", { name: "", startDate: "" })
    .withView(summaryView.definition)
    .event("REGISTER_ACCOUNT", (state, ev) => ({
        ...state,
        name: ev.payload.name,
        startDate: ev.payload.registrationDate,
    }))
    .finalizer(function (state) {
        if (!state.isRegistered || !state.isActivated) return {};

        return {
            name: state.name,
            startDate: state.startDate,
        };
    });

export const userProfileModel = userProfile.mapModel((ctx) => ({
    register: ctx.mapAction("REGISTER_ACCOUNT", (email: string, password: string, name: string) => ({ email, password, name })),
    activate: ctx.mapAction("ACTIVATE", () => ({})),
    deactivate: ctx.mapAction("DEACTIVATE", () => ({})),
    isRegistered: ctx.mapView(summaryView.definition, "isRegistered"),
    publicUserProfile: ctx.mapView(publicUserProfile.definition),
}));
