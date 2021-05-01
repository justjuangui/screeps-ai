/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { MessageContext, MessagePayload, MessageSubscription, Messages } from "components/Requestor";
import { Process, ProcessPriority } from "../components/Process";
import { BuildPlannerProcess } from "./BuildPlanner";
import { CityProcess } from "./City";
import { ExpansionPlannerProcess } from "./ExpansionPlanner";
import { StateConstants } from "components/StateConstants";
import { VisualRoomProcess } from "./VisualRoom";
import { log } from "lib/logger/log";
import { registerProcess } from "../decorators/registerProcess";

@registerProcess
export class InitProcess extends Process {
  public static start(): number {
    const proc = Process.startNewProcess(InitProcess, -1, 0, ProcessPriority.High);
    proc.memory.stateName = StateConstants.WORLD_STATE_NAME;
    return proc.pid;
  }

  public subscribeMessages(): MessageSubscription[] {
    return super.subscribeMessages().concat([
      {
        type: Messages.REQUEST_NEW_CITY,
        context: MessageContext.Group,
        pid: this.pid,
        ppid: this.parentPID
      }
    ]);
  }

  public run(message: MessagePayload): MessagePayload[] | null {
    this.memory.pidList = this.memory.pidList || {};

    this.setState(StateConstants.WORLD_STATE_NAME, {
      gcl: Game.gcl.level
    } as any);

    this.memory.pidList.master = this.memory.pidList.master || {};
    const pidEP = this.memory.pidList.master.ep;
    if (pidEP === undefined) {
      this.memory.pidList.master.ep = ExpansionPlannerProcess.start(this.pid);
    }

    const pidP = this.memory.pidList.master.bp;
    if (pidP === undefined) {
      this.memory.pidList.master.bp = BuildPlannerProcess.start(this.pid);
    }

    const pidVR = this.memory.pidList.master.vr;
    if (pidVR === undefined) {
      this.memory.pidList.master.vr = VisualRoomProcess.start(this.pid);
    }

    if (message == null) {
      return null;
    }

    // Process Messages
    if (message.type === Messages.REQUEST_NEW_CITY) {
      log.info(`IN: Creating new city ${message.data}`);
      const cities = this.getSharedMemory("cities") as any;
      cities.count = (cities.count || 0) + 1;

      CityProcess.start(`city_${cities.count}`, message.data as string, this.pid);
    }

    /*

        this.memory.pidList .rooms = this.memory.pidList.rooms || {}
        for (const roomName in this.memory.pidList.rooms) {
            if (Game.rooms[roomName] === undefined) { this.memory.pidList.rooms[roomName] = undefined }
        }

        for (const roomName in Game.rooms) {
            const pid = this.memory.pidList.rooms[roomName]
            if (pid === undefined) { this.memory.pidList.rooms[roomName] = RoomProcess.start(roomName) }
        }

        this.memory.pidList.spawns = this.memory.pidList.spawns || {}
        for (const spawnName in this.memory.pidList.spawns) {
            if (Game.spawns[spawnName] === undefined) { this.memory.pidList.spawns[spawnName] = undefined }
        }

        for (const spawnName in Game.spawns) {
            const pid = this.memory.pidList.spawns[spawnName]
            if (pid === undefined) { this.memory.pidList.spawns[spawnName] = SpawnProcess.start(spawnName) }
        }

        this.memory.pidList.creeps = this.memory.pidList.creeps || {}
        for (const creepName in this.memory.pidList.creeps) {
            if (Game.creeps[creepName] === undefined) { this.memory.pidList.creeps[creepName] = undefined }
        }

        for (const creepName in Game.creeps) {
            const pid = this.memory.pidList.creeps[creepName]
            if (pid === undefined) { this.memory.pidList.creeps[creepName] = CreepProcess.start(creepName) }
        }
        */

    return null;
  }
}
