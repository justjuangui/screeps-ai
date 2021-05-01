import { Action, IScreepActions, gScreepState } from "planning/states";

const FindCloseSourceToSpawnAction: Action<gScreepState> = {
  condition: (state: gScreepState): boolean => {
    return state.role === "harvester" && state.spawnFind === true && state.sourceFind !== true;
  },
  effect: (state: gScreepState): gScreepState => {
    state.sourceFind = true;
    return state;
  },
  cost: () => 1,
  methodName: "FindCloseSourceToSpawn"
};

const MoveToSourceAction: Action<gScreepState> = {
  condition: (state: gScreepState): boolean => {
    return state.sourceFind === true && state.fullCarry === false && state.isNearOf !== "source";
  },
  effect: (state: gScreepState): gScreepState => {
    state.isNearOf = "source";
    return state;
  },
  cost: () => 1,
  methodName: "MoveToSource"
};

const HarvestFromSourceAction: Action<gScreepState> = {
  condition: (state: gScreepState): boolean => {
    return state.sourceFind === true && state.isNearOf === "source";
  },
  effect: (state: gScreepState): gScreepState => {
    state.fullCarry = true;
    state.creepEnergy = 1;
    return state;
  },
  cost: () => 1,
  methodName: "HarvestFromSource"
};

const FindCloseSpawnAction: Action<gScreepState> = {
  condition: (state: gScreepState): boolean => {
    return state.spawnFind !== true;
  },
  effect: (state: gScreepState): gScreepState => {
    state.spawnFind = true;
    return state;
  },
  cost: () => 1,
  methodName: "FindCloseSpawn"
};

const MoveToSpawnAction: Action<gScreepState> = {
  condition: (state: gScreepState): boolean => {
    return state.spawnFind === true && state.isNearOf !== "spawn";
  },
  effect: (state: gScreepState): gScreepState => {
    state.isNearOf = "spawn";
    return state;
  },
  cost: () => 1,
  methodName: "MoveToSpawn"
};

const TransferEnergyToSpawnAction: Action<gScreepState> = {
  condition: (state: gScreepState): boolean => {
    return (
      state.spawnFind === true && state.fullCarry === true && (state.creepEnergy || 0) > 0 && state.isNearOf === "spawn"
    );
  },
  effect: (state: gScreepState): gScreepState => {
    state.fullCarry = false;
    state.creepEnergy = 0;
    state.harvestedEnergy = true;
    return state;
  },
  cost: () => 1,
  methodName: "TransferEnergyToSpawn"
};

const WithdrawEnergyFromSpawnAction: Action<gScreepState> = {
  condition: (state: gScreepState): boolean => {
    return state.spawnFind === true && state.fullCarry === false && state.isNearOf === "spawn";
  },
  effect: (state: gScreepState): gScreepState => {
    state.fullCarry = true;
    state.creepEnergy = 1;
    return state;
  },
  cost: (state: gScreepState) => (state.role === "upgrader" ? 1 : 4),
  methodName: "WithdrawEnergyFromSpawn"
};

const FindCloseControllerToSpawnAction: Action<gScreepState> = {
  condition: (state: gScreepState): boolean => {
    return state.role === "upgrader" && state.spawnFind === true && state.controllerFind !== true;
  },
  effect: (state: gScreepState): gScreepState => {
    state.controllerFind = true;
    return state;
  },
  cost: () => 1,
  methodName: "FindCloseControllerToSpawn"
};

const MoveToControllerAction: Action<gScreepState> = {
  condition: (state: gScreepState): boolean => {
    return (
      state.controllerFind === true &&
      state.fullCarry === true &&
      (state.creepEnergy || 0) > 0 &&
      state.isNearOf !== "controller"
    );
  },
  effect: (state: gScreepState): gScreepState => {
    state.isNearOf = "controller";
    return state;
  },
  cost: () => 1,
  methodName: "MoveToController"
};

const UpgradeControllerAction: Action<gScreepState> = {
  condition: (state: gScreepState): boolean => {
    return (
      state.controllerFind === true &&
      state.fullCarry === true &&
      (state.creepEnergy || 0) > 0 &&
      state.isNearOf === "controller"
    );
  },
  effect: (state: gScreepState): gScreepState => {
    state.fullCarry = false;
    state.creepEnergy = 0;
    state.upgradeController = true;
    return state;
  },
  cost: () => 1,
  methodName: "UpgradeController"
};

export const actions: IScreepActions<gScreepState> = {
  FindCloseSourceToSpawnAction,
  MoveToSourceAction,
  HarvestFromSourceAction,
  FindCloseSpawnAction,
  MoveToSpawnAction,
  TransferEnergyToSpawnAction,
  WithdrawEnergyFromSpawnAction,
  FindCloseControllerToSpawnAction,
  MoveToControllerAction,
  UpgradeControllerAction
};
