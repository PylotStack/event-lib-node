import { localStore } from "../src/local";
import { esRepository } from "../src/lib";
import { publicUserProfile, userProfileModel } from "./userProfile";
import { ddbStore, ddbViewCache } from "../src/ddb";

async function user() {
    // const store = localStore();
    // const repo = esRepository(store, {});

    const store = ddbStore("sctrl2-events");
    const repo = esRepository(store, {
        viewCache: ddbViewCache({
            namespace: "identity",
            tablename: "sctrl2-views"
        }),
    });

    const user = await repo.findOrCreateModel("a@a.com", userProfileModel);
    if (user.isRegistered) throw new Error(`User already registered`);
    await user.register("a@a.com", "123123", "Jimmy Bob");
    console.log(user.publicUserProfile);
    await user.deactivate();
    console.log(user.publicUserProfile);
    await user.activate();
    await user._refresh();

    const publicProfile = await repo.findOrCreateView("a@a.com", publicUserProfile);
    console.log(publicProfile);

    const stack = await store.getStack("user(a@a.com)");
    const events = await stack.slice(0);
    console.log(events);
}

user().catch((err) => console.log(err));
