export class Messages {
  // TODO: Change to ENUM! AND REFACTOR!
  public static REQUEST_PLANNER_ROOM = "reqplaroo";
  public static RESPONSE_PLANNER_ROOM = "resplaroo";

  public static REQUEST_NEW_CITY = "reqnewcit";

  public static EVENT_WORLD_ENEMY = "eveworene";

  public static REQUEST_VISUAL_ROOM_WALL = "reqvisroowal";
  public static REQUEST_VISUAL_ROOM_EXIT = "reqvisrooexi";
  public static REQUEST_VISUAL_ROOM_BUILD = "reqvisroobui";
  public static REQUEST_VISUAL_NONE = "reqvisnon";

  // Spawn Message
  public static REQUEST_SPAWNER_CREEP = "reqspacre";
  public static RESPONSE_SPAWNER_CREEP = "resspacre";
}

export enum MessageContext {
  Global = 1, // All Process
  Children, // my process
  Group, // brothers an parents process
  Local // Myself Message
}

export enum MessagePriority {
  High = 1,
  Normal,
  Low
}

export interface MessageSubscription {
  pid: number;
  ppid: number;
  type: string;
  context: MessageContext;
}

export interface MessagePayload {
  priority: MessagePriority;
  type: string;
  context: MessageContext;
  sent?: boolean;
  pid: number; // Use for response a message
  ppid: number;
  data?: any;
}
