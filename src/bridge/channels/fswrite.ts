import type { DaemonFrame } from "../../shared/types.ts";
import type { ChannelHandler, BridgeContext } from "../index.ts";
import { BaseChannel, payloadObject, writeSafeFile } from "./helpers.ts";

export class FsWriteChannel extends BaseChannel implements ChannelHandler {
  constructor(context: BridgeContext) {
    super(context);
  }

  async open(frame: DaemonFrame): Promise<void> {
    const payload = payloadObject(frame);
    await writeSafeFile(payload.path, payload.content);
    this.ready(frame);
    this.emitData(frame, { ok: true });
    this.exit(frame, 0);
  }
}
