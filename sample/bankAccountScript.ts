import { ddbStore } from "../src/ddb";
import { esRepository } from "../src/lib";
import { bankAccountModel } from "./bankAccount";

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