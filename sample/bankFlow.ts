import { esRepository } from "../src/lib";
import { local } from "../src";
import {
    bankAccountModel,
    bankAccountBalance,
} from "./shared/bankAccount";
import {
    flow,
} from "../src/core/view";

import { bankAccount } from "./shared/bankAccount";

const flowView = bankAccount.createFlow("balance", {
    balance: flow
        .default(0)
        .onEvent("DEPOSIT").add("amount")
        .onEvent("WITHDRAW").subtract("amount"),
    suspended: flow
        .default(false)
        .onEvent("SUSPEND").set("suspended"),
});

async function getBankAccount() {
    const store = local.localStore();
    const repo = esRepository(store, {});

    const bankAccount2 = await repo.findOrCreateModel("7891", bankAccountModel);

    if (bankAccount2.status.suspended) await bankAccount2.suspend(false);
    await bankAccount2.deposit(10);
    await bankAccount2.deposit(20);
    await bankAccount2.deposit(30);
    await bankAccount2.withdraw(30);
    console.log(bankAccount2);
    await bankAccount2.deposit(30);
    await bankAccount2.suspend(true);
    await bankAccount2.suspend(false);
    const stack = await store.getStack(bankAccountModel.esDefinition.type, "7891");
    const events = await stack.slice(0);
    console.log(events);

    const flowResult = await repo.findOrCreateView("7891", flowView);
    console.log(flowResult);

    const balanceResult = await repo.findOrCreateView("7891", bankAccountBalance);
    console.log(balanceResult);
}

getBankAccount().catch((err) => console.log(err));




