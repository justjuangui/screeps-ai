import { registerProcess } from "decorators/registerProcess";
import { Process, ProcessPriority, StateConstants } from "components/Process";
import { gScreepState } from "planning/states";
import * as CreepGoals from "../planning/creep/goals"
import * as CreepActions from "../planning/creep/actions"
import { sum } from "lodash";
import { Action } from "components/Planner";
import { log } from "lib/logger/log";
import { MessagePayload } from "components/Requestor";

@registerProcess
export class CreepProcess extends Process {
    public static start(creepName: string) {
        const proc = Process.startNewProcess(CreepProcess, 0, undefined, ProcessPriority.Normal)
        proc.memory.creepName = creepName
        proc.memory.stateName = `cstate_${creepName}`
        return proc.pid
    }

    public run(message: MessagePayload): MessagePayload[] | null {
        let creep = Game.creeps[this.memory.creepName]
        if (creep === undefined) {
            this.stop();
            return null;
        }
        if (creep.spawning) { return null }

        if (!creep.memory.role) {
            creep.memory.role = creep.name.substring(0, creep.name.indexOf("_"))
        }

        // recreate spawn State
        let state: gScreepState = this.getState<gScreepState>(this.memory.stateName)
        state.can_carry = creep.getActiveBodyparts(CARRY) > 0
        state.can_move = creep.getActiveBodyparts(MOVE) > 0
        state.can_work = creep.getActiveBodyparts(WORK) > 0
        state.role = creep.memory.role
        state.creep_energy = creep.carry.energy
        state.full_carry = creep.carryCapacity == sum(creep.carry)
        state.source_find = this.memory.source_id !== undefined
        state.spawn_find = this.memory.spawn_id !== undefined

        this.runGOAP(
            `  ${this.memory.creepName}`,
            [],
            CreepGoals.goals,
            state,
            CreepActions.actions,
            creep
        )

        return null;
    }

    public FindCloseSpawn(creep: Creep, oAction: Action<gScreepState>): number {
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS)
        if (spawn) {
            this.memory.spawn_id = spawn.id
            this.memory.spawn_path = undefined
            return 1
        }

