import { registerProcess } from "decorators/registerProcess";
import { Process, ProcessPriority } from "components/Process";
import { Messages, MessageSubscription, MessageContext, MessagePayload, MessagePriority } from "components/Requestor";
import { CreepProcess } from "./Creep";

@registerProcess
export class UpgradeManagerProcess extends Process {
    public static start(ppid: number, cityName: string, roomName: string) {
        const proc = Process.startNewProcess(UpgradeManagerProcess, ppid, undefined, ProcessPriority.Normal);
        proc.memory.stateName = `um_${cityName}_${roomName}`;
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
        if (!room || !room.controller) {
            this.stop();
            return null;
        }

        let request: MessagePayload[] = [];

        if (!this.memory.start) {
            this.memory.rcl = 0;
            this.memory.upgrader = 0;
            this.memory.spot = (<any>room.memory).controller.spot;
            this.memory.start = true;
        }

        let cRCL = room.controller ? room.controller.level : 0;
        if (cRCL > this.memory.rcl) {
            // NEW LEVEL
            this.memory.rcl = cRCL;
        }

        // TODO: Find a way to improve this number
        if (this.memory.upgrader < this.memory.spot) {
            if (!this.memory.waiting) {
                request.push({
                    type: Messages.REQUEST_SPAWNER_CREEP,
                    context: MessageContext.Group,
                    pid: this.pid,
                    ppid: this.parentPID,
                    priority: this.memory.upgrader == 0 ? MessagePriority.Normal : MessagePriority.Low,
                    data: {
                        name: `upgrader_${Game.time}`,
                        // TODO: Find a way to create body parts
                        body: [WORK, CARRY, MOVE, MOVE, MOVE],
                        opts: {
                            memory: { role: 'upgrader' }
                        }
                    }
                });
                this.memory.waiting = true;
            }
        }

        if (message) {
            if (message.type == Messages.RESPONSE_SPAWNER_CREEP && this.memory.waiting) {
                this.memory.waiting = false;
                this.memory.upgrader++;

                // Start Creep process
                CreepProcess.start(message.data);
            }
        }


        return request.length > 0 ? request : null;
    }

}
