import "jest";
import { stack } from "../src/testUtils";
import { bankAccount, bankAccountBalance } from "./bankAccount";

it("should deposit 10 dollars",
    stack(bankAccount.definition)

        .onAction("DEPOSIT", { amount: 10 })
        .commit()
        .assertView(bankAccountBalance.definition, { balance: 10 })

        .onAction("WITHDRAW", { amount: 15 })
        .reject("ACCOUNT_BALANCE_LOW")
        .assertView(bankAccountBalance.definition, { balance: 10 })

        .onAction("WITHDRAW", { amount: 5 })
        .commit()
        .assertView(bankAccountBalance.definition, { balance: 5 })
);