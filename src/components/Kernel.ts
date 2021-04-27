import { Process, ProcessStatus } from './Process'
import { ProcessRegistry } from './ProcessRegistry'
import { InitProcess } from "../processes/Init"
import { MessageSubscription, MessagePayload, MessageContext } from './Requestor'
import { log } from 'lib/logger/log';
import { remove, filter, sortBy, any } from "lodash";

export class Kernel {
    public static processTable: { [pid: string]: Process } = {}
    private static queue: Process[] = [];
    private static messagesSubscription: MessageSubscription[] = [];
    private static messagesPayload: MessagePayload[] = [];

    public static addProcess<T extends Process>(process: T) {
        this.processTable[process.pid] = process;
        process.setMemory(this.getProcessMemory(process.pid))
        process.status = ProcessStatus.Alive
    }


    public static getNextPID() {
        Memory.pidCounter = Memory.pidCounter || 0
        while (this.getProcessByPID(Memory.pidCounter) !== undefined) {
            if (Memory.pidCounter >= Number.MAX_SAFE_INTEGER) { Memory.pidCounter = 0 }
            Memory.pidCounter++
        }
        return Memory.pidCounter;
    }

    public static getProcessByPID(pid: number) {
        return this.processTable[pid]
    }

    public static getSharedMemory(name: string) {
        Memory.sharedMemory = Memory.sharedMemory || {}
        Memory.sharedMemory[name] = Memory.sharedMemory[name] || {}
        return Memory.sharedMemory[name]
    }

    public static setSharedMemory(name: string, value: {} | undefined) {
        Memory.sharedMemory = Memory.sharedMemory || {}
        Memory.sharedMemory[name] = value
    }

    public static getProcessMemory(pid: number) {
        Memory.processMemory = Memory.processMemory || {}
        Memory.processMemory[pid] = Memory.processMemory[pid] || {}
        return Memory.processMemory[pid]
    }

    public static killProcess(pid: number) {
        if (pid == 0) { return }
        for (const otherPid in this.processTable) {
            const process = this.processTable[otherPid]
            if (process.parentPID === pid && process.status !== ProcessStatus.Dead) {
                this.killProcess(process.pid)
            }
        }
        this.processTable[pid].status = ProcessStatus.Dead
        Memory.processMemory[pid] = undefined
    }

    public static load() {
        this.loadProcesstable()
        this.loadMessagesPayload()
        this.garbageCollection()
        if (this.getProcessByPID(0) === undefined) {
            InitProcess.start()
        }
    }

    private static getNextMessage(pid: number, ppid: number): MessagePayload | null {
        let messageSubcriptions: MessageSubscription[] = filter(this.messagesSubscription, ms => ms.pid == pid)
        if (messageSubcriptions.length == 0) return null;

        if (this.messagesPayload.length > 0) {
            let chain = this.messagesPayload;
            chain = filter(chain, mp => any(messageSubcriptions, mb => mb.context === mp.context && mb.type === mp.type));
            chain = filter(chain, mp => any(messageSubcriptions, mb => mb.context === mp.context && mb.type === mp.type));
            chain = filter(chain, mp => {
                if (mp.context == MessageContext.Global) return true;
                if (mp.context == MessageContext.Local && pid == mp.pid) return true;
                if (mp.context == MessageContext.Children && mp.pid == ppid) return true;
                if (mp.context == MessageContext.Group
                    && (mp.ppid == ppid || mp.ppid == pid)) {
                    return true;
                }
                return false;
            });
            chain = sortBy(chain, ['context', 'priority']);
            return chain.length > 0 ? chain[0] : null;
        }

        return null;
    }

    public static run() {
        let nextMessagesPayloads: MessagePayload[] = [];
        log.info(`Current Messages:${JSON.stringify(this.messagesPayload)}`);
        while (this.queue.length > 0) {
            let process = this.queue.pop()
            while (process !== undefined) {
                if (this.getProcessByPID(process.parentPID) === undefined) {
                    this.killProcess(process.pid)
                }
                if (process.status === ProcessStatus.Alive) {
                    let nextMessage = this.getNextMessage(process.pid, process.parentPID)
                    let copyMesssage = null;
                    if (nextMessage != null) {
                        copyMesssage = _.cloneDeep(nextMessage);
                        nextMessage.sent = true;
                    }

                    let messageToQueue = process.run(copyMesssage)
                    if (messageToQueue != null) {
                        nextMessagesPayloads = nextMessagesPayloads.concat(messageToQueue)
                    }
                }
                process = this.queue.pop()
            }
        }
        log.info(`Next Messages:${JSON.stringify(nextMessagesPayloads)}`);
        // add new messages
        this.messagesPayload = this.messagesPayload.concat(nextMessagesPayloads);
    }

    public static save() {
        this.storeProcessTable()
        this.storeMessagesPayload();
    }

    public static storeMessagesPayload() {
        // Remove messagePayload Sent
        remove(this.messagesPayload, m => m.sent === true);
        Memory.messages = JSON.stringify(this.messagesPayload);
    }

    public static storeProcessTable() {
        const liveProcs = _.filter(this.processTable, (p) => p.status !== ProcessStatus.Dead)
        Memory.processTable = _.map(liveProcs, (p) => [p.pid, p.parentPID, p.constructor.name, p.priority])
    }

    public static garbageCollection() {
        Memory.processMemory = _.pick(Memory.processMemory, (_: any, k: string) => this.processTable[k] !== undefined)
        Memory.creeps = _.pick(Memory.creeps, (_: any, k: string) => Game.creeps[k] !== undefined)
        Memory.rooms = _.pick(Memory.rooms, (_: any, k: string) => Game.rooms[k] !== undefined)
    }

    public static loadMessagesPayload() {
        Memory.messages = Memory.messages || "[]"
        this.messagesPayload = JSON.parse(Memory.messages)
    }

    public static loadProcesstable() {
        this.processTable = {}
        this.queue = []
        this.messagesSubscription = []
        Memory.processTable = Memory.processTable || []
        for (const [pid, parentPID, processName, priority] of Memory.processTable) {
            const processClass = ProcessRegistry.fetch(processName)
            if (processClass === undefined) { continue }
            const memory = this.getProcessMemory(pid)
            const process = new processClass(parentPID, pid, priority)
            process.setMemory(memory)
            this.messagesSubscription = this.messagesSubscription.concat(process.subscribeMessages())
            this.processTable[pid] = process
            this.queue.push(process)
        }
        this.queue.reverse()
    }
}
