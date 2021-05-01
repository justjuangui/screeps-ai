/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-shadow */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as CreepActions from "../planning/creep/actions";
import * as CreepGoals from "../planning/creep/goals";
import { Action, gScreepState } from "planning/states";
import { Process, ProcessPriority } from "components/Process";
import { MessagePayload } from "components/Requestor";
import { log } from "lib/logger/log";
import { registerProcess } from "decorators/registerProcess";

@registerProcess
export class CreepProcess extends Process {
  public static start(creepName: string): number {
    const proc = Process.startNewProcess(CreepProcess, 0, undefined, ProcessPriority.Normal);
    proc.memory.creepName = creepName;
    proc.memory.stateName = `cstate_${creepName}`;
    return proc.pid;
  }

  public run(_message: MessagePayload): MessagePayload[] | null {
    const creep: Creep = Game.creeps[this.memory.creepName as string];
    if (creep === undefined) {
      this.stop();
      return null;
    }
    if (creep.spawning) {
      return null;
    }

    if (!creep.memory.role) {
      creep.memory.role = creep.name.substring(0, creep.name.indexOf("_"));
    }

    // recreate spawn State
    const state: gScreepState = this.getState<gScreepState>(this.memory.stateName as string);
    state.canCarry = creep.getActiveBodyparts(CARRY) > 0;
    state.canMove = creep.getActiveBodyparts(MOVE) > 0;
    state.canWork = creep.getActiveBodyparts(WORK) > 0;
    state.role = creep.memory.role;
    state.creepEnergy = creep.store.energy;
    state.fullCarry = creep.store.getFreeCapacity() === 0;
    state.sourceFind = this.memory.source_id !== undefined;
    state.spawnFind = this.memory.spawn_id !== undefined;

    this.runGOAP(`  ${this.memory.creepName as string}`, [], CreepGoals.goals, state, CreepActions.actions, creep);

    return null;
  }

  public FindCloseSpawn(creep: Creep, _oAction: Action<gScreepState>): number {
    const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
    if (spawn) {
      this.memory.spawnId = spawn.id;
      this.memory.spawnPath = undefined;
      return 1;
    }

    this.memory.spawnId = null;
    return -1;
  }

  public FindCloseControllerToSpawn(_creep: Creep, _oAction: Action<gScreepState>): number {
    const spawn: StructureSpawn | null = Game.getObjectById(this.memory.spawn_id);
    if (!spawn) {
      log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`);
      return -1;
    }

    const controller = spawn.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_CONTROLLER }
    });

    if (!controller) {
      log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found a close controller`);
      return -1;
    }

