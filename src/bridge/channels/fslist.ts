import type { DaemonFrame } from "../../shared/types.ts";
import type { ChannelHandler, BridgeContext } from "../index.ts";
import { BaseChannel, listSafeDirectory, payloadObject } from "./helpers.ts";

export class FsListChannel extends BaseChannel implements ChannelHandler {
  constructor(context: BridgeContext) {
    super(context);
  }

  async open(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    this.ready(frame);
    this.emitData(frame, { entries: await listSafeDirectory(payload.path) });
    this.exit(frame, 0);
  }
}
