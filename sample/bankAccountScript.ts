import { esRepository } from "../src/lib";
import { localStore, localViewCache } from "../src/local";
import { localStack } from "../src/local";
import { bankAccountModel, depositsGreaterThanQuery } from "./bankAccount";

async function getBankAccount() {
    const _localViewCache = localViewCache();


    const store = localStore();
    const repo = esRepository(store, {});

    const bankAccount2 = await repo.findOrCreateModel("7891", bankAccountModel);

    if (bankAccount2.status.suspended) await bankAccount2.suspend(false);
    await bankAccount2.deposit(10);
    await bankAccount2.deposit(20);
    await bankAccount2.deposit(30);
    await bankAccount2.withdraw(30);
    console.log(bankAccount2);
    await bankAccount2.deposit(30);
    const stack = await store.getStack(bankAccountModel.definition.esDefinition.type, "7891");
    const events = await stack.slice(0);
    console.log(events);

    const greaterThan15 = await repo.findOrCreateQuery("7891", depositsGreaterThanQuery, { amount: 15 });
    console.log(greaterThan15);
    const gt152 = await bankAccount2.depositsGreaterThan(15);
    console.log(gt152);
}

getBankAccount().catch((err) => console.log(err));