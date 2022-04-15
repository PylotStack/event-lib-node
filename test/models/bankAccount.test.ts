import "jest";
import { stack } from "../../src/testUtils";
import { bankAccount, bankAccountBalance } from "./bankAccount";

it("Should deposit 10, reject withdraw 15, commit withdraw 5",
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

it("Should handle multiple deposits and withdrawls",
    stack(bankAccount.definition)
        .assertView(bankAccountBalance.definition, { balance: 0 })

        .onAction("DEPOSIT", { amount: 5 })
        .assertView(bankAccountBalance.definition, { balance: 5 })
        .onAction("DEPOSIT", { amount: 5 })
        .assertView(bankAccountBalance.definition, { balance: 10 })
        .onAction("DEPOSIT", { amount: 5 })
        .assertView(bankAccountBalance.definition, { balance: 15 })

        .onAction("WITHDRAW", { amount: 5 })
        .assertView(bankAccountBalance.definition, { balance: 10 })
        .onAction("WITHDRAW", { amount: 5 })
        .assertView(bankAccountBalance.definition, { balance: 5 })
        .onAction("WITHDRAW", { amount: 5 })
        .assertView(bankAccountBalance.definition, { balance: 0 })
);

it("Should fail on small withdrawl",
    stack(bankAccount.definition)
        .assertView(bankAccountBalance.definition, { balance: 0 })

        .onAction("WITHDRAW", { amount: 0.01 })
        .reject("ACCOUNT_BALANCE_LOW")
        .assertView(bankAccountBalance.definition, { balance: 0 })
);

it("Should fail on negative withdrawl",
    stack(bankAccount.definition)
        .assertView(bankAccountBalance.definition, { balance: 0 })

        .onAction("WITHDRAW", { amount: -0.01 })
        .reject("AMOUNT_BELOW_ZERO")
        .assertView(bankAccountBalance.definition, { balance: 0 })
);

it("Should handle suspensions",
    stack(bankAccount.definition)
        .onAction("DEPOSIT", { amount: 10 })
        .assertView(bankAccountBalance.definition, { balance: 10 })
        .onAction("SUSPEND", {suspended: true})

        .onAction("WITHDRAW", { amount: 1 })
        .reject("ACCOUNT_SUSPENDED")
        .assertView(bankAccountBalance.definition, { balance: 10 })

        .onAction("DEPOSIT", { amount: 1 })
        .reject("ACCOUNT_SUSPENDED")
        .assertView(bankAccountBalance.definition, { balance: 10 })

        .onAction("SUSPEND", {suspended: false})

        .onAction("WITHDRAW", { amount: 1 })
        .commit()
        .assertView(bankAccountBalance.definition, { balance: 9 })

        .onAction("DEPOSIT", { amount: 1 })
        .commit()
        .assertView(bankAccountBalance.definition, { balance: 10 })
);
