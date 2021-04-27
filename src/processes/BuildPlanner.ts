import { Process, ProcessPriority, StateConstants } from "../components/Process";
import { registerProcess } from "../decorators/registerProcess";
import { log } from "lib/logger/log";
import { forEach, reduce } from "lodash";
import { generateColors } from "../utils/colorsgenerator";
import { MessagePayload, Messages, MessageContext, MessageSubscription, MessagePriority } from "components/Requestor";

@registerProcess
export class BuildPlannerProcess extends Process {
    public static start(ppid: number) {
        const proc = Process.startNewProcess(BuildPlannerProcess, ppid, undefined, ProcessPriority.High)
        proc.memory.stateName = StateConstants.BUILD_PLANNER_STATE
        return proc.pid
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

        if (message.type == Messages.REQUEST_PLANNER_ROOM) {
            let roomName = (<string>message.data);
            if (Game.rooms[roomName] === undefined) {
                log.info(`BP: No valid room ${roomName}`);
                return null;
            }

            Memory.rooms[roomName].planner = Memory.rooms[roomName].planner || { status: 0 };
            let planner: PlannerMemory = Memory.rooms[roomName].planner || { status: 0 };
            if (planner.status == 0) {
                log.info(`BP: Analyzing room ${roomName}`);
                // TODO: Split this into Local Messages
                this.calculateDistanceWall(roomName, planner);
                this.evaluateSourcesInRoom(roomName);
                this.evaluateControllerInRoom(roomName);
                this.evaluateBuildInRoom(roomName, planner)
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
        let room = Game.rooms[roomName];
        if (!room.controller) return;
        let terrain = room.getTerrain();
        let x = room.controller.pos.x;
        let y = room.controller.pos.y;
        (<any>room.memory).controller = { spot: 0 };
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                let nx = (x + dx < 0 ? 0 : (x + dx > 49 ? 49 : x + dx));
                let ny = (y + dy < 0 ? 0 : (y + dy > 49 ? 49 : y + dy));

                if ((nx != 0 || ny != 0) && terrain.get(nx, ny) != TERRAIN_MASK_WALL) {
                    (<any>room.memory).controller.spot++;
                }
            }
        }
    }

