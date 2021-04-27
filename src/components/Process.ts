import { Kernel } from './Kernel'
import { merge } from 'lodash'
import { gState } from "../planning/states";
import { sortByOrder, map, forOwn, filter } from "lodash";
import { Goal, createPlan, Action } from "./Planner";
import { log } from "lib/logger/log";
import { Messages, MessageSubscription, MessageContext, MessagePayload } from './Requestor';

export class StateConstants {
    public static WORLD_STATE_NAME = "wstate"
    public static ROOM_STATE_PREFIX = "rstate_"
    public static BUILD_PLANNER_STATE = "bplannerstate"

    public static getRoomStateKey(roomName: string): string {
        return `${StateConstants.ROOM_STATE_PREFIX}${roomName}`
    }
}
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
    memory: any
    parentPID: number
    pid: number
    priority: ProcessPriority
    status: ProcessStatus

    setMemory(memory: any): void
    stop(): void
}

export interface ProcessConstructor {
    new(parentPID: number, pid?: number, priority?: ProcessPriority): Process
}

export abstract class Process {
    public memory: any
    public parentPID: number
    public pid: number
    public priority: ProcessPriority
    public status: ProcessStatus

    constructor(parentPID: number, pid?: number, priority = ProcessPriority.Normal) {
        this.pid = pid !== undefined ? pid : Kernel.getNextPID()
        this.parentPID = parentPID
        this.priority = priority

        this.memory = {}
        this.status = ProcessStatus.Alive
        //this.stateName = pid + ""
    }

    protected static startNewProcess<T extends Process>(type: { new(...args: any[]): T }, parentPID: number, pid?: number, priority = ProcessPriority.Normal): T {
        let proc = new type(parentPID, pid, priority)
        Kernel.addProcess(proc)
        Kernel.storeProcessTable()
        return proc
    }
    public abstract run(message: MessagePayload | null): MessagePayload[] | null
    public setMemory(memory: any) { this.memory = memory }
    public stop() {
        this.setState(this.memory.stateName, null)
        Kernel.killProcess(this.pid)
    }

    public getSharedMemory(name: string) {
        return Kernel.getSharedMemory(name);
    }

    public setState<T extends gState>(name: string, newState: T | null) {
        let state = Kernel.getSharedMemory(name)
        state = newState == null ? undefined : merge({}, state, newState)
        Kernel.setSharedMemory(name, state)
    }

    public getState<T extends gState>(...names: string[]): T {
        let mstate = {}
        for (let index = 0; index < names.length; index++) {
            const stateName = names[index];
            const state = Kernel.getSharedMemory(stateName)
            if (state === undefined) { continue; }
            mstate = merge(mstate, state)
        }

        return (<T><any>mstate)
    }

    // GOAP Implementation for process
    public runGOAP<G extends gState, T extends Goal<G>>(logName: string, stateLevel: string[], oGoals: any, state: G, oActions: any, oHandler: any, debug: boolean = false) {
        if (this.memory.plan === undefined) {
            // find a plan to run
            this.memory.w = {}
            // log.info(`${logName}: Finding a goal`)
            let myGoals = sortByOrder(
                filter(
                    map(oGoals, (g: T, k) => {
                        return {
                            k,
                            g,
                            d: g.desirable(state)
                        }
                    }),
                    f => f.d > 0.0
                ),
                g2 => g2.d, "desc"
            )
            if (myGoals.length == 0) {
                log.info(`${logName}: No Goals`)
                return
            }

            let goal = myGoals[0].g
            let goalID = myGoals[0].k

            // now Planning actions
            let plan = createPlan(state, oActions, goal)
            if (plan == null) {
                log.info(`${logName}: No actions for ${goal.label}`)
                return
            }

            log.info(`${logName}: Running ${goal.label}`)
            if (debug) {
                log.debug(`${logName}: Find actions ${JSON.stringify(plan.actions)}`)
            }

            this.memory.plan = {
                name: plan.goal.label,
                actions: plan.actions,
                id: goalID,
                oldState: state,
                index: 0
            }
            return
        }
        // we found a plan, so go for it
        let index = this.memory.plan.index;
        let actions = this.memory.plan.actions;

        if (index > actions.length - 1) {
            // valida if state is correct
            let g: Goal<G> = oGoals[this.memory.plan.id]
            if (g.validate(this.memory.plan.oldState, state)) {
                this.setState(this.memory.stateName, null)
                log.info(`${logName}:Goal ${this.memory.plan.name} done!`)
            } else {
                log.debug(`${logName}: Next step out ouf actions`)
                return // Fixing first
            }
            this.memory.plan = undefined
            return
        }

        let action = actions[index];
        let oAction: Action<G> = oActions[action];
        if (oAction === undefined) {
            log.debug(`${logName}: Action not found ${action}`)
            this.memory.plan = undefined
            return
        }

        if (!oAction.method_name) {
            log.debug(`${logName}: Action Method not specified`)
            return
        }

        let method = (<any>this)[oAction.method_name]
        if (typeof method !== "function") {
            log.debug(`${logName}: Method not implemeted ${oAction.method_name}, action ${action}`)
            return
        }

        let result = method.apply(this, [oHandler, oAction])
        if (result == 1) {
            log.info(`${logName}: Action ${action} Done`)
            this.memory.plan.index += 1;
            state = oAction.effect(state)

            //Save only ownProperties
            let wState = this.getState.apply(this, stateLevel)
            forOwn(wState, (v, k) => {
                if (k) { (<any>state)[k] = undefined }
            })
            if (debug) {
                log.debug(`${logName}: Savin new State ${JSON.stringify(state)}`)
            }
            this.setState(this.memory.stateName, state)
        } else if (result == -1) {
            log.info(`${logName}: Action fail ${action}`)
            this.memory.plan = null
            this.memory.plan = undefined
        } else {
            if (debug) {
                log.debug(`${logName}: Action ${action} result ${result}`)
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
