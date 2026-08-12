import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APP_KEYS,
  OPEN_DESIGN_SIDECAR_CONTRACT,
  SIDECAR_MODES,
  SIDECAR_SOURCES,
} from "@open-design/sidecar-proto";
import { resolveAppIpcPath } from "@open-design/sidecar";
import { createProcessStampArgs } from "@open-design/platform";

import { liveDesktopProcessMatchesMarker } from "./mac.js";

function desktopCommand(namespace: string, executablePath: string): string {
  const ipc = resolveAppIpcPath({
    app: APP_KEYS.DESKTOP,
    contract: OPEN_DESIGN_SIDECAR_CONTRACT,
    namespace,
  });
  const stamp = {
    app: APP_KEYS.DESKTOP,
    ipc,
    mode: SIDECAR_MODES.RUNTIME,
    namespace,
    source: SIDECAR_SOURCES.TOOLS_PACK,
  };
  const args = createProcessStampArgs(stamp, OPEN_DESIGN_SIDECAR_CONTRACT);
  return [executablePath, ...args].join(" ");
}

describe("liveDesktopProcessMatchesMarker", () => {
  const executablePath = "/tmp/Open Design.app/Contents/MacOS/Open Design";
  const marker = {
    appPath: "/tmp/Open Design.app",
    executablePath,
    logPath: "/tmp/alpha/logs/desktop/latest.log",
    namespaceRoot: "/tmp/tools-pack/runtime/mac/namespaces/alpha",
    pid: 100,
    ppid: 1,
    stamp: {
      app: APP_KEYS.DESKTOP,
      ipc: resolveAppIpcPath({
        app: APP_KEYS.DESKTOP,
        contract: OPEN_DESIGN_SIDECAR_CONTRACT,
        namespace: "alpha",
      }),
      mode: SIDECAR_MODES.RUNTIME,
      namespace: "alpha",
      source: SIDECAR_SOURCES.TOOLS_PACK,
    },
    startedAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    version: 1 as const,
  };

  it("accepts a live process whose stamp still matches the marker namespace", () => {
    assert.equal(
      liveDesktopProcessMatchesMarker({
        expectedIpc: marker.stamp.ipc,
        expectedNamespace: "alpha",
        marker,
        processCommand: desktopCommand("alpha", executablePath),
      }),
      true,
    );
  });

  it("rejects PID reuse by another namespace that shares the same app binary", () => {
    assert.equal(
      liveDesktopProcessMatchesMarker({
        expectedIpc: marker.stamp.ipc,
        expectedNamespace: "alpha",
        marker,
        processCommand: desktopCommand("beta", executablePath),
      }),
      false,
    );
  });

  it("rejects a matching path without a parseable live stamp", () => {
    assert.equal(
      liveDesktopProcessMatchesMarker({
        expectedIpc: marker.stamp.ipc,
        expectedNamespace: "alpha",
        marker,
        processCommand: executablePath,
      }),
      false,
    );
  });
});
