/* eslint-disable id-blacklist */
import * as _ from "lodash";
import { MessageContext, MessagePayload, MessageSubscription } from "./Requestor";
import { Process, ProcessStatus } from "./Process";
import { InitProcess } from "../processes/Init";
import { ProcessRegistry } from "./ProcessRegistry";
import { log } from "lib/logger/log";

export class Kernel {
  public static processTable: { [pid: string]: Process } = {};
  private static queue: Process[] = [];
  private static messagesSubscription: MessageSubscription[] = [];
  private static messagesPayload: MessagePayload[] = [];

  public static addProcess<T extends Process>(process: T): void {
    this.processTable[process.pid] = process;
    process.setMemory(this.getProcessMemory(process.pid));
    process.status = ProcessStatus.Alive;
  }

  public static getNextPID(): number {
    Memory.pidCounter = Memory.pidCounter ?? 0;
    while (this.getProcessByPID(Memory.pidCounter) !== undefined) {
      if (Memory.pidCounter >= Number.MAX_SAFE_INTEGER) {
        Memory.pidCounter = 0;
      }
      Memory.pidCounter++;
    }
    return Memory.pidCounter;
  }

  public static getProcessByPID(pid: number): Process {
    return this.processTable[pid];
  }

  public static getSharedMemory(name: string): Record<string, unknown> | undefined {
    Memory.sharedMemory = Memory.sharedMemory ?? {};
    Memory.sharedMemory[name] = Memory.sharedMemory[name] ?? ({} as Record<string, unknown>);
    return Memory.sharedMemory[name];
  }

  public static setSharedMemory(name: string, value: Record<string, unknown> | undefined): void {
    Memory.sharedMemory = Memory.sharedMemory ?? {};
    Memory.sharedMemory[name] = value;
  }

  public static getProcessMemory(pid: number): any {
    Memory.processMemory = Memory.processMemory ?? {};
    Memory.processMemory[pid] = Memory.processMemory[pid] ?? {};
    return Memory.processMemory[pid];
  }

  public static killProcess(pid: number): void {
    if (pid === 0) {
      return;
    }
    for (const otherPid in this.processTable) {
      const process = this.processTable[otherPid];
      if (process.parentPID === pid && process.status !== ProcessStatus.Dead) {
        this.killProcess(process.pid);
      }
    }
    this.processTable[pid].status = ProcessStatus.Dead;
    Memory.processMemory[pid] = undefined;
  }

  public static load(): void {
    this.loadProcesstable();
    this.loadMessagesPayload();
    this.garbageCollection();
    if (this.getProcessByPID(0) === undefined) {
      InitProcess.start();
    }
  }

  private static getNextMessage(pid: number, ppid: number): MessagePayload | null {
    const messageSubcriptions: MessageSubscription[] = _.filter(this.messagesSubscription, ms => ms.pid === pid);
    if (messageSubcriptions.length === 0) return null;

    if (this.messagesPayload.length > 0) {
      let chain = this.messagesPayload;
      chain = _.filter(chain, mp => _.any(messageSubcriptions, mb => mb.context === mp.context && mb.type === mp.type));
      chain = _.filter(chain, mp => _.any(messageSubcriptions, mb => mb.context === mp.context && mb.type === mp.type));
      chain = _.filter(chain, mp => {
        if (mp.context === MessageContext.Global) return true;
        if (mp.context === MessageContext.Local && pid === mp.pid) return true;
        if (mp.context === MessageContext.Children && mp.pid === ppid) return true;
        if (mp.context === MessageContext.Group && (mp.ppid === ppid || mp.ppid === pid)) {
          return true;
        }
        return false;
      });
      chain = _.sortBy(chain, ["context", "priority"]);
      return chain.length > 0 ? chain[0] : null;
    }

    return null;
  }

  public static run(): void {
    let nextMessagesPayloads: MessagePayload[] = [];
    log.info(`Current Messages:${JSON.stringify(this.messagesPayload)}`);
    while (this.queue.length > 0) {
      let process = this.queue.pop();
      while (process !== undefined) {
        if (this.getProcessByPID(process.parentPID) === undefined) {
          this.killProcess(process.pid);
        }
        if (process.status === ProcessStatus.Alive) {
          const nextMessage = this.getNextMessage(process.pid, process.parentPID);
          let copyMesssage = null;
          if (nextMessage != null) {
            copyMesssage = _.cloneDeep(nextMessage);
            nextMessage.sent = true;
          }

          const messageToQueue = process.run(copyMesssage);
          if (messageToQueue != null) {
            nextMessagesPayloads = nextMessagesPayloads.concat(messageToQueue);
          }
        }
        process = this.queue.pop();
      }
    }
    log.info(`Next Messages:${JSON.stringify(nextMessagesPayloads)}`);
    // add new messages
    this.messagesPayload = this.messagesPayload.concat(nextMessagesPayloads);
  }

  public static save(): void {
    this.storeProcessTable();
    this.storeMessagesPayload();
  }

  public static storeMessagesPayload(): void {
    // Remove messagePayload Sent
    _.remove(this.messagesPayload, m => m.sent === true);
    Memory.messages = JSON.stringify(this.messagesPayload);
  }

  public static storeProcessTable(): void {
    const liveProcs = _.filter(this.processTable, p => p.status !== ProcessStatus.Dead);
    Memory.processTable = _.map(liveProcs, p => [p.pid, p.parentPID, p.constructor.name, p.priority]);
  }

  public static garbageCollection(): void {
    Memory.processMemory = _.pick(Memory.processMemory, (a, k: string) => this.processTable[k] !== undefined);
    Memory.creeps = _.pick(Memory.creeps, (a, k: string) => Game.creeps[k] !== undefined);
    Memory.rooms = _.pick(Memory.rooms, (a, k: string) => Game.rooms[k] !== undefined);
  }

  public static loadMessagesPayload(): void {
    Memory.messages = Memory.messages ?? "[]";
    this.messagesPayload = JSON.parse(Memory.messages) as MessagePayload[];
  }

  public static loadProcesstable(): void {
    this.processTable = {};
    this.queue = [];
    this.messagesSubscription = [];
    Memory.processTable = Memory.processTable || [];
    for (const [pid, parentPID, processName, priority] of Memory.processTable) {
      const processClass = ProcessRegistry.fetch(processName as string);
      if (processClass === undefined) {
        continue;
      }
      const memory: unknown = this.getProcessMemory(pid as number);
      const process = new processClass(parentPID as number, pid as number, priority as number);
      process.setMemory(memory);
      this.messagesSubscription = this.messagesSubscription.concat(process.subscribeMessages());
      this.processTable[pid] = process;
      this.queue.push(process);
    }
    this.queue.reverse();
  }
}
