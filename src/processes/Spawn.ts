import { registerProcess } from "decorators/registerProcess";
import { Process, ProcessPriority, StateConstants } from "components/Process";
import { log } from "lib/logger/log";
import { MessagePayload, Messages, MessageSubscription, MessageContext, MessagePriority } from "components/Requestor";

@registerProcess
export class SpawnProcess extends Process {
    public static start(spawnName: string, ppid: number) {
        const proc = Process.startNewProcess(SpawnProcess, ppid, undefined, ProcessPriority.Normal)
        proc.memory.spawnName = spawnName
        proc.memory.stateName = `spstate_${spawnName}`
        return proc.pid
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
        const spawn = Game.spawns[this.memory.spawnName]
        if (spawn === undefined) {
            this.stop();
            return null;
        }

        if (spawn.spawning) {
            // We are busy!
            log.info("Spawning");
            return message != null ? [message] : null;
        }

        let request: MessagePayload[] = [];
        if ((<any>spawn.memory).queue) {
            if (message != null) {
                request.push(message);
            }
            let queue = (<any>spawn.memory).queue;

            if (queue.r == 0) {
                let totalEnergyNeed = _.sum(queue.data.body, (i: BodyPartConstant) => BODYPART_COST[i]);
                if (totalEnergyNeed <= spawn.room.energyAvailable) {
                    let res = spawn.spawnCreep(queue.data.body, queue.data.name, queue.data.opts);
                    if (res != OK) {
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
                (<any>spawn.memory).queue = undefined;
            }
        } else if (message != null) {
            if (message.type == Messages.REQUEST_SPAWNER_CREEP) {
                (<any>spawn.memory).queue = {
                    pid: message.pid,
                    ppid: message.ppid,
                    data: message.data,
                    r: 0
                }
            }
        }
        return request.length > 0 ? request : null;
    }
}
