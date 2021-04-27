import { registerProcess } from "decorators/registerProcess";
import { Process, ProcessPriority } from "components/Process";
import { MessagePayload, MessageContext, Messages, MessagePriority } from "components/Requestor";

@registerProcess
export class ExpansionPlannerProcess extends Process {
    public static start(ppid: number) {
        const proc = Process.startNewProcess(ExpansionPlannerProcess, ppid, undefined, ProcessPriority.Normal);
        proc.memory.stateName = 'sexpansionplaner';
        return proc.pid;
    }

    public run(message: MessagePayload | null): MessagePayload[] | null {

        let cities = this.getSharedMemory("cities");
        cities.count = cities.count || 0;

        if (cities.count == 0) {
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
