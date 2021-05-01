import { MessageContext, MessagePayload, MessageSubscription, Messages } from "components/Requestor";
import { Process, ProcessPriority } from "components/Process";
import { log } from "lib/logger/log";
import { registerProcess } from "decorators/registerProcess";

@registerProcess
export class VisualRoomProcess extends Process {
  public static start(ppid: number): number {
    const proc = Process.startNewProcess(VisualRoomProcess, ppid, undefined, ProcessPriority.Normal);
    return proc.pid;
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const sMatrix = (planner as any)[mcName] as number[];
    const matrix = PathFinder.CostMatrix.deserialize(sMatrix);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const mapColors = (planner as any)[mcColor] as { [index: string]: string };
    const roomVisual = Game.rooms[roomName].visual;
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const value = matrix.get(x, y);
        const color = mapColors[value];

        if (color && (type === "c" || value === 255)) {
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

    if (
      message.type === Messages.REQUEST_VISUAL_ROOM_WALL ||
      message.type === Messages.REQUEST_VISUAL_ROOM_EXIT ||
      message.type === Messages.REQUEST_VISUAL_ROOM_BUILD
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const roomName = message.data.room as string;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const type = message.data.type as string;
      if (Game.rooms[roomName] === undefined) {
        log.info(`VR: No valid room ${roomName}`);
        return null;
      }

      const planner: PlannerMemory = Memory.rooms[roomName].planner || { status: 0 };
      if (planner.status === 1) {
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
    } else if (message.type === Messages.REQUEST_VISUAL_NONE) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.memory.none = true;
    }
    return null;
  }
}
