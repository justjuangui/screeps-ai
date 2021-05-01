import { ProcessConstructor } from "../components/Process";
import { ProcessRegistry } from "../components/ProcessRegistry";

export function registerProcess(constructor: ProcessConstructor): void {
  ProcessRegistry.register(constructor);
}
