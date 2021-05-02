// example declaration file - remove these and add your own custom typings
// memory extension samples
interface CreepMemory {
  role: string;
  room: string;
  working: boolean;
}

interface MyRoomStats {
  storageEnergy?: number;
  terminalEnergy?: number;
  energyAvailable?: number;
  energyCapacityAvailable?: number;
  controllerProgress?: number;
  controllerProgressTotal?: number;
  controllerLevel?: number;
}

interface Memory {
  sharedMemory: {
    [s: string]: Record<string, unknown> | undefined;
  };
  processMemory: {
    [s: number]: Record<string, unknown> | undefined;
  };
  uuid: number;
  messages: string | undefined;
  log: {
    level: number;
    showSource: boolean;
    showTick: boolean;
  };
  pidCounter: number | undefined;
  processTable: (string | number)[][];
  stats: {
    cpu: {
      bucket: number;
      limit: number;
      used: number;
    };
    memory: {
      used: number;
    };
    gcl: {
      progress: number;
      progressTotal: number;
      level: number;
    };
    rooms: {
      [key: string]: MyRoomStats;
    };
    time: number;
    totalCreepCount: number;
  };
}

interface PlannerMemory {
  status: 1 | 0;
  wmc?: number[];
  wc?: { [index: string]: string };
  emc?: number[];
  ec?: { [index: string]: string };
  bmc?: number[];
  bc?: { [index: string]: string };
}
interface RoomMemory {
  planner?: PlannerMemory;
  vr: "w" | "e" | "b" | "n";
  vrt: "c" | "n";
}
// `global` extension samples
declare namespace NodeJS {
  interface Global {
    log: any;
    VRHelper: any;
  }
}
