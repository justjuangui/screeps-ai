/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { MessageContext, MessagePayload, MessagePriority, MessageSubscription, Messages } from "components/Requestor";
import { Process, ProcessPriority } from "components/Process";
import { log } from "lib/logger/log";
import { registerProcess } from "decorators/registerProcess";

@registerProcess
export class SpawnProcess extends Process {
  public static start(spawnName: string, ppid: number): number {
    const proc = Process.startNewProcess(SpawnProcess, ppid, undefined, ProcessPriority.Normal);
    proc.memory.spawnName = spawnName;
    proc.memory.stateName = `spstate_${spawnName}`;
    return proc.pid;
  }

  public subscribeMessages(): MessageSubscription[] {
    return super.subscribeMessages().concat([
      {
        type: Messages.REQUEST_SPAWNER_CREEP,
        context: MessageContext.Group,
        pid: this.pid,
        ppid: this.parentPID
      }
    ]);
  }
  public run(message: MessagePayload): MessagePayload[] | null {
    const spawn = Game.spawns[this.memory.spawnName];
    if (spawn === undefined) {
      this.stop();
      return null;
    }

    if (spawn.spawning) {
      // We are busy!
      log.info("Spawning");
      return message != null ? [message] : null;
    }

    const request: MessagePayload[] = [];
    if ((spawn.memory as any).queue) {
      if (message != null) {
        request.push(message);
      }
      const queue = (spawn.memory as any).queue;

      if (queue.r === 0) {
        const totalEnergyNeed = _.sum(queue.data.body, (i: BodyPartConstant) => BODYPART_COST[i]);
        if (totalEnergyNeed <= spawn.room.energyAvailable) {
          const res = spawn.spawnCreep(queue.data.body, queue.data.name, queue.data.opts);
          if (res !== OK) {
            log.info(`${this.memory.spawnName}: spawnCreep ${res}`);
          } else {
            queue.r = 1;
          }
        }
      } else if (!spawn.spawning) {
        // Send response
        request.push({
          type: Messages.RESPONSE_SPAWNER_CREEP,
          pid: queue.pid,
          ppid: queue.ppid,
          priority: MessagePriority.Normal,
          context: MessageContext.Local,
          data: queue.data.name
        });
        (spawn.memory as any).queue = undefined;
      }
    } else if (message != null) {
      if (message.type === Messages.REQUEST_SPAWNER_CREEP) {
        (spawn.memory as any).queue = {
          pid: message.pid,
          ppid: message.ppid,
          data: message.data,
          r: 0
        };
      }
    }
    return request.length > 0 ? request : null;
  }
}
