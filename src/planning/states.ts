export interface gState {
  key?: string;
}

export interface Action<T extends gState> {
  condition(state: T): boolean;
  effect(state: T): T;
  cost(state: T): number;
  key?: string;
  methodName?: string;
}

export interface Goal<T extends gState> {
  validate(prevState: T, nextState: T): boolean;
  label: string;
  desirable(currentState: T): number; // desirable must be between 0.0 to 1.0
}

export interface IScreepGoals<T extends gState> {
  [key: string]: Goal<T>;
}

export interface IScreepActions<T extends gState> {
  [key: string]: Action<T>;
}

export interface gScreepState extends gState {
  harvestedEnergy?: boolean;
  upgradeController?: boolean;
  role?: string;
  canCarry?: boolean;
  canMove?: boolean;
  canWork?: boolean;
  creepEnergy?: number;
  fullCarry?: boolean;
  sourceFind?: boolean;
  spawnFind?: boolean;
  controllerFind?: boolean;
  isNearOf?: string;
}
