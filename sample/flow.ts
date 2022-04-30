import {
    flow,
    eval_step,
    FLOW_SYMBOL,
} from "../src/core/view";


export const exampleObj = {
    value: flow
        .default(false)
        .onEvent("TURN_ON").constant(true)
        .onEvent("TURN_OFF").if((x) => x.value === false).constant("FUCK")
        .onEvent("TURN_OFF").if((x) => x.value !== false).constant(false),
};

// console.log(exampleObj.value[FLOW_SYMBOL].flows);

const state1 = eval_step(exampleObj, {}, { triggerType: "init" });
const state2 = eval_step(exampleObj, state1, { triggerType: "event", eventType: "TURN_ON" });
const state3 = eval_step(exampleObj, state2, { triggerType: "event", eventType: "TURN_OFF" });

// console.log(state1, state2, state3);


const iter = flow.eval(exampleObj);
const dater = [
    iter.next(),
    // iter.next({ triggerType: "event", eventType: "TURN_ON" }),
    iter.next({ triggerType: "event", eventType: "TURN_OFF" }),
    iter.next({ triggerType: "event", eventType: "TURN_ON" }),
    iter.next({ triggerType: "event", eventType: "TURN_OFF" }),
];
console.log(dater);

