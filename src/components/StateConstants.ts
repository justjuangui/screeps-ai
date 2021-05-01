export class StateConstants {
  public static WORLD_STATE_NAME = "wstate";
  public static ROOM_STATE_PREFIX = "rstate_";
  public static BUILD_PLANNER_STATE = "bplannerstate";

  public static getRoomStateKey(roomName: string): string {
    return `${StateConstants.ROOM_STATE_PREFIX}${roomName}`;
  }
}
