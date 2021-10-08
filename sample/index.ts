import { localStore } from "../src/local";
import { ddbStore } from "../src/ddb";
import { compileView, defineEventStack, esRepository } from "../src/lib";
import { ModelMapContext } from "../src/types";

interface BankAccountBalanceView {
    balance: number;
}

interface BankAccountStatusView {
    status: {
        suspended: boolean;
    };
}

interface UserSummaryView {
    isRegistered: boolean;
    isActivated: boolean;
}

interface UserPublicProfileView {
    name: string;
    startDate: string;
}

const bankAccount = defineEventStack("bank_account")
    .action("DEPOSIT", async function (context, payload) {
        const account = await context.views<BankAccountStatusView>([bankAccountStatus.definition]);
        if (account.status.suspended) return context.reject("ACCOUNT_SUSPENDED");
        if (payload.amount <= 0) return context.reject("AMOUNT_BELOW_ZERO");
        return context.commit();
    }).action("WITHDRAW", async function (context, payload) {
        if (payload.amount <= 0) return context.reject("AMOUNT_BELOW_ZERO");
        const account = await context.views<BankAccountBalanceView & BankAccountStatusView>([bankAccountBalance.definition, bankAccountStatus.definition]);
        if (account.status.suspended) return context.reject("ACCOUNT_SUSPENDED");
        if (account.balance < payload.amount) return context.reject("ACCOUNT_BALANCE_LOW");
        return context.commit();
    }).action("SUSPEND", async function (context, payload) {
        const view = await context.view(bankAccountStatus.definition);
        if (view.status.suspended === payload.suspended) return context.reject("NO_SUSPEND_CHANGE");
        return context.commit();
    });

const bankAccountBalance = bankAccount
    .createView<BankAccountBalanceView>("balance", { balance: 0 })
    .event("DEPOSIT", (stack, ev) => {
        return {
            ...stack,
            balance: stack.balance + ev.payload.amount,
        };
    }).event("WITHDRAW", (stack, ev) => {
        return {
            ...stack,
            balance: stack.balance - ev.payload.amount,
        };
    });

const bankAccountStatus = bankAccount
    .createView<BankAccountStatusView>("status", { status: { suspended: false } })
    .event("SUSPEND", (stack, ev) => {
        return {
            ...stack,
            status: {
                ...stack.status,
                suspended: ev.payload.suspended,
            },
        };
    });

const bankAccountModel = bankAccount.mapModel((ctx) => {
    return {
        deposit: ctx.mapAction("DEPOSIT", (amount: number) => ({ amount })),
        withdraw: ctx.mapAction("WITHDRAW", (amount: number) => ({ amount })),
        suspend: ctx.mapAction("SUSPEND", (suspend: boolean) => ({ suspended: suspend })),
        balance: ctx.mapView(bankAccountBalance.definition, "balance"),
        balanceView: ctx.mapView(bankAccountBalance.definition),
        balanceTransformer: ctx.mapView(bankAccountBalance.definition, (x) => x.balance.toString()),
        status: ctx.mapView(bankAccountStatus.definition, "status"),
    };
});

const userProfile = defineEventStack("user")
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

const summaryView = userProfile
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

const publicUserProfile = userProfile
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

const userProfileModel = userProfile.mapModel((ctx) => ({
    register: ctx.mapAction("REGISTER_ACCOUNT", (email: string, password: string, name: string) => ({ email, password, name })),
    activate: ctx.mapAction("ACTIVATE", () => ({})),
    deactivate: ctx.mapAction("DEACTIVATE", () => ({})),
    isRegistered: ctx.mapView(summaryView.definition, "isRegistered"),
    publicUserProfile: ctx.mapView(publicUserProfile.definition),
}));

async function getBankAccount() {
    // const store = localStore();
    const store = ddbStore();
    const repo = esRepository(store);
    const bankAccount2 = await repo.findOrCreateModel("123", bankAccountModel);

    if (bankAccount2.status.suspended) await bankAccount2.suspend(false);
    await bankAccount2.deposit(10);
    await bankAccount2.deposit(20);
    await bankAccount2.deposit(30);
    await bankAccount2.withdraw(30);
    console.log(bankAccount2);
    // await bankAccount2.suspend(true);
    await bankAccount2.deposit(30);
    const stack = await store.getStack("bank_account_123");
    const events = await stack.slice(0);
    console.log(events);
}

getBankAccount().catch((err) => console.log(err));

// async function user() {
//     const store = localStore();
//     const repo = esRepository(store);
//     const user = await repo.findOrCreateModel("a@a.com", userProfileModel);
//     if (user.isRegistered) throw new Error(`User already registered`);
//     await user.register("a@a.com", "123123", "Jimmy Bob");
//     console.log(user.publicUserProfile);
//     await user.deactivate();
//     console.log(user.publicUserProfile);
//     await user.activate();
//     await user._refresh();

//     const publicProfile = await repo.findOrCreateView("a@a.com", publicUserProfile);
//     console.log(publicProfile);

//     const stack = await store.getStack("user_a@a.com");
//     const events = await stack.slice(0);
//     console.log(events);
// }

// user().catch((err) => console.log(err));
