/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { MessageContext, MessagePayload, MessagePriority, MessageSubscription, Messages } from "components/Requestor";
import { Process, ProcessPriority } from "components/Process";
import { ResourceManagerProcess } from "./ResourceManager";
import { SpawnProcess } from "./Spawn";
import { UpgradeManagerProcess } from "./UpgradeManager";
import { log } from "lib/logger/log";
import { registerProcess } from "decorators/registerProcess";

@registerProcess
export class CityProcess extends Process {
  public static start(name: string, roomName: string, ppid: number): number {
    const proc = Process.startNewProcess(CityProcess, ppid, undefined, ProcessPriority.Normal);
    proc.memory.stateName = "citystate_" + name;
    proc.memory.name = name;
    proc.memory.roomStart = roomName;
    log.info(`Creado ${name} ${proc.pid}`);
    return proc.pid;
  }

  public subscribeMessages(): MessageSubscription[] {
    return super.subscribeMessages().concat([
      {
        type: Messages.RESPONSE_PLANNER_ROOM,
        context: MessageContext.Group,
        pid: this.pid,
        ppid: this.parentPID
      }
    ]);
  }

  public run(message: MessagePayload): MessagePayload[] | null {
    if (Game.rooms[this.memory.roomStart] === undefined) {
      this.stop();
      return null;
    }

    _.defaultsDeep(Game.rooms[this.memory.roomStart].memory, {
      vr: "n",
      vrt: "c"
    });

    if (Memory.rooms[this.memory.roomStart].planner === undefined) {
      if (this.memory.sent === true) return [];
      this.memory.sent = true;
      return [
        {
          type: Messages.REQUEST_PLANNER_ROOM,
          context: MessageContext.Group,
          priority: MessagePriority.Normal,
          pid: this.pid,
          ppid: this.parentPID,
          data: this.memory.roomStart
        }
      ];
    }

    const request: MessagePayload[] = [];
    const vvr = Memory.rooms[this.memory.roomStart].vr;
    const vvrt = Memory.rooms[this.memory.roomStart].vrt;
    if (vvr !== "n") {
      let type = "";
      switch (vvr) {
        case "w":
          type = Messages.REQUEST_VISUAL_ROOM_WALL;
          break;
        case "e":
          type = Messages.REQUEST_VISUAL_ROOM_EXIT;
          break;
        case "b":
          type = Messages.REQUEST_VISUAL_ROOM_BUILD;
          break;

        default:
          break;
      }
      request.push({
        type,
        context: MessageContext.Group,
        pid: this.pid,
        ppid: this.parentPID,
        priority: MessagePriority.Normal,
        data: {
          room: this.memory.roomStart,
          type: vvrt
        }
      });
    }

    if (message !== null) {
      if (message.type === Messages.RESPONSE_PLANNER_ROOM && message.data === this.memory.roomStart) {
        log.info(`${this.memory.stateName} was planned`);

        // Start Spawner Process if i have one in Start Room
        const spawners = Game.rooms[this.memory.roomStart].find(FIND_MY_SPAWNS);
        _.forEach(spawners, s => {
          SpawnProcess.start(s.name, this.pid);
        });

        ResourceManagerProcess.start(this.pid, this.memory.name, this.memory.roomStart);

        if (Game.rooms[this.memory.roomStart].controller) {
          UpgradeManagerProcess.start(this.pid, this.memory.name, this.memory.roomStart);
        }
      }
    }
    return request.length > 0 ? request : null;
  }
}
