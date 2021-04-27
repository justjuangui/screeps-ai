import { Process, ProcessPriority } from "components/Process";
import { MessagePayload, MessageSubscription, Messages, MessageContext, MessagePriority } from "components/Requestor";
import { log } from "lib/logger/log";
import { registerProcess } from "decorators/registerProcess";
import { SpawnProcess } from "./Spawn";
import { ResourceManagerProcess } from "./ResourceManager";
import { UpgradeManagerProcess } from "./UpgradeManager";

@registerProcess
export class CityProcess extends Process {
    public static start(name: string, roomName: string, ppid: number) {
        const proc = Process.startNewProcess(CityProcess, ppid, undefined, ProcessPriority.Normal);
        proc.memory.stateName = 'citystate_' + name;
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
        })

        if (Memory.rooms[this.memory.roomStart].planner === undefined) {
            if (this.memory.sent == true) return [];
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

        let request: MessagePayload[] = [];
        let vvr = Memory.rooms[this.memory.roomStart].vr;
        let vvrt = Memory.rooms[this.memory.roomStart].vrt;
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
                type: type,
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

        if (message != null) {
            if (message.type == Messages.RESPONSE_PLANNER_ROOM && message.data === this.memory.roomStart) {
                log.info(`${this.memory.stateName} was planned`);

                // Start Spawner Process if i have one in Start Room
                let spawners = Game.rooms[this.memory.roomStart].find(FIND_MY_SPAWNS);
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
