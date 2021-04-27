import { Goal } from "../../components/Planner";
import { gScreepState } from "planning/states";
import { log } from "lib/logger/log";

const goal_harvest_energy_1: Goal<gScreepState> = {
    label: "Goal Harvest Energy 1",
    validate: (prevState: gScreepState, nextState: gScreepState): boolean => {
        //log.debug(`goal_harvester_1: state ${JSON.stringify(currentState)}`)
        //log.debug(`goal_harvest_energy_1: nextState ${JSON.stringify(nextState)}`)
        return nextState.harvested_energy == true
    },
    desirable: (currentState: gScreepState): number => {
        let value = currentState.role && currentState.role == "harvester" ? 1.0 : 0.0
        return value
    }
}

const goal_upgrade_controller_1: Goal<gScreepState> = {
    label: "Goal Upgrade Controller 1",
    validate: (prevState: gScreepState, nextState: gScreepState): boolean => {
        return nextState.upgrade_controller == true
    },
    desirable: (currentState: gScreepState): number => {
        let value = currentState.role && currentState.role == "upgrader" ? 1.0 : 0.0
        return value
    }
}

export const goals = {
    "goal_harvest_energy_1": goal_harvest_energy_1,
    "goal_upgrade_controller_1": goal_upgrade_controller_1
}
