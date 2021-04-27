import { merge } from "lodash";
import PriorityQueue from "fastpriorityqueue";
import { gState } from "../planning/states";
import { log } from "lib/logger/log";
import { reduce } from "lodash";

export interface Action<T extends gState> {
    condition(state: T): boolean
    effect(state: T): any
    cost(state: T): number
    key?: string
    method_name?: string
}

export interface Goal<T extends gState> {
    validate(prevState: T, nextState: T): boolean
    label: string
    desirable(currentState: T): number // desirable must be between 0.0 to 1.0
}

class Node {
    constructor(public parent: Node | undefined | null, public cost: any, public state: any, public action: Action<gState> | null) {
    }

    public toString(): string {
        if (this.parent && this.action) {
            return `${this.parent.toString()},${this.action.key}`
        }

        return ""
    }
}

const mapActions = (actions: any) => {
    actions = merge({}, actions)
    return Object.keys(actions).map(key => {
        return { ...actions[key], key }
    })
}

const buildGraph = (parent: any, leaves: any, actions: any[], goal: Goal<gState>, debug: boolean) => {
    actions.forEach((action: Action<gState>) => {
        if (action.condition(parent.state)) {
            let nextState = action.effect(merge({}, parent.state))
            const cost = parent.cost + action.cost(nextState)
            const node: Node = new Node(parent, cost, nextState, action)
            if (debug) {
                log.debug(`planer: ${node.toString()}`)
            }
            if (goal.validate(parent.state, nextState)) {
                leaves.add(node)
            } else {
                const subset = actions.filter(a => a.key !== action.key);
                return buildGraph(node, leaves, subset, goal, debug)
            }
        }
    })
}

const getPlanFromLeaf = (node: Node | undefined | null, goal: Goal<gState>) => {
    const plan = []
    const cost = node ? node.cost : 0
    while (node) {
        if (node.action) plan.unshift(node.action);
        node = node.parent
    }

    return {
        cost, goal, actions: plan.map(n => n.key)
    }
}

export const createPlan = <T extends gState>(state: T, actions: any, goal: Goal<T>, debug: boolean = false) => {
    const root = new Node(null, 0, state, null)
    const leaves = new PriorityQueue((a: Node, b: Node) => a.cost < b.cost)
    buildGraph(root, leaves, mapActions(actions), goal, debug)
    if (!leaves.isEmpty()) return getPlanFromLeaf(leaves.poll(), goal)
    return null
}
