class HOI4Simulation {
  constructor(opts = {}) {
    // Constants
    this.trade_laws = {
      "Free Trade": {
        factory_output: 0.15,
        construction_speed: 0.15,
        research_speed: 0.1,
      },
      "Export Focus": {
        factory_output: 0.1,
        construction_speed: 0.1,
        research_speed: 0.5,
      },
      "Limited Exports": {
        factory_output: 0.5,
        construction_speed: 0.5,
        research_speed: 0.1,
      },
      "Closed Economy": {},
    };
    this.economy_laws = {
      "Civilian Economy": {
        consumer_goods: 0.35,
        construction_speed: { civ: -0.3, mil: -0.3 },
      },
      "Early Mobilization": {
        consumer_goods: 0.3,
        construction_speed: { civ: -0.1, mil: -0.1 },
      },
      "Partial Mobilization": {
        consumer_goods: 0.25,
        construction_speed: { mil: 0.1 },
      },
      "War Economy": {
        consumer_goods: 0.2,
        construction_speed: { mil: 0.2 },
      },
      "Total Mobilization": {
        consumer_goods: 0.1,
        construction_speed: { mil: 0.3 },
      },
    };

    // Minor values
    this.stability = opts.stability || 0.5;
    this.parties = opts.parties || {
      communism: 0,
      fascism: 0,
      democratic: 0,
      neutral: 100,
    };
    this.war_support = opts.war_support || 0.5;
    this.advisors = opts.advisors || [];
    this.trade_law = opts.trade_law || this.trade_laws["Export Focus"];
    this.economy_law =
      opts.economy_law || this.economy_laws["Civilian Economy"];

    // Research
    this.research_queue = opts.research_queue || [];
    this.research_speed = opts.research_speed || 0;
    this.research_slots = opts.research_slots || 3;

    // Construction
    this.construction = opts.construction || [];
    this.base_construction_speed = 0;
    this.buildings = opts.buildings || [];
    this.base_consumer_goods = opts.consumer_goods || 0;
    this.update_total_consumer_goods();
    this.building_types = {
      mil: { cost: 7200 },
      civ: { cost: 10800 },
    };

    // Production
    this.production =
      opts.production.map((p) => {
        p.sim = this;
        return p;
      }) || [];
    this.base_factory_output = opts.base_factory_output || 4.5;
    this.prod_eff_cap = opts.prod_eff_cap || 0.5;
    this.factory_output_modifiers = opts.factory_output_modifiers || 0.1;
    this.update_total_factory_output();
    this.stockpile = opts.stockpile || {};

    // Political power
    this.pp = opts.pp || 0;
    this.base_pp_growth = opts.pp_grow_speed || 2;
    this.update_total_pp_growth();
    this.pp_spend_queue = opts.pp_spend_queue || [];

    // Date
    this.date = opts.date || new Date("1936-01-01");
    this.end_date = opts.end_date || new Date("1938-01-01");
  }

  start() {
    for (;;) {
      this.production.forEach((prod) => {
        this.stockpile[prod.equipment_name] ||= 0;
        this.stockpile[prod.equipment_name] += prod.day();
      });

      this.research();
      this.construct();
      this.spend_pp();

      this.pp += this.total_pp_growth;

      this.date.setDate(this.date.getDate() + 1);

      if (this.date.getTime() >= this.end_date.getTime()) break;
    }
  }

  log(msg) {
    console.log(`${this.date.toDateString()}: ${msg}`);
  }

  research() {
    // TODO: update this shitcode
    this.research_queue.slice(0, this.research_slots).forEach((r, i) => {
      r.time -= 1 + this.trade_law.research_speed + this.research_speed;
      if (r.time <= 0) {
        this.log(`Research complete! Research name: ${r.name}`);

        if (r.research_speed) this.research_speed += r.research_speed;
        if (r.base_output) this.base_factory_output += r.base_factory_output;
        if (r.prod_eff_cap) this.prod_eff_cap += r.prod_eff_cap;
      }
    });

    this.research_queue = this.research_queue.filter((r) => r.time > 0);
  }

  construct() {
    const usable_civs =
      this.buildings.civ -
      Math.trunc(
        (this.buildings.civ + this.buildings.mil) * this.total_consumer_goods
      );

    this.construction.slice(0, Math.ceil(usable_civs / 20)).forEach((c, i) => {
      c.cost ||= this.building_types[c.type].cost;

      const infr_bonus = 1 + c.infr * 0.2; // max effect/max level
      const civs_used = Math.min(usable_civs - i * 20, 20);

      c.cost -=
        civs_used *
        infr_bonus *
        5 *
        (1 + this.total_construction_speed(c.type));

      // Return if nothing built
      if (c.cost > 0) return;

      this.log(`Built one ${c.type}`);
      c.num -= 1;
      c.cost = this.building_types[c.type].cost;
      this.buildings[c.type] ||= 0;
      this.buildings[c.type] += 1;

      // Update production lines
      if (c.type != "mil") return;

      this.production.forEach((p, i) => {
        if (p.num_of_mils == p.max_mils) return;

        p.num_of_mils += 1;
        p.prod_eff = (0.1 + p.prod_eff * (p.num_of_mils - 1)) / p.num_of_mils; // average eff
      });
    });

    this.construction = this.construction.filter((c) => c.num > 0);
  }

  spend_pp() {
    // TODO: add more
    const allowed_keys = [
      "consumer_goods",
      "construction_speed",
      "base_output",
      "prod_eff_cap",
      "communism_boost",
      "fascism_boost",
      "democratic_boost",
      "neutrality_boost",
      "pp_grow_speed",
    ];

    const action = this.pp_spend_queue[0];

    if (!action || action.cost > this.pp) return;

    this.log(`Spent ${action.cost} on ${action.name}`);
    this.pp_spend_queue.splice(0, 1);
    this.pp -= action.cost;

    Object.entries(action).forEach(([k, v]) => {
      if (!allowed_keys.includes(k)) return;

      this[k] = v;
    });
  }

  // Update on every base consumer goods, economy law or stability change
  update_total_consumer_goods() {
    this.total_consumer_goods =
      this.base_consumer_goods +
      this.economy_law.consumer_goods -
      (this.stability > 0.5 ? 0.4 * this.stability - 0.2 : 0);
  }

  total_construction_speed(type) {
    return (
      this.base_construction_speed +
      this.trade_law.construction_speed +
      this.economy_law.construction_speed[type]
    );
  }

  // Update on every stability change or focus selection
  update_total_pp_growth() {
    this.total_pp_growth =
      this.base_pp_growth -
      (this.focus ? 1 : 0) +
      (this.stability > 0.5
        ? 0.2 * this.stability - 0.1
        : this.stability - 0.5);
  }

  // Update on every base factory output, factory output modifiers, trade law or stability change
  update_total_factory_output() {
    this.total_factory_output =
      this.base_factory_output *
      (1 +
        this.factory_output_modifiers +
        this.trade_law.factory_output +
        (this.stability > 0.5
          ? 0.4 * this.stability - 0.2
          : this.stability - 0.5));
  }
}

class HOI4ProductionLine {
  constructor(sim, opts = {}) {
    this.prod_eff = opts.prod_eff || 0.1;
    this.num_of_mils = opts.num_of_mils || 1;
    this.max_mils = opts.max_mils || 1;
    this.equipment_name = opts.equipment_name || "Infantry Equipment I";
    this.equipment_cost = opts.equipment_cost || 0.5;

    this.sim = sim;
  }

  day() {
    if (this.prod_eff < sim.prod_eff_cap) {
      this.prod_eff += (0.001 * sim.prod_eff_cap ** 2) / this.prod_eff;

      if (this.prod_eff > sim.prod_eff_cap) this.prod_eff = sim.prod_eff_cap;
    }

    return (
      (this.num_of_mils * sim.total_factory_output * this.prod_eff) /
      this.equipment_cost
    );
  }
}

module.exports = {
  HOI4Simulation,
  HOI4ProductionLine,
};
