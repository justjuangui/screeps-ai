import { registerProcess } from "decorators/registerProcess";
import { Process, ProcessPriority } from "components/Process";
import { MessagePayload, Messages, MessageContext, MessageSubscription, MessagePriority } from "components/Requestor";
import { log } from "lib/logger/log";
import { Kernel } from "components/Kernel";

@registerProcess
export class VisualRoomProcess extends Process {
    public static start(ppid: number) {
        const proc = Process.startNewProcess(VisualRoomProcess, ppid, undefined, ProcessPriority.Normal)
        return proc.pid
    }

    public subscribeMessages(): MessageSubscription[] {
        return super.subscribeMessages().concat([
            {
                type: Messages.REQUEST_VISUAL_ROOM_EXIT,
                context: MessageContext.Group,
                pid: this.pid,
                ppid: this.parentPID
            },
            {
                type: Messages.REQUEST_VISUAL_ROOM_BUILD,
                context: MessageContext.Group,
                pid: this.pid,
                ppid: this.parentPID
            },
            {
                type: Messages.REQUEST_VISUAL_ROOM_WALL,
                context: MessageContext.Group,
                pid: this.pid,
                ppid: this.parentPID
            }
        ]);
    }

    private showVisual(roomName: string, planner: PlannerMemory, mcName: string, mcColor: string, type: string) {
        let sMatrix = (<number[]>((<any>planner)[mcName]));
        let matrix = PathFinder.CostMatrix.deserialize(sMatrix);
        let mapColors = (<{ [index: string]: string }>((<any>planner)[mcColor]));
        let roomVisual = Game.rooms[roomName].visual;
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                let value = matrix.get(x, y);
                let color = mapColors[value];

                if (color && (type == "c" || value == 255)) {
                    roomVisual.rect(x - 0.6, y - 0.6, 1, 1, { fill: color });
                } else {
                    roomVisual.text(`${value}`, x, y);
                }
            }
        }

    }

    public run(message: MessagePayload | null): MessagePayload[] | null {
        if (message == null) {
            return null;
        }

        if (message.type == Messages.REQUEST_VISUAL_ROOM_WALL || message.type == Messages.REQUEST_VISUAL_ROOM_EXIT || message.type == Messages.REQUEST_VISUAL_ROOM_BUILD) {
            let roomName = (<string>message.data.room);
            let type = (<string>message.data.type);
            if (Game.rooms[roomName] === undefined) {
                log.info(`VR: No valid room ${roomName}`);
                return null;
            }

            let planner: PlannerMemory = Memory.rooms[roomName].planner || { status: 0 };
            if (planner.status == 1) {
                let mcName = "";
                let mcColor = "";

                switch (message.type) {
                    case Messages.REQUEST_VISUAL_ROOM_WALL:
                        mcName = "wmc";
                        mcColor = "wc";
                        break;
                    case Messages.REQUEST_VISUAL_ROOM_EXIT:
                        mcName = "emc";
                        mcColor = "ec";
                        break;
                    case Messages.REQUEST_VISUAL_ROOM_BUILD:
                        mcName = "bmc";
                        mcColor = "bc";
                        break;
                }
                this.showVisual(roomName, planner, mcName, mcColor, type);

                return null;
            } else {
                log.info(`VR: no info BP room ${roomName}`);
            }
        } else if (message.type == Messages.REQUEST_VISUAL_NONE) {
            this.memory.none = true;
        }
        return null;
    }
}
