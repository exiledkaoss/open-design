export interface RunSubscriptionControllers {
  activeStream: AbortController | null;
  streamControllers: Map<string, AbortController>;
  cancelControllers: Map<string, AbortController>;
}

/**
 * Detach browser-side event subscriptions without canceling daemon-owned runs.
 *
 * Cancellation controllers are deliberately only forgotten here. Aborting one
 * invokes POST /api/runs/:id/cancel; that is reserved for the Stop action.
 */
export function detachRunSubscriptions({
  activeStream,
  streamControllers,
  cancelControllers,
}: RunSubscriptionControllers): void {
  activeStream?.abort();
  for (const controller of streamControllers.values()) {
    controller.abort();
  }
  streamControllers.clear();
  cancelControllers.clear();
}
