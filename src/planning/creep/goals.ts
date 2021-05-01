import { Goal, IScreepGoals, gScreepState } from "planning/states";

const goalHarvestEnergy1: Goal<gScreepState> = {
  label: "Goal Harvest Energy 1",
  validate: (prevState: gScreepState, nextState: gScreepState): boolean => {
    return nextState.harvestedEnergy === true;
  },
  desirable: (currentState: gScreepState): number => {
    const value = currentState.role && currentState.role === "harvester" ? 1.0 : 0.0;
    return value;
  }
};

const goalUpgradeController1: Goal<gScreepState> = {
  label: "Goal Upgrade Controller 1",
  validate: (prevState: gScreepState, nextState: gScreepState): boolean => {
    return nextState.upgradeController === true;
  },
  desirable: (currentState: gScreepState): number => {
    const value = currentState.role && currentState.role === "upgrader" ? 1.0 : 0.0;
    return value;
  }
};

export const goals: IScreepGoals<gScreepState> = {
  goalHarvestEnergy1,
  goalUpgradeController1
};