    this.memory.controllerId = controller.id;
    this.memory.controllerPath = undefined;
    return 1;
  }

  public FindCloseSourceToSpawn(_creep: Creep, _oAction: Action<gScreepState>): number {
    const spawn: StructureSpawn | null = Game.getObjectById(this.memory.spawn_id);
    if (!spawn) {
      log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`);
      return -1;
    }

    const source = spawn.pos.findClosestByPath(FIND_SOURCES);

    if (!source) {
      log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found a close source`);
      return -1;
    }

    this.memory.sourceId = source.id;
    this.memory.sourcePath = undefined;
    return 1;
  }

  public MoveToController(creep: Creep, _oAction: Action<gScreepState>): number {
    if (creep.fatigue !== 0) {
      return 0;
    }

    // First Found a Route to source
    const controller: StructureController | null = Game.getObjectById(this.memory.controller_id);
    if (!controller) {
      log.debug(`${this.memory.stateName}: Controller ${this.memory.controller_id} not found`);
      return -1;
    }

    if (creep.pos.isNearTo(controller)) {
      return 1;
    }

    if (!this.memory.controllerPath) {
      const path = creep.pos.findPathTo(controller);
      this.memory.controllerPath = path;
      return 0;
    }

    const path = this.memory.controllerPath;
    const res = creep.moveByPath(path);

    if (res === OK) {
      return 0;
    }

    this.memory.controllerPath = undefined;
    log.debug(`${this.memory.stateName}: MoveToController_moveByPath ${res}`);
    return -1;
  }

  public MoveToSource(creep: Creep, _oAction: Action<gScreepState>): number {
    if (creep.fatigue !== 0) {
      return 0;
    }

    // First Found a Route to source
    const source: Source | null = Game.getObjectById(this.memory.source_id);
    if (!source) {
      log.debug(`${this.memory.stateName}: Source ${this.memory.source_id} not found`);
      return -1;
    }

    if (creep.pos.isNearTo(source)) {
      return 1;
    }

    if (!this.memory.source_path) {
      const path = creep.pos.findPathTo(source);
      this.memory.sourcePath = path;
      return 0;
    }

    const path = this.memory.sourcePath;
    const res = creep.moveByPath(path);

    if (res === OK) {
      return 0;
    }

    this.memory.sourcePath = undefined;
    log.debug(`${this.memory.stateName}: MoveToSource_moveByPath ${res}`);
    return -1;
  }

  public MoveToSpawn(creep: Creep, _oAction: Action<gScreepState>): number {
    if (creep.fatigue !== 0) {
      return 0;
    }
    // First Found a Route to source
    const spawn: StructureSpawn | null = Game.getObjectById(this.memory.spawn_id);
    if (!spawn) {
      log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`);
      return -1;
    }

    if (creep.pos.isNearTo(spawn)) {
      return 1;
    }

    if (!this.memory.spawnPath) {
      const path = creep.pos.findPathTo(spawn);
      this.memory.spawnPath = path;
      return 0;
    }

    const path = this.memory.spawnPath;
    const res = creep.moveByPath(path);

    if (res === OK) {
      return 0;
    }

    this.memory.spawnPath = undefined;
    log.debug(`${this.memory.stateName}: MoveToSpawn_moveByPath ${res}`);
    return -1;
  }

  public UpgradeController(creep: Creep, _oAction: Action<gScreepState>): number {
    const controller: StructureController | null = Game.getObjectById(this.memory.controller_id);
    if (!controller) {
      log.debug(`${this.memory.stateName}: Controller ${this.memory.controller_id} not found`);
      return -1;
    }

    if (!creep.pos.isNearTo(controller)) {
      return -1;
    }

    if (creep.store.energy === 0) {
      return 1;
    }

    const res = creep.upgradeController(controller);

    if (res === OK) {
      return 0;
    }

    log.debug(`${this.memory.stateName}: UpgradeController_upgradeController ${res}`);
    return -1;
  }

  public HarvestFromSource(creep: Creep, _oAction: Action<gScreepState>): number {
    const source: Source | null = Game.getObjectById(this.memory.source_id);
    if (!source) {
      log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`);
      return -1;
    }

    if (!creep.pos.isNearTo(source)) {
      return -1;
    }

    if (creep.store.getFreeCapacity() === 0) {
      // Full Capacity
      return 1;
    }

    const res = creep.harvest(source);

    if (res === OK) {
      return 0;
    }

    log.debug(`${this.memory.stateName}: HarvestFromSource_harvest ${res}`);
    return -1;
  }

  public TransferEnergyToSpawn(creep: Creep, _oAction: Action<gScreepState>): number {
    const spawn: StructureSpawn | null = Game.getObjectById(this.memory.spawn_id);
    if (!spawn) {
      log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`);
      return -1;
    }

    if (!creep.pos.isNearTo(spawn)) {
      return -1;
    }

    if (spawn.store.getCapacity(RESOURCE_ENERGY) === spawn.store.energy) {
      log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} Full`);
      return 0;
    }

    if (creep.store.energy === 0) {
      return 1;
    }

    const res = creep.transfer(spawn, RESOURCE_ENERGY);

    if (res === OK) {
      return 0;
    }

    log.debug(`${this.memory.stateName}: TransferEnergyToSpawn_transfer ${res}`);
    return -1;
  }

  public WithdrawEnergyFromSpawn(creep: Creep, _oAction: Action<gScreepState>): number {
    const spawn: StructureSpawn | null = Game.getObjectById(this.memory.spawn_id);
    if (!spawn) {
      log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} not found`);
      return -1;
    }

    if (!creep.pos.isNearTo(spawn)) {
      return -1;
    }

    if (creep.store.getFreeCapacity() === 0) {
      return 1;
    }

    if (spawn.store.energy === 0) {
      log.debug(`${this.memory.stateName}: Spawn ${this.memory.spawn_id} Empty`);
      return 0;
    }

    const res = creep.withdraw(spawn, RESOURCE_ENERGY);

    if (res === OK) {
      return 0;
    }

    log.debug(`${this.memory.stateName}: WithdrawEnergyFromSpawn_withdraw ${res}`);
    return -1;
  }
}
