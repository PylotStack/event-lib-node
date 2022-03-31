import { defineEventStack } from "../src/lib";

interface BankAccountBalanceView {
    balance: number;
}

interface BankAccountStatusView {
    status: {
        suspended: boolean;
    };
}

export const bankAccount = defineEventStack("bank_account")
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

export const bankAccountBalance = bankAccount
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

export const depositsGreaterThanQuery = bankAccount
    .createQuery<{ amount: number }>("deposits_greater_than", { deposits: [] })
    .event("DEPOSIT", (stack, ev, parameters) => {
        if (ev.payload.amount <= parameters.amount) return stack;

        return {
            ...stack,
            deposits: [...stack.deposits, ev.payload],
        };
    });

export const bankAccountStatus = bankAccount
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

export const bankAccountModel = bankAccount.mapModel((ctx) => {
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
