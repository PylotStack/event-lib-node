import {bankAccountModel} from "../shared/bankAccount";
import {esRepository} from "../../src/index";
import {fsStore, naiveFsStack} from "../../src/storage/fs";

async function main() {
    const store = fsStore({directory: "./data"});
    const repository = esRepository(store);
    const bankAccount = await repository.findOrCreateModel("1", bankAccountModel);

    await bankAccount.deposit(100);
    await bankAccount.deposit(100);
    await bankAccount.withdraw(50);

}

main().catch(console.error);