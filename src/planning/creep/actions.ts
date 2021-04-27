import { Action } from "../../components/Planner";
import { gScreepState } from "planning/states";

const FindCloseSourceToSpawnAction: Action<gScreepState> = {
    condition: (state: gScreepState): boolean => {
        return state.role === "harvester"
            && state.spawn_find === true
            && state.source_find !== true
    },
    effect: (state: gScreepState): gScreepState => {
        state.source_find = true
        return state
    },
    cost: (state: gScreepState) => 1,
    method_name: "FindCloseSourceToSpawn"
}

const MoveToSourceAction: Action<gScreepState> = {
    condition: (state: gScreepState): boolean => {
        return state.source_find === true
            && state.full_carry === false
            && state.is_near_of != "source"
    },
    effect: (state: gScreepState): gScreepState => {
        state.is_near_of = "source"
        return state
    },
    cost: (state: gScreepState) => 1,
    method_name: "MoveToSource"
}

const HarvestFromSourceAction: Action<gScreepState> = {
    condition: (state: gScreepState): boolean => {
        return state.source_find === true
            && state.is_near_of == "source"
    },
    effect: (state: gScreepState): gScreepState => {
        state.full_carry = true
        state.creep_energy = 1
        return state
    },
    cost: (state: gScreepState) => 1,
    method_name: "HarvestFromSource"
}

const FindCloseSpawnAction: Action<gScreepState> = {
    condition: (state: gScreepState): boolean => {
        return state.spawn_find !== true
    },
    effect: (state: gScreepState): gScreepState => {
        state.spawn_find = true
        return state
    },
    cost: (state: gScreepState) => 1,
    method_name: "FindCloseSpawn"
}

const MoveToSpawnAction: Action<gScreepState> = {
    condition: (state: gScreepState): boolean => {
        return state.spawn_find === true
            && state.is_near_of != "spawn"
    },
    effect: (state: gScreepState): gScreepState => {
        state.is_near_of = "spawn"
        return state
    },
    cost: (state: gScreepState) => 1,
    method_name: "MoveToSpawn"
}

const TransferEnergyToSpawnAction: Action<gScreepState> = {
    condition: (state: gScreepState): boolean => {
        return state.spawn_find === true
            && state.full_carry === true
            && (state.creep_energy || 0) > 0
            && state.is_near_of == "spawn"
    },
    effect: (state: gScreepState): gScreepState => {
        state.full_carry = false
        state.creep_energy = 0
        state.harvested_energy = true
        return state
    },
    cost: (state: gScreepState) => 1,
    method_name: "TransferEnergyToSpawn"
}

const WithdrawEnergyFromSpawnAction: Action<gScreepState> = {
    condition: (state: gScreepState): boolean => {
        return state.spawn_find === true
            && state.full_carry === false
            && state.is_near_of == "spawn"
    },
    effect: (state: gScreepState): gScreepState => {
        state.full_carry = true
        state.creep_energy = 1
        return state
    },
    cost: (state: gScreepState) => state.role == "upgrader" ? 1 : 4,
    method_name: "WithdrawEnergyFromSpawn"
}

const FindCloseControllerToSpawnAction: Action<gScreepState> = {
    condition: (state: gScreepState): boolean => {
        return state.role === "upgrader"
            && state.spawn_find === true
            && state.controller_find !== true
    },
    effect: (state: gScreepState): gScreepState => {
        state.controller_find = true
        return state
    },
    cost: (state: gScreepState) => 1,
    method_name: "FindCloseControllerToSpawn"
}

const MoveToControllerAction: Action<gScreepState> = {
    condition: (state: gScreepState): boolean => {
        return state.controller_find === true
            && state.full_carry === true
            && (state.creep_energy || 0) > 0
            && state.is_near_of != "controller"
    },
    effect: (state: gScreepState): gScreepState => {
        state.is_near_of = "controller"
        return state
    },
    cost: (state: gScreepState) => 1,
    method_name: "MoveToController"
}

const UpgradeControllerAction: Action<gScreepState> = {
    condition: (state: gScreepState): boolean => {
        return state.controller_find === true
            && state.full_carry === true
            && (state.creep_energy || 0) > 0
            && state.is_near_of == "controller"
    },
    effect: (state: gScreepState): gScreepState => {
        state.full_carry = false
        state.creep_energy = 0
        state.upgrade_controller = true
        return state
    },
    cost: (state: gScreepState) => 1,
    method_name: "UpgradeController"
}

interface IScreepActions {
    [key: string]: Action<gScreepState>
}

export const actions: IScreepActions = {
    "FindCloseSourceToSpawnAction": FindCloseSourceToSpawnAction,
    "MoveToSourceAction": MoveToSourceAction,
    "HarvestFromSourceAction": HarvestFromSourceAction,
    "FindCloseSpawnAction": FindCloseSpawnAction,
    "MoveToSpawnAction": MoveToSpawnAction,
    "TransferEnergyToSpawnAction": TransferEnergyToSpawnAction,
    "WithdrawEnergyFromSpawnAction": WithdrawEnergyFromSpawnAction,
    "FindCloseControllerToSpawnAction": FindCloseControllerToSpawnAction,
    "MoveToControllerAction": MoveToControllerAction,
    "UpgradeControllerAction": UpgradeControllerAction
}
