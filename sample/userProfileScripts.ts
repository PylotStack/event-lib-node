import { local } from "../src/index";
import { esRepository } from "../src/lib";
import { publicUserProfile, userProfileModel } from "./userProfile";

async function user() {
    const store = local.localStore();
    const repo = esRepository(store, {});

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

    const stack = await store.getStack(userProfileModel.definition.esDefinition.type, "a@a.com");
    const events = await stack.slice(0);
    console.log(events);
}

user().catch((err) => console.log(err));
