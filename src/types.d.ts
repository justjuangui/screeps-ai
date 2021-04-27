// example declaration file - remove these and add your own custom typings
// memory extension samples
interface CreepMemory {
  role: string;
}

interface Memory {
  uuid: number;
  log: any;
}

interface PlannerMemory {
  status: 1 | 0,
  wmc?: number[],
  wc?: { [index: string]: string },
  emc?: number[],
  ec?: { [index: string]: string },
  bmc?: number[],
  bc?: { [index: string]: string }
}
interface RoomMemory {
  planner?: PlannerMemory;
  vr: "w" | "e" | "b" | "n",
  vrt: "c" | "n"
}
// `global` extension samples
declare namespace NodeJS {
  interface Global {
    log: any;
    VRHelper: any;
  }
}
