/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prefer-spread */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import * as _ from "lodash";
import { Action, Goal, IScreepActions, IScreepGoals, gState } from "../planning/states";
import { MessageContext, MessagePayload, MessageSubscription, Messages } from "./Requestor";
import { Kernel } from "./Kernel";
import { createPlan } from "./Planner";
import { log } from "lib/logger/log";

export enum ProcessPriority {
  High = 1,
  Normal,
  Low
}

export enum ProcessStatus {
  Dead = 0,
  Alive
}

export interface Process {
  memory: any;
  parentPID: number;
  pid: number;
  priority: ProcessPriority;
  status: ProcessStatus;

  setMemory(memory: any): void;
  stop(): void;
}

export interface ProcessConstructor {
  new (parentPID: number, pid?: number, priority?: ProcessPriority): Process;
}

export abstract class Process {
  public memory: any;
  public parentPID: number;
  public pid: number;
  public priority: ProcessPriority;
  public status: ProcessStatus;

  public constructor(parentPID: number, pid?: number, priority = ProcessPriority.Normal) {
    this.pid = pid !== undefined ? pid : Kernel.getNextPID();
    this.parentPID = parentPID;
    this.priority = priority;

    this.memory = {} as Record<string, undefined>;
    this.status = ProcessStatus.Alive;
    // this.stateName = pid + ""
  }

  protected static startNewProcess<T extends Process>(
    type: { new (...args: any[]): T },
    parentPID: number,
    pid?: number,
    priority = ProcessPriority.Normal
  ): T {
    const proc = new type(parentPID, pid, priority);
    Kernel.addProcess(proc);
    Kernel.storeProcessTable();
    return proc;
  }
  public abstract run(message: MessagePayload | null): MessagePayload[] | null;

  public setMemory(memory: Record<string, undefined>): void {
    this.memory = memory;
  }

  public stop(): void {
    this.setState(this.memory.stateName as string, null);
    Kernel.killProcess(this.pid);
  }

  public getSharedMemory(name: string): Record<string, unknown> | undefined {
    return Kernel.getSharedMemory(name);
  }

  public setState<T extends gState>(name: string, newState: T | null): void {
    let state = Kernel.getSharedMemory(name);
    state = newState == null ? undefined : _.merge({}, state, newState);
    Kernel.setSharedMemory(name, state);
  }

  public getState<T extends gState>(...names: string[]): T {
    let mstate = {} as T;
    for (const stateName of names) {
      const state = Kernel.getSharedMemory(stateName);
      if (state === undefined) {
        continue;
      }
      mstate = _.merge(mstate, state);
    }

    return mstate;
  }

  // GOAP Implementation for process
  public runGOAP<G extends gState>(
    logName: string,
    stateLevel: string[],
    oGoals: IScreepGoals<G>,
    state: G,
    oActions: IScreepActions<G>,
    oHandler: any,
    debug = false
  ): void {
    if (this.memory.plan === undefined) {
      // find a plan to run
      this.memory.w = {};
      // log.info(`${logName}: Finding a goal`)
      const myGoals = _.sortByOrder(
        _.filter(
          _.map(oGoals, (g, k) => {
            return {
              k,
              g,
              d: g.desirable(state)
            };
          }),
          f => f.d > 0.0
        ),
        g2 => g2.d,
        "desc"
      );
      if (myGoals.length === 0) {
        log.info(`${logName}: No Goals`);
        return;
      }

      const goal = myGoals[0].g;
      const goalID = myGoals[0].k;

      // now Planning actions
      const plan = createPlan(state, oActions, goal);
      if (plan == null) {
        log.info(`${logName}: No actions for ${goal.label}`);
        return;
      }

      log.info(`${logName}: Running ${goal.label}`);
      if (debug) {
        log.debug(`${logName}: Find actions ${JSON.stringify(plan.actions)}`);
      }

      this.memory.plan = {
        name: plan.goal.label,
        actions: plan.actions,
        id: goalID,
        oldState: state,
        index: 0
      };
      return;
    }
    // we found a plan, so go for it
    const index = this.memory.plan.index;
    const actions = this.memory.plan.actions;

    if (index > actions.length - 1) {
      // valida if state is correct
      const g: Goal<G> = oGoals[this.memory.plan.id];
      if (g.validate(this.memory.plan.oldState, state)) {
        this.setState(this.memory.stateName, null);
        log.info(`${logName}:Goal ${this.memory.plan.name} done!`);
      } else {
        log.debug(`${logName}: Next step out ouf actions`);
        return; // Fixing first
      }
      this.memory.plan = undefined;
      return;
    }

    const action = actions[index];
    const oAction: Action<G> = oActions[action];
    if (oAction === undefined) {
      log.debug(`${logName}: Action not found ${action}`);
      this.memory.plan = undefined;
      return;
    }

    if (!oAction.methodName) {
      log.debug(`${logName}: Action Method not specified`);
      return;
    }

    const method = (this as any)[oAction.methodName];
    if (typeof method !== "function") {
      log.debug(`${logName}: Method not implemeted ${oAction.methodName}, action ${action}`);
      return;
    }

    const result = method.apply(this, [oHandler, oAction]);
    if (result === 1) {
      log.info(`${logName}: Action ${action} Done`);
      this.memory.plan.index += 1;
      state = oAction.effect(state);

      // Save only ownProperties
      const wState = this.getState.apply(this, stateLevel);
      _.forOwn(wState, (v, k) => {
        if (k) {
          (state as any)[k] = undefined;
        }
      });
      if (debug) {
        log.debug(`${logName}: Savin new State ${JSON.stringify(state)}`);
      }
      this.setState(this.memory.stateName as string, state);
    } else if (result === -1) {
      log.info(`${logName}: Action fail ${action}`);
      this.memory.plan = null;
      this.memory.plan = undefined;
    } else {
      if (debug) {
        log.debug(`${logName}: Action ${action} result ${result}`);
      }
    }
  }

  // Events
  public subscribeMessages(): MessageSubscription[] {
    // Add Default Events
    return [
      {
        type: Messages.EVENT_WORLD_ENEMY,
        context: MessageContext.Global,
        pid: this.pid,
        ppid: this.parentPID
      }
    ];
  }
}
