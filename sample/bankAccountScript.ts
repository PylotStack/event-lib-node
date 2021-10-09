import { ddbStore, ddbViewCache } from "../src/ddb";
import { esRepository } from "../src/lib";
import { localStore } from "../src/local";
import { bankAccountModel } from "./bankAccount";

async function getBankAccount() {
    const store = localStore();
    const repo = esRepository(store, {});
    // const store = ddbStore("sctrl2-events");
    // const repo = esRepository(store, {
    //     viewCache: ddbViewCache({
    //         namespace: "payments",
    //         tablename: "sctrl2-views"
    //     }),
    // });
    const bankAccount2 = await repo.findOrCreateModel("123", bankAccountModel);

    if (bankAccount2.status.suspended) await bankAccount2.suspend(false);
    await bankAccount2.deposit(10);
    await bankAccount2.deposit(20);
    await bankAccount2.deposit(30);
    await bankAccount2.withdraw(30);
    console.log(bankAccount2);
    // await bankAccount2.suspend(true);
    await bankAccount2.deposit(30);
    const stack = await store.getStack("bank_account(123)");
    const events = await stack.slice(0);
    console.log(events);
}

getBankAccount().catch((err) => console.log(err));