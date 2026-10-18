// Provisional single-player rules. These are tuning defaults, not claimed exact live-game values.
export const RESOURCE_KEYS = Object.freeze(["ore", "crystal", "hydrogen"]);

export const BUILDINGS = Object.freeze({
  capitol: {
    id: "capitol", name: "Capitol", cost: { ore: 400, crystal: 200, hydrogen: 0 },
    baseSeconds: 12, growth: 1.65, prerequisite: null, description: "Coordinates planetary development."
  },
  oreMine: {
    id: "oreMine", name: "Ore Mine", cost: { ore: 60, crystal: 15, hydrogen: 0 },
    baseSeconds: 8, growth: 1.5, prerequisite: null, production: { ore: 30 }, energyUse: 10,
    description: "Extracts ore for construction."
  },
  crystalMine: {
    id: "crystalMine", name: "Crystal Mine", cost: { ore: 48, crystal: 24, hydrogen: 0 },
    baseSeconds: 8, growth: 1.55, prerequisite: null, production: { crystal: 20 }, energyUse: 10,
    description: "Extracts crystal for advanced construction and research."
  },
  hydrogenSynthesizer: {
    id: "hydrogenSynthesizer", name: "Hydrogen Synthesizer", cost: { ore: 225, crystal: 75, hydrogen: 0 },
    baseSeconds: 15, growth: 1.55, prerequisite: null, production: { hydrogen: 10 }, energyUse: 20,
    description: "Produces hydrogen for ships and fleet operations."
  },
  solarPlant: {
    id: "solarPlant", name: "Solar Plant", cost: { ore: 75, crystal: 30, hydrogen: 0 },
    baseSeconds: 8, growth: 1.5, prerequisite: null, energyProduction: 35,
    description: "Supplies energy to planetary industry."
  },
  storageDepot: {
    id: "storageDepot", name: "Storage Depot", cost: { ore: 1000, crystal: 0, hydrogen: 0 },
    baseSeconds: 18, growth: 1.8, prerequisite: null, storage: 10000,
    description: "Increases planetary resource storage."
  },
  roboticsFactory: {
    id: "roboticsFactory", name: "Robotics Factory", cost: { ore: 400, crystal: 120, hydrogen: 200 },
    baseSeconds: 18, growth: 1.7, prerequisite: { building: "capitol", level: 1 },
    description: "Supports planetary construction."
  },
  researchLab: {
    id: "researchLab", name: "Research Lab", cost: { ore: 200, crystal: 400, hydrogen: 200 },
    baseSeconds: 18, growth: 1.6, prerequisite: { building: "capitol", level: 1 },
    description: "Enables research projects."
  },
  shipyard: {
    id: "shipyard", name: "Shipyard", cost: { ore: 400, crystal: 200, hydrogen: 100 },
    baseSeconds: 18, growth: 1.6, prerequisite: { building: "capitol", level: 1 },
    description: "Constructs ships."
  },
  foundry: {
    id: "foundry", name: "Foundry", cost: { ore: 1200, crystal: 800, hydrogen: 400 },
    baseSeconds: 30, growth: 1.8, prerequisite: { building: "roboticsFactory", level: 2 },
    description: "Supports advanced planetary construction."
  }
});

export const RESEARCH = Object.freeze({
  energyTechnology: {
    id: "energyTechnology", name: "Energy Technology", cost: { ore: 0, crystal: 800, hydrogen: 400 },
    baseSeconds: 24, growth: 1.8, requirements: { building: "researchLab", level: 1 },
    description: "Improves energy systems and unlocks later technologies."
  },
  combustionDrive: {
    id: "combustionDrive", name: "Combustion Drive", cost: { ore: 400, crystal: 0, hydrogen: 600 },
    baseSeconds: 24, growth: 1.7, requirements: { building: "researchLab", level: 1 },
    description: "Improves propulsion for basic fleets."
  },
  weaponsTechnology: {
    id: "weaponsTechnology", name: "Weapons Technology", cost: { ore: 800, crystal: 200, hydrogen: 0 },
    baseSeconds: 30, growth: 1.8, requirements: { building: "researchLab", level: 1 },
    description: "Increases fleet weapon strength."
  },
  shieldingTechnology: {
    id: "shieldingTechnology", name: "Shielding Technology", cost: { ore: 200, crystal: 800, hydrogen: 0 },
    baseSeconds: 30, growth: 1.8, requirements: { building: "researchLab", level: 1 },
    description: "Improves fleet shields."
  },
  armorTechnology: {
    id: "armorTechnology", name: "Armor Technology", cost: { ore: 1000, crystal: 0, hydrogen: 0 },
    baseSeconds: 30, growth: 1.8, requirements: { building: "researchLab", level: 1 },
    description: "Improves fleet hull durability."
  },
  espionageTechnology: {
    id: "espionageTechnology", name: "Espionage Technology", cost: { ore: 200, crystal: 1000, hydrogen: 200 },
    baseSeconds: 36, growth: 1.8, requirements: { building: "researchLab", level: 2 },
    description: "Improves intelligence gathering."
  },
  astrophysics: {
    id: "astrophysics", name: "Astrophysics", cost: { ore: 400, crystal: 800, hydrogen: 1600 },
    baseSeconds: 42, growth: 1.8, requirements: { building: "researchLab", level: 2 },
    description: "Enables expansion to additional colonies."
  }
});

export const SHIPS = Object.freeze({
  lightFighter: {
    id: "lightFighter", name: "Light Fighter", role: "Combat", cost: { ore: 300, crystal: 100, hydrogen: 0 },
    baseSeconds: 12, requirements: { building: "shipyard", level: 1 },
    hull: 400, shield: 10, weapon: 50, debrisOre: 100, debrisCrystal: 33,
    cargo: 50, speed: 12500, fuel: 10, description: "A basic combat ship."
  },
  smallCargo: {
    id: "smallCargo", name: "Small Cargo", role: "Transport", cost: { ore: 2000, crystal: 2000, hydrogen: 0 },
    baseSeconds: 20, requirements: { building: "shipyard", level: 2 }, research: { combustionDrive: 2 },
    hull: 4000, shield: 10, weapon: 5, debrisOre: 500, debrisCrystal: 500,
    cargo: 5000, speed: 5000, fuel: 20, description: "Moves resources and carries mission cargo."
  },
  espionageProbe: {
    id: "espionageProbe", name: "Espionage Probe", role: "Espionage", cost: { ore: 0, crystal: 1000, hydrogen: 0 },
    baseSeconds: 12, requirements: { building: "shipyard", level: 1 },
    hull: 100, shield: 0, weapon: 0, debrisOre: 0, debrisCrystal: 0,
    cargo: 0, speed: 100000000, fuel: 1, description: "Gathers intelligence about a target."
  },
  recycler: {
    id: "recycler", name: "Recycler", role: "Harvest", cost: { ore: 10000, crystal: 6000, hydrogen: 2000 },
    baseSeconds: 30, requirements: { building: "shipyard", level: 2 }, research: { combustionDrive: 2 },
    hull: 16000, shield: 10, weapon: 1, debrisOre: 2000, debrisCrystal: 1200,
    cargo: 20000, capacity: 20000, speed: 2000, fuel: 300, description: "Collects ore and crystal from debris fields."
  },
  colonyShip: {
    id: "colonyShip", name: "Colony Ship", role: "Colonization", cost: { ore: 10000, crystal: 20000, hydrogen: 10000 },
    baseSeconds: 45, requirements: { building: "shipyard", level: 4 }, research: { astrophysics: 1 },
    hull: 30000, shield: 100, weapon: 50, debrisOre: 2500, debrisCrystal: 5000,
    cargo: 7500, speed: 2500, fuel: 1000, description: "Establishes a colony at an available location."
  }
});

export const MISSIONS = Object.freeze({
  attack: { id: "attack", name: "Attack", returnFactor: 2 },
  espionage: { id: "espionage", name: "Espionage", returnFactor: 2 },
  transport: { id: "transport", name: "Transport", returnFactor: 2 },
  harvest: { id: "harvest", name: "Harvest", returnFactor: 2 },
  colonize: { id: "colonize", name: "Colonize", returnFactor: 2 }
});

export const GAME_RULES = Object.freeze({
  version: "single-player-prototype-1",
  defaultStorage: 10000,
  energyPerSolarLevel: 35,
  plunderFraction: 0.5,
  debrisFraction: 0.3,
  flightSecondsPerCoordinate: 8,
  fuelPerDistanceUnit: 0.1,
  roundTripFuelMultiplier: 2,
  minimumFlightSeconds: 5,
  combatRounds: 6,
  npcRespawnSeconds: 3600,
  researchCombatBonusPerLevel: 0.1
});
