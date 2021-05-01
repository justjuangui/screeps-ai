/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
import * as Config from "../../config/config";
import { LogLevels } from "./logLevels";
import { SourceMapConsumer } from "source-map";
// <caller> (<source>:<line>:<column>)
const stackLineRe = /([^ ]*) \(([^:]*):([0-9]*):([0-9]*)\)/;

interface SourcePos {
  compiled: string;
  final: string;
  original: string | undefined;
  caller: string | undefined;
  path: string | undefined;
  line: number | undefined;
}

export class Log {
  public static sourceMap: SourceMapConsumer;

  public static loadSourceMap(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const map = require("main.js.map");
      if (map) {
        Log.sourceMap = new SourceMapConsumer(map);
      }
    } catch (err) {
      console.log("failed to load source map", err);
    }
  }

  public get level(): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return Memory.log.level as number;
  }
  public set level(value: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Memory.log.level = value;
  }
  public get showSource(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return Memory.log.showSource as boolean;
  }
  public set showSource(value: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Memory.log.showSource = value;
  }
  public get showTick(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return Memory.log.showTick as boolean;
  }
  public set showTick(value: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Memory.log.showTick = value;
  }

  private _maxFileString = 0;

  public constructor() {
    _.defaultsDeep(Memory, {
      log: {
        level: Config.LOG_LEVEL,
        showSource: Config.LOG_PRINT_LINES,
        showTick: Config.LOG_PRINT_TICK
      }
    });
  }

  public trace(error: Error): Log {
    if (this.level >= LogLevels.ERROR && error.stack) {
      console.log(this.resolveStack(error.stack));
    }

    return this;
  }

  public error(...args: any[]): void {
    if (this.level >= LogLevels.ERROR) {
      console.log.apply(this, [this.buildArguments(LogLevels.ERROR).concat([].slice.call(args))]);
    }
  }

  public warning(...args: any[]): void {
    if (this.level >= LogLevels.WARNING) {
      console.log.apply(this, [this.buildArguments(LogLevels.WARNING).concat([].slice.call(args))]);
    }
  }

  public info(...args: any[]): void {
    if (this.level >= LogLevels.INFO) {
      console.log.apply(this, [this.buildArguments(LogLevels.INFO).concat([].slice.call(args))]);
    }
  }

  public debug(...args: any[]): void {
    if (this.level >= LogLevels.DEBUG) {
      console.log.apply(this, [this.buildArguments(LogLevels.DEBUG).concat([].slice.call(args))]);
    }
  }

  public getFileLine(upStack = 4): string {
    const stack = new Error("").stack;

    if (stack) {
      const lines = stack.split("\n");

      if (lines.length > upStack) {
        const originalLines = _.drop(lines, upStack).map(resolve);
        const hoverText = _.map(originalLines, "final").join("&#10;");
        return this.adjustFileLine(originalLines[0].final, tooltip(originalLines[0].toString(), hoverText));
      }
    }
    return "";
  }

  private buildArguments(level: number): string[] {
    const out: string[] = [];
    switch (level) {
      case LogLevels.ERROR:
        out.push(color("ERROR  ", "red"));
        break;
      case LogLevels.WARNING:
        out.push(color("WARNING", "yellow"));
        break;
      case LogLevels.INFO:
        out.push(color("INFO   ", "green"));
        break;
      case LogLevels.DEBUG:
        out.push(color("DEBUG  ", "gray"));
        break;
      default:
        break;
    }
    if (this.showTick) {
      out.push(time());
    }
    if (this.showSource) {
      out.push(this.getFileLine());
    }
    return out;
  }

  private resolveStack(stack: string): string {
    if (!Log.sourceMap) {
      return stack;
    }

    return _.map(stack.split("\n").map(resolve), "final").join("\n");
  }

  private adjustFileLine(visibleText: string, line: string): string {
    const newPad = Math.max(visibleText.length, this._maxFileString);
    this._maxFileString = Math.min(newPad, Config.LOG_MAX_PAD);

    return `|${_.padRight(line, line.length + this._maxFileString - visibleText.length, " ")}|`;
  }
}

export function resolve(fileLine: string): SourcePos {
  const split = stackLineRe.exec(_.trim(fileLine));
  if (!split || !Log.sourceMap) {
    return { compiled: fileLine, final: fileLine } as SourcePos;
  }

  const pos = { column: parseInt(split[4], 10), line: parseInt(split[3], 10) };

  const original = Log.sourceMap.originalPositionFor(pos);
  const line = `${split[1]} (${original.source}:${original.line})`;
  const out: SourcePos = {
    caller: split[1],
    compiled: fileLine,
    final: line,
    line: original.line,
    original: line,
    path: original.source
  };

  return out;
}

function color(str: string, pColor: string): string {
  return `<font color='${pColor}'>${str}</font>`;
}

function tooltip(str: string, pTooltip: string): string {
  return `<abbr title='${pTooltip}'>${str}</abbr>`;
}

function time(): string {
  return color(Game.time.toString(), "gray");
}

if (Config.LOG_LOAD_SOURCE_MAP) {
  Log.loadSourceMap();
}

export const log = new Log();

global.log = log;
