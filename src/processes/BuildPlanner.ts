/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as _ from "lodash";
import { MessageContext, MessagePayload, MessagePriority, MessageSubscription, Messages } from "components/Requestor";
import { Process, ProcessPriority } from "../components/Process";
import { StateConstants } from "components/StateConstants";
import { generateColors } from "../utils/colorsgenerator";
import { log } from "lib/logger/log";
import { registerProcess } from "../decorators/registerProcess";

@registerProcess
export class BuildPlannerProcess extends Process {
  public static start(ppid: number): number {
    const proc = Process.startNewProcess(BuildPlannerProcess, ppid, undefined, ProcessPriority.High);
    proc.memory.stateName = StateConstants.BUILD_PLANNER_STATE;
    return proc.pid;
  }

  public subscribeMessages(): MessageSubscription[] {
    return super.subscribeMessages().concat([
      {
        type: Messages.REQUEST_PLANNER_ROOM,
        context: MessageContext.Group,
        pid: this.pid,
        ppid: this.parentPID
      }
    ]);
  }

  public run(message: MessagePayload): MessagePayload[] | null {
    if (message == null) {
      return null;
    }

    if (message.type === Messages.REQUEST_PLANNER_ROOM) {
      const roomName = message.data as string;
      if (Game.rooms[roomName] === undefined) {
        log.info(`BP: No valid room ${roomName}`);
        return null;
      }

      Memory.rooms[roomName].planner = Memory.rooms[roomName].planner || { status: 0 };
      const planner: PlannerMemory = Memory.rooms[roomName].planner || { status: 0 };
      if (planner.status === 0) {
        log.info(`BP: Analyzing room ${roomName}`);
        // TODO: Split this into Local Messages
        this.calculateDistanceWall(roomName, planner);
        this.evaluateSourcesInRoom(roomName);
        this.evaluateControllerInRoom(roomName);
        this.evaluateBuildInRoom(roomName, planner);
        this.evaluateResourcesTown(roomName, planner);

        return [
          {
            type: Messages.RESPONSE_PLANNER_ROOM,
            context: MessageContext.Group,
            pid: this.pid,
            ppid: this.parentPID,
            priority: MessagePriority.Normal,
            data: roomName
          }
        ];
      }
    }

    return null;
  }

