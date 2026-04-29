import type { DaemonFrame } from "../../shared/types.ts";
import type { ChannelHandler, BridgeContext } from "../index.ts";
import { BaseChannel, payloadObject, readSafeFile } from "./helpers.ts";

export class FsReadChannel extends BaseChannel implements ChannelHandler {
  constructor(context: BridgeContext) {
    super(context);
  }

  async open(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    this.ready(frame);
    this.emitData(frame, { content: await readSafeFile(payload.path, 10 * 1024 * 1024) });
    this.exit(frame, 0);
  }
}