        this.memory.spawn_id = null
        return -1
    }

    public FindCloseControllerToSpawn(creep: Creep, oAction: Action<gScreepState>): number {
        let spawn: StructureSpawn | null = Game.getObjectById(this.memory.spawn_id)
        if (!spawn) {
            log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`)
            return -1
        }

        let controller = spawn.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_CONTROLLER }
        })

        if (!controller) {
            log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found a close controller`)
            return -1
        }

        this.memory.controller_id = controller.id
        this.memory.controller_path = undefined
        return 1
    }

    public FindCloseSourceToSpawn(creep: Creep, oAction: Action<gScreepState>): number {
        let spawn: StructureSpawn | null = Game.getObjectById(this.memory.spawn_id)
        if (!spawn) {
            log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`)
            return -1
        }

        let source = spawn.pos.findClosestByPath(FIND_SOURCES)

        if (!source) {
            log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found a close source`)
            return -1
        }

        this.memory.source_id = source.id
        this.memory.source_path = undefined
        return 1
    }

    public MoveToController(creep: Creep, oAction: Action<gScreepState>): number {
        if (creep.fatigue != 0) {
            return 0
        }

        // First Found a Route to source
        let controller: StructureController | null = Game.getObjectById(this.memory.controller_id)
        if (!controller) {
            log.debug(`${this.memory.stateName}: Controller ${this.memory.controller_id} not found`)
            return -1
        }

        if (creep.pos.isNearTo(controller)) {
            return 1
        }

        if (!this.memory.controller_path) {
            let path = creep.pos.findPathTo(controller)
            this.memory.controller_path = path
            return 0
        }

        let path = this.memory.controller_path
        let res = creep.moveByPath(path)

        if (res == OK) {
            return 0
        }

        this.memory.controller_path = undefined
        log.debug(`${this.memory.stateName}: MoveToController_moveByPath ${res}`)
        return -1
    }

    public MoveToSource(creep: Creep, oAction: Action<gScreepState>): number {
        if (creep.fatigue != 0) {
            return 0
        }

        // First Found a Route to source
        let source: Source | null = Game.getObjectById(this.memory.source_id)
        if (!source) {
            log.debug(`${this.memory.stateName}: Source ${this.memory.source_id} not found`)
            return -1
        }

        if (creep.pos.isNearTo(source)) {
            return 1
        }

        if (!this.memory.source_path) {
            let path = creep.pos.findPathTo(source)
            this.memory.source_path = path
            return 0
        }

        let path = this.memory.source_path
        let res = creep.moveByPath(path)

        if (res == OK) {
            return 0
        }

        this.memory.source_path = undefined
        log.debug(`${this.memory.stateName}: MoveToSource_moveByPath ${res}`)
        return -1
    }

    public MoveToSpawn(creep: Creep, oAction: Action<gScreepState>): number {
        if (creep.fatigue != 0) {
            return 0
        }
        // First Found a Route to source
        let spawn: StructureSpawn | null = Game.getObjectById(this.memory.spawn_id)
        if (!spawn) {
            log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`)
            return -1
        }

        if (creep.pos.isNearTo(spawn)) {
            return 1
        }

        if (!this.memory.spawn_path) {
            let path = creep.pos.findPathTo(spawn)
            this.memory.spawn_path = path
            return 0
        }

        let path = this.memory.spawn_path
        let res = creep.moveByPath(path)

        if (res == OK) {
            return 0
        }

        this.memory.spawn_path = undefined
        log.debug(`${this.memory.stateName}: MoveToSpawn_moveByPath ${res}`)
        return -1
    }

    public UpgradeController(creep: Creep, oAction: Action<gScreepState>): number {
        let controller: StructureController | null = Game.getObjectById(this.memory.controller_id)
        if (!controller) {
            log.debug(`${this.memory.stateName}: Controller ${this.memory.controller_id} not found`)
            return -1
        }

        if (!creep.pos.isNearTo(controller)) {
            return -1
        }

        if (creep.carry.energy == 0) {
            return 1
        }

        let res = creep.upgradeController(controller)

        if (res == OK) {
            return 0
        }

        log.debug(`${this.memory.stateName}: UpgradeController_upgradeController ${res}`)
        return -1
    }

    public HarvestFromSource(creep: Creep, oAction: Action<gScreepState>): number {
        let source: Source | null = Game.getObjectById(this.memory.source_id)
        if (!source) {
            log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`)
            return -1
        }

        if (!creep.pos.isNearTo(source)) {
            return -1
        }

        if (creep.carryCapacity == sum(creep.carry)) {
            // Full Capacity
            return 1
        }

        let res = creep.harvest(source)

        if (res == OK) {
            return 0
        }

        log.debug(`${this.memory.stateName}: HarvestFromSource_harvest ${res}`)
        return -1
    }

    public TransferEnergyToSpawn(creep: Creep, oAction: Action<gScreepState>): number {
        let spawn: StructureSpawn | null = Game.getObjectById(this.memory.spawn_id)
        if (!spawn) {
            log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`)
            return -1
        }

        if (!creep.pos.isNearTo(spawn)) {
            return -1
        }

        if (spawn.energyCapacity == spawn.energy) {
            log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} Full`)
            return 0
        }

        if (creep.carry.energy == 0) {
            return 1
        }

        let res = creep.transfer(spawn, RESOURCE_ENERGY)

        if (res == OK) {
            return 0
        }

        log.debug(`${this.memory.stateName}: TransferEnergyToSpawn_transfer ${res}`)
        return -1
    }

    public WithdrawEnergyFromSpawn(creep: Creep, oAction: Action<gScreepState>): number {
        let spawn: StructureSpawn | null = Game.getObjectById(this.memory.spawn_id)
        if (!spawn) {
            log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`)
            return -1
        }

        if (!creep.pos.isNearTo(spawn)) {
            return -1
        }

        if (creep.carryCapacity == sum(creep.carry)) {
            return 1
        }

        if (spawn.energy == 0) {
            log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} Empty`)
            return 0
        }

        let res = creep.withdraw(spawn, RESOURCE_ENERGY)

        if (res == OK) {
            return 0
        }

        log.debug(`${this.memory.stateName}: WithdrawEnergyFromSpawn_withdraw ${res}`)
        return -1
    }
}