    private findPlaceRoom(wallDistance: number, exitDistance: number, space: number, planner: PlannerMemory, roomName: string): RoomPosition[] {
        let places: RoomPosition[] = [];

        let mcBuild = PathFinder.CostMatrix.deserialize(<number[]>planner.bmc);
        let mcWall = PathFinder.CostMatrix.deserialize(<number[]>planner.wmc);
        let mcExit = PathFinder.CostMatrix.deserialize(<number[]>planner.emc);
        let axis = (space - 1) / 2;

        // TODO: Refactor this
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                let dWall = mcWall.get(x, y);
                if (dWall == 255) continue; // Wall
                if (dWall < wallDistance) continue;
                if (mcExit.get(x, y) < exitDistance) continue;
                if (mcBuild.get(x, y) > 0) continue; // Place  took

                let valid: boolean = true;
                for (let dx = -1 * axis; dx <= axis; dx++) {
                    for (let dy = -1 * axis; dy <= axis; dy++) {
                        let nx = (x + dx < 0 ? 0 : (x + dx > 49 ? 49 : x + dx));
                        let ny = (y + dy < 0 ? 0 : (y + dy > 49 ? 49 : y + dy));

                        if ((nx != 0 || ny != 0)) {
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
        const wD: number = 8;
        const eD: number = 12;
        const sC: number = 7;

        let room = Game.rooms[roomName];
        if (!room.controller) return;

        // First select source
        let sources: any = (<any>room.memory).sources;
        if (!sources || !sources.count || sources.count == 0) {
            // No source nothing to evaluate
            return;
        }

        // TODO: improve the way you choose witch source to get resources
        // For example max spot?
        let source: any = _.find(sources, s => {
            return sources.count == 1 || (s.closestController == true && s.spot && s.spot > 0);
        });

        // find position
        if (!source) return;

        let gSource = Game.getObjectById(source.id);
        if (!gSource) {
            log.warning(`${source.id}: Source No found!`);
            return;
        }
        let gS = <Source>gSource;

        let positions = this.findPlaceRoom(wD, eD, sC, planner, roomName);

        if (positions.length == 0) {
            log.warning("No place found for resources town");
            return;
        }

        // find the closest place to source
        let closest = gS.pos.findClosestByPath(positions);

        if (!closest) {
            log.warning("No closest resource town to source ${source.id}");
            return;
        }

        // Mark this space like unable!
        let mcBuild = PathFinder.CostMatrix.deserialize(<number[]>planner.bmc);
        let axis = (sC - 1) / 2;
        let x = closest.x;
        let y = closest.y;
        let fStorage = room.createFlag(x, y, undefined, COLOR_YELLOW);
        if (Game.flags[fStorage]) {
            Game.flags[fStorage].memory = {
                type: STRUCTURE_STORAGE,
                priority: 1,
                builded: 0
            };
        }


        for (let dx = -1 * axis; dx <= axis; dx++) {
            for (let dy = -1 * axis; dy <= axis; dy++) {
                let nx = (x + dx < 0 ? 0 : (x + dx > 49 ? 49 : x + dx));
                let ny = (y + dy < 0 ? 0 : (y + dy > 49 ? 49 : y + dy));

                if (!(dx == 0 && dy == 0) && Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
                    let fExpansion = room.createFlag(nx, ny, undefined, COLOR_BLUE);
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
        let pathToSource = room.findPath(closest, gS.pos);

        if (pathToSource.length > 0) {
            source.path = Room.serializePath(pathToSource);
            _.forEach(pathToSource, p => {
                let fRoad = room.createFlag(p.x, p.y, undefined, COLOR_GREY);
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
        let pathToControllerOne = room.findPath(room.controller.pos, gS.pos);
        if (pathToControllerOne.length > 0) {
            source.cpath = Room.serializePath(pathToControllerOne);
            _.forEach(pathToControllerOne, p => {
                let fRoad = room.createFlag(p.x, p.y, undefined, COLOR_GREY);
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
        let mcBuild = PathFinder.CostMatrix.deserialize(<number[]>planner.bmc);
        let room = Game.rooms[roomName];
        if (!room.controller) return;

        let structures = room.find(FIND_MY_STRUCTURES);

        _.forEach(structures, s => {
            mcBuild.set(s.pos.x, s.pos.y, 8);
        });

        planner.bmc = mcBuild.serialize();
    }

    private evaluateSourcesInRoom(roomName: string) {
        let room = Game.rooms[roomName];
        let terrain = room.getTerrain();

        const sources = room.find(FIND_SOURCES);
        (<any>room.memory).sources = {};

        _.forEach(sources, s => {
            let x = s.pos.x;
            let y = s.pos.y;
            (<any>room.memory).sources[s.id] = { id: s.id, spot: 0, closestController: false };

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    let nx = (x + dx < 0 ? 0 : (x + dx > 49 ? 49 : x + dx));
                    let ny = (y + dy < 0 ? 0 : (y + dy > 49 ? 49 : y + dy));

                    if ((nx != 0 || ny != 0) && terrain.get(nx, ny) != TERRAIN_MASK_WALL) {
                        (<any>room.memory).sources[s.id].spot++;
                    }
                }
            }
        });

        (<any>room.memory).sources["count"] = sources.length;

        if (sources.length > 0 && room.controller) {
            let sClosests = room.controller.pos.findClosestByPath(sources);
            if (sClosests) {
                (<any>room.memory).sources[sClosests.id].closestController = true;
            }
        }
    }

    private calculateDistanceWall(roomName: string, planner: PlannerMemory) {
        let matrix = new PathFinder.CostMatrix();
        let exitMatrix = new PathFinder.CostMatrix();
        let buildMatrix = new PathFinder.CostMatrix();
        let terrain = Game.rooms[roomName].getTerrain();

        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (terrain.get(x, y) == TERRAIN_MASK_WALL) {
                    matrix.set(x, y, 255);
                    exitMatrix.set(x, y, 255);
                    buildMatrix.set(x, y, 255);
                    continue;
                }

                if (x == 0 || x == 49 || y == 0 || y == 49) {
                    exitMatrix.set(x, y, 1);
                }

                let fWall = false;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        let nx = (x + dx < 0 ? 0 : (x + dx > 49 ? 49 : x + dx));
                        let ny = (y + dy < 0 ? 0 : (y + dy > 49 ? 49 : y + dy));

                        if ((nx != 0 || ny != 0) && terrain.get(nx, ny) == TERRAIN_MASK_WALL) {
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
                    if (matrix.get(x, y) == 0) {
                        let fNumber = false;
                        for (let dx = -1; dx <= 1; dx++) {
                            for (let dy = -1; dy <= 1; dy++) {
                                let nx = (x + dx < 0 ? 0 : (x + dx > 49 ? 49 : x + dx));
                                let ny = (y + dy < 0 ? 0 : (y + dy > 49 ? 49 : y + dy));

                                if ((nx != 0 || ny != 0) && matrix.get(nx, ny) == currentDistance) {
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
                    if (exitMatrix.get(x, y) == 0) {
                        let fNumber = false;
                        for (let dx = -1; dx <= 1; dx++) {
                            for (let dy = -1; dy <= 1; dy++) {
                                let nx = (x + dx < 0 ? 0 : (x + dx > 49 ? 49 : x + dx));
                                let ny = (y + dy < 0 ? 0 : (y + dy > 49 ? 49 : y + dy));

                                if ((nx != 0 || ny != 0) && exitMatrix.get(nx, ny) == currentDistance) {
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

        let cColors = generateColors("#006400", "#98FB98", maxWallDistance);
        let cColors2 = generateColors("#006400", "#98FB98", currentDistance - 1);
        let cColors3 = generateColors("#006400", "#98FB98", 20);
        let gColors = reduce(cColors, (r, c, i) => {
            r[i + 1] = c;
            return r;
        }, (<{ [index: string]: string }>{ 255: 'black' }));

        let gColors2 = reduce(cColors2, (r, c, i) => {
            r[i + 1] = c;
            return r;
        }, (<{ [index: string]: string }>{ 255: 'black' }));

        let gColors3 = reduce(cColors3, (r, c, i) => {
            r[i + 1] = c;
            return r;
        }, (<{ [index: string]: string }>{ 255: 'black' }));

        planner.wmc = matrix.serialize();
        planner.wc = gColors;
        planner.emc = exitMatrix.serialize();
        planner.ec = gColors2;
        planner.bmc = buildMatrix.serialize();
        planner.bc = gColors3;
        planner.status = 1;
    }
}
