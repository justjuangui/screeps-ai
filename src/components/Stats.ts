export class Stats {
  public static collect(): void {
    Memory.stats = {
      cpu: { bucket: 0, limit: 0, used: 0 },
      gcl: { progress: 0, progressTotal: 0, level: 0 },
      memory: { used: 0 },
      rooms: {},
      time: Game.time,
      totalCreepCount: _.size(Game.creeps)
    };

    // Collect room stats
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      const isMyRoom = room.controller ? room.controller.my : false;
      if (isMyRoom) {
        const roomStats: MyRoomStats = (Memory.stats.rooms[roomName] = {});
        roomStats.storageEnergy = room.storage ? room.storage.store.energy : 0;
        roomStats.terminalEnergy = room.terminal ? room.terminal.store.energy : 0;
        roomStats.energyAvailable = room.energyAvailable;
        roomStats.energyCapacityAvailable = room.energyCapacityAvailable;
        roomStats.controllerProgress = room.controller?.progress ?? 0.0;
        roomStats.controllerProgressTotal = room.controller?.progressTotal ?? 0;
        roomStats.controllerLevel = room.controller?.level ?? 0;
      }
    }

    // Collect GCL stats
    Memory.stats.gcl.progress = Game.gcl.progress;
    Memory.stats.gcl.progressTotal = Game.gcl.progressTotal;
    Memory.stats.gcl.level = Game.gcl.level;

    // Collect Memory stats
    Memory.stats.memory.used = RawMemory.get().length;

    // Collect CPU stats
    Memory.stats.cpu.bucket = Game.cpu.bucket;
    Memory.stats.cpu.limit = Game.cpu.limit;
    Memory.stats.cpu.used = Game.cpu.getUsed();
  }
}