  private evaluateControllerInRoom(roomName: string) {
    const room = Game.rooms[roomName];
    if (!room.controller) return;
    const terrain = room.getTerrain();
    const x = room.controller.pos.x;
    const y = room.controller.pos.y;
    (room.memory as any).controller = { spot: 0 };
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = x + dx < 0 ? 0 : x + dx > 49 ? 49 : x + dx;
        const ny = y + dy < 0 ? 0 : y + dy > 49 ? 49 : y + dy;

        if ((nx !== 0 || ny !== 0) && terrain.get(nx, ny) !== TERRAIN_MASK_WALL) {
          (room.memory as any).controller.spot++;
        }
      }
    }
  }

  private findPlaceRoom(
    wallDistance: number,
    exitDistance: number,
    space: number,
    planner: PlannerMemory,
    roomName: string
  ): RoomPosition[] {
    const places: RoomPosition[] = [];

    const mcBuild = PathFinder.CostMatrix.deserialize(planner.bmc as number[]);
    const mcWall = PathFinder.CostMatrix.deserialize(planner.wmc as number[]);
    const mcExit = PathFinder.CostMatrix.deserialize(planner.emc as number[]);
    const axis = (space - 1) / 2;

    // TODO: Refactor this
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const dWall = mcWall.get(x, y);
        if (dWall === 255) continue; // Wall
        if (dWall < wallDistance) continue;
        if (mcExit.get(x, y) < exitDistance) continue;
        if (mcBuild.get(x, y) > 0) continue; // Place  took

        let valid = true;
        for (let dx = -1 * axis; dx <= axis; dx++) {
          for (let dy = -1 * axis; dy <= axis; dy++) {
            const nx = x + dx < 0 ? 0 : x + dx > 49 ? 49 : x + dx;
            const ny = y + dy < 0 ? 0 : y + dy > 49 ? 49 : y + dy;

            if (nx !== 0 || ny !== 0) {
              if (mcBuild.get(nx, ny) > 0) {
                valid = false;
                break;
              }
            }
          }

          if (!valid) {
            break;
          }
        }
        if (valid) {
          places.push(new RoomPosition(x, y, roomName));
        }
      }
    }

    return places;
  }

  private evaluateResourcesTown(roomName: string, planner: PlannerMemory) {
    const wD = 8;
    const eD = 12;
    const sC = 7;

    const room = Game.rooms[roomName];
    if (!room.controller) return;

    // First select source
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const sources = (room.memory as any).sources;
    if (!sources || !sources.count || sources.count === 0) {
      // No source nothing to evaluate
      return;
    }

    // TODO: improve the way you choose witch source to get resources
    // For example max spot?
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const source = _.find(sources, (s: any) => {
      return sources.count === 1 || (s.closestController === true && s.spot && s.spot > 0);
    });

    // find position
    if (!source) return;

    const gSource = Game.getObjectById(source.id);
    if (!gSource) {
      log.warning(`${source.id as string}: Source No found!`);
      return;
    }
    const gS = gSource as Source;

    const positions = this.findPlaceRoom(wD, eD, sC, planner, roomName);

    if (positions.length === 0) {
      log.warning("No place found for resources town");
      return;
    }

    // find the closest place to source
    const closest = gS.pos.findClosestByPath(positions);

    if (!closest) {
      log.warning("No closest resource town to source ${source.id}");
      return;
    }

    // Mark this space like unable!
    const mcBuild = PathFinder.CostMatrix.deserialize(planner.bmc as number[]);
    const axis = (sC - 1) / 2;
    const x = closest.x;
    const y = closest.y;
    const fStorage = room.createFlag(x, y, undefined, COLOR_YELLOW);
    if (Game.flags[fStorage]) {
      Game.flags[fStorage].memory = {
        type: STRUCTURE_STORAGE,
        priority: 1,
        builded: 0
      };
    }

    for (let dx = -1 * axis; dx <= axis; dx++) {
      for (let dy = -1 * axis; dy <= axis; dy++) {
        const nx = x + dx < 0 ? 0 : x + dx > 49 ? 49 : x + dx;
        const ny = y + dy < 0 ? 0 : y + dy > 49 ? 49 : y + dy;

        if (!(dx === 0 && dy === 0) && Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
          const fExpansion = room.createFlag(nx, ny, undefined, COLOR_BLUE);
          if (Game.flags[fExpansion]) {
            Game.flags[fExpansion].memory = {
              type: STRUCTURE_EXTENSION,
              priority: 1,
              builded: 0
            };
          }
        }
        mcBuild.set(nx, ny, 20);
      }
    }

    // Build Road to this place
    const pathToSource = room.findPath(closest, gS.pos);

    if (pathToSource.length > 0) {
      source.path = Room.serializePath(pathToSource);
      _.forEach(pathToSource, p => {
        const fRoad = room.createFlag(p.x, p.y, undefined, COLOR_GREY);
        if (Game.flags[fRoad]) {
          Game.flags[fRoad].memory = {
            type: STRUCTURE_ROAD,
            priority: 1,
            builded: 0
          };
        }
        mcBuild.set(p.x, p.y, 1);
      });
    }

    // Build Road to Controller
    const pathToControllerOne = room.findPath(room.controller.pos, gS.pos);
    if (pathToControllerOne.length > 0) {
      source.cpath = Room.serializePath(pathToControllerOne);
      _.forEach(pathToControllerOne, p => {
        const fRoad = room.createFlag(p.x, p.y, undefined, COLOR_GREY);
        if (Game.flags[fRoad]) {
          Game.flags[fRoad].memory = {
            type: STRUCTURE_ROAD,
            priority: 1,
            builded: 0
          };
        }
        mcBuild.set(p.x, p.y, 1);
      });
    }

    planner.bmc = mcBuild.serialize();
  }

  private evaluateBuildInRoom(roomName: string, planner: PlannerMemory) {
    const mcBuild = PathFinder.CostMatrix.deserialize(planner.bmc as number[]);
    const room = Game.rooms[roomName];
    if (!room.controller) return;

    const structures = room.find(FIND_MY_STRUCTURES);

    _.forEach(structures, s => {
      mcBuild.set(s.pos.x, s.pos.y, 8);
    });

    planner.bmc = mcBuild.serialize();
  }

  private evaluateSourcesInRoom(roomName: string) {
    const room = Game.rooms[roomName];
    const terrain = room.getTerrain();

    const sources = room.find(FIND_SOURCES);
    (room.memory as any).sources = {};

    _.forEach(sources, s => {
      const x = s.pos.x;
      const y = s.pos.y;
      (room.memory as any).sources[s.id] = { id: s.id, spot: 0, closestController: false };

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = x + dx < 0 ? 0 : x + dx > 49 ? 49 : x + dx;
          const ny = y + dy < 0 ? 0 : y + dy > 49 ? 49 : y + dy;

          if ((nx !== 0 || ny !== 0) && terrain.get(nx, ny) !== TERRAIN_MASK_WALL) {
            (room.memory as any).sources[s.id].spot++;
          }
        }
      }
    });

    (room.memory as any).sources.count = sources.length;

    if (sources.length > 0 && room.controller) {
      const sClosests = room.controller.pos.findClosestByPath(sources);
      if (sClosests) {
        (room.memory as any).sources[sClosests.id].closestController = true;
      }
    }
  }

  private calculateDistanceWall(roomName: string, planner: PlannerMemory) {
    const matrix = new PathFinder.CostMatrix();
    const exitMatrix = new PathFinder.CostMatrix();
    const buildMatrix = new PathFinder.CostMatrix();
    const terrain = Game.rooms[roomName].getTerrain();

    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
          matrix.set(x, y, 255);
          exitMatrix.set(x, y, 255);
          buildMatrix.set(x, y, 255);
          continue;
        }

        if (x === 0 || x === 49 || y === 0 || y === 49) {
          exitMatrix.set(x, y, 1);
        }

        let fWall = false;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = x + dx < 0 ? 0 : x + dx > 49 ? 49 : x + dx;
            const ny = y + dy < 0 ? 0 : y + dy > 49 ? 49 : y + dy;

            if ((nx !== 0 || ny !== 0) && terrain.get(nx, ny) === TERRAIN_MASK_WALL) {
              matrix.set(x, y, 1);
              fWall = true;
              break;
            }

            if (fWall) break;
          }
        }
      }
    }

    let currentDistance = 1;
    let maxWallDistance = 1;
    let done = false;
    let setWallDistance = false;
    while (!done) {
      done = true;
      setWallDistance = false;
      for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
          if (matrix.get(x, y) === 0) {
            let fNumber = false;
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx < 0 ? 0 : x + dx > 49 ? 49 : x + dx;
                const ny = y + dy < 0 ? 0 : y + dy > 49 ? 49 : y + dy;

                if ((nx !== 0 || ny !== 0) && matrix.get(nx, ny) === currentDistance) {
                  matrix.set(x, y, currentDistance + 1);
                  setWallDistance = true;
                  fNumber = true;
                  done = false;
                  break;
                }

                if (fNumber) break;
              }
            }
          }
        }
      }

      for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
          if (exitMatrix.get(x, y) === 0) {
            let fNumber = false;
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx < 0 ? 0 : x + dx > 49 ? 49 : x + dx;
                const ny = y + dy < 0 ? 0 : y + dy > 49 ? 49 : y + dy;

                if ((nx !== 0 || ny !== 0) && exitMatrix.get(nx, ny) === currentDistance) {
                  exitMatrix.set(x, y, currentDistance + 1);
                  fNumber = true;
                  done = false;
                  break;
                }

                if (fNumber) break;
              }
            }
          }
        }
      }

      currentDistance++;
      if (setWallDistance) {
        maxWallDistance++;
      }
    }

    const cColors = generateColors("#006400", "#98FB98", maxWallDistance);
    const cColors2 = generateColors("#006400", "#98FB98", currentDistance - 1);
    const cColors3 = generateColors("#006400", "#98FB98", 20);
    const gColors = _.reduce(
      cColors,
      (r, c, i: number) => {
        r[i + 1] = c;
        return r;
      },
      { 255: "black" } as { [index: string]: string }
    );

    const gColors2 = _.reduce(
      cColors2,
      (r, c, i: number) => {
        r[i + 1] = c;
        return r;
      },
      { 255: "black" } as { [index: string]: string }
    );

    const gColors3 = _.reduce(
      cColors3,
      (r, c, i: number) => {
        r[i + 1] = c;
        return r;
      },
      { 255: "black" } as { [index: string]: string }
    );

    planner.wmc = matrix.serialize();
    planner.wc = gColors;
    planner.emc = exitMatrix.serialize();
    planner.ec = gColors2;
    planner.bmc = buildMatrix.serialize();
    planner.bc = gColors3;
    planner.status = 1;
  }
}
