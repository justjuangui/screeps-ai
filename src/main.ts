import { Kernel } from "./components/Kernel";
import { Stats } from "./components/Stats";
import { log } from "./lib/logger/log";
import { ErrorMapper } from "utils/ErrorMapper";


log.info(`loading revision: 1`)

export const loop = ErrorMapper.wrapLoop(() => {
  Kernel.load()
  Kernel.run()
  Kernel.save()
  Stats.collect()
});
