import * as _ from "lodash";
import { Action, Goal, IScreepActions, gState } from "../planning/states";
import PriorityQueue from "fastpriorityqueue";
import { log } from "lib/logger/log";

class Node<T extends gState> {
  public constructor(
    public parent: Node<T> | undefined | null,
    public cost: number,
    public state: T,
    public action: Action<T> | null
  ) {}

  public toString(): string {
    if (this.parent && this.action) {
      return `${this.parent.toString()},${this.action.key ?? ""}`;
    }

    return "";
  }
}

const mapActions = <T extends gState>(actions: IScreepActions<T>): Action<T>[] => {
  actions = _.merge({}, actions);
  return Object.keys(actions).map(key => {
    return { ...actions[key], key };
  });
};

const buildGraph = <T extends gState>(
  parent: Node<T>,
  leaves: PriorityQueue<Node<T>>,
  actions: Action<T>[],
  goal: Goal<T>,
  debug: boolean
) => {
  actions.forEach((action: Action<T>) => {
    if (action.condition(parent.state)) {
      const nextState = action.effect(_.merge({}, parent.state));
      const cost = parent.cost + action.cost(nextState);
      const node: Node<T> = new Node<T>(parent, cost, nextState, action);
      if (debug) {
        log.debug(`planer: ${node.toString()}`);
      }
      if (goal.validate(parent.state, nextState)) {
        leaves.add(node);
      } else {
        const subset = actions.filter(a => a.key !== action.key);
        return buildGraph(node, leaves, subset, goal, debug);
      }
    }
  });
};

const getPlanFromLeaf = <T extends gState>(node: Node<T> | undefined | null, goal: Goal<T>) => {
  const plan = [];
  const cost: number = node ? node.cost : 0;
  while (node) {
    if (node.action) plan.unshift(node.action);
    node = node.parent;
  }

  return {
    cost,
    goal,
    actions: plan.map(n => n.key)
  };
};

export const createPlan = <T extends gState>(
  state: T,
  actions: IScreepActions<T>,
  goal: Goal<T>,
  debug = false
): {
  cost: number;
  goal: Goal<T>;
  actions: (string | undefined)[];
} | null => {
  const root = new Node<T>(null, 0, state, null);
  const leaves = new PriorityQueue((a: Node<T>, b: Node<T>) => a.cost < b.cost);
  buildGraph(root, leaves, mapActions(actions), goal, debug);
  if (!leaves.isEmpty()) return getPlanFromLeaf(leaves.poll(), goal);
  return null;
};
