import { registerProcess } from "decorators/registerProcess";
import { Process, ProcessPriority } from "components/Process";
import { MessagePayload, Messages, MessageContext, MessagePriority, MessageSubscription } from "components/Requestor";
import { CreepProcess } from "./Creep";

@registerProcess
export class ResourceManagerProcess extends Process {
    public static start(ppid: number, cityName: string, roomName: string) {
        const proc = Process.startNewProcess(ResourceManagerProcess, ppid, undefined, ProcessPriority.Normal);
        proc.memory.stateName = `rm_${cityName}_${roomName}`;
        proc.memory.roomName = roomName;
        return proc.pid;
    }
    public subscribeMessages(): MessageSubscription[] {
        return super.subscribeMessages().concat([
            {
                type: Messages.RESPONSE_SPAWNER_CREEP,
                context: MessageContext.Local,
                pid: this.pid,
                ppid: this.parentPID
            }
        ]);
    }

    public run(message: MessagePayload | null): MessagePayload[] | null {
        let room = Game.rooms[this.memory.roomName];
        if (!room) {
            this.stop();
            return null;
        }

        let request: MessagePayload[] = [];

        if (!this.memory.start) {
            this.memory.rcl = 0;
            this.memory.harvester = 0;
            this.memory.start = true;
        }

        let cRCL = room.controller ? room.controller.level : 0;
        if (cRCL > this.memory.rcl) {
            // NEW LEVEL
            this.memory.rcl = cRCL;
        }

        // TODO: Find a way to improve this number
        if (this.memory.harvester < 2) {
            if (!this.memory.waiting) {
                request.push({
                    type: Messages.REQUEST_SPAWNER_CREEP,
                    context: MessageContext.Group,
                    pid: this.pid,
                    ppid: this.parentPID,
                    priority: this.memory.harvester == 0 ? MessagePriority.High : MessagePriority.Low,
                    data: {
                        name: `harvester_${Game.time}`,
                        // TODO: Find a way to create body parts
                        body: [WORK, CARRY, MOVE, MOVE, MOVE],
                        opts: {
                            memory: { role: 'harvester' }
                        }
                    }
                });

                this.memory.waiting = true;
            }
        }

        if (message) {
            if (message.type == Messages.RESPONSE_SPAWNER_CREEP && this.memory.waiting) {
                this.memory.waiting = false;
                this.memory.harvester++;

                // Start Creep process
                CreepProcess.start(message.data);
            }
        }

        return request.length > 0 ? request : null;
    }
}
