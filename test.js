const { HOI4Simulation, HOI4ProductionLine } = require("./hoi4-simulation.js");

const research_queue = [
  { time: 78, research_bonus: 0.03, name: "Electronics" },
  {
    time: 249,
    base_factory_output: 0.15,
    prod_eff_cap: 0.15,
    name: "Dispersed industry I",
  },
];

const production = [
  new HOI4ProductionLine(undefined, {
    num_of_mils: 1,
    max_mils: 1,
  }),
  new HOI4ProductionLine(undefined, {
    num_of_mils: 1,
    max_mils: 1,
    equipment_name: "Support Eq.",
    equipment_cost: 4,
  }),
  new HOI4ProductionLine(undefined, {
    num_of_mils: 1,
    max_mils: 1,
    equipment_name: "Artillery",
    equipment_cost: 3.5,
  }),
  new HOI4ProductionLine(undefined, {
    num_of_mils: 0,
    max_mils: 1,
    equipment_name: "Anti-Air",
    equipment_cost: 4,
  }),
  new HOI4ProductionLine(undefined, {
    num_of_mils: 0,
    max_mils: 100,
  }),
];

const construction = [{ type: "mil", infr: 3, num: 100 }];

const pp_spend_queue = [{ cost: 150, name: "Fascist advisor" }];

const focus_queue = [];

sim = new HOI4Simulation({
  production,
  research_queue,
  construction,
  buildings: { civ: 9, mil: 3 },
  pp_spend_queue,
  stability: 0.57,
});
sim.start();
console.log(sim);
