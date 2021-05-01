/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { MessageContext, MessagePayload, MessagePriority, Messages } from "components/Requestor";
import { Process, ProcessPriority } from "components/Process";
import { registerProcess } from "decorators/registerProcess";

@registerProcess
export class ExpansionPlannerProcess extends Process {
  public static start(ppid: number): number {
    const proc = Process.startNewProcess(ExpansionPlannerProcess, ppid, undefined, ProcessPriority.Normal);
    proc.memory.stateName = "sexpansionplaner";
    return proc.pid;
  }

  public run(message: MessagePayload | null): MessagePayload[] | null {
    const cities = this.getSharedMemory("cities") ?? {};
    cities.count = cities.count || 0;

    if (cities.count === 0) {
      // REQUEST NEW CITY
      return [
        {
          pid: this.pid,
          ppid: this.parentPID,
          context: MessageContext.Group,
          type: Messages.REQUEST_NEW_CITY,
          priority: MessagePriority.Normal,
          data: Object.keys(Game.rooms)[0]
        }
      ];
    }

    return null;
  }
}
