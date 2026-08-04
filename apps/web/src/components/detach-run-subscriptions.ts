/**
 * Close local run SSE subscriptions without canceling daemon execution.
 *
 * Stop is the only UI action that may abort cancel controllers (which map to
 * POST /api/runs/:id/cancel). Conversation/project teardown must only abort
 * stream signals and clear the streaming latch so reattach can run again.
 */
export function detachRunSubscriptions(options: {
  reattachControllers: Map<string, AbortController>;
  reattachCancelControllers: Map<string, AbortController>;
  abortController: AbortController | null;
  cancelController: AbortController | null;
  setStreaming: (streaming: boolean) => void;
}): { abortController: null; cancelController: null } {
  for (const controller of options.reattachControllers.values()) {
    controller.abort();
  }
  options.reattachControllers.clear();
  // Forget cancel controllers without aborting — do not cancel the daemon run.
  options.reattachCancelControllers.clear();
  options.abortController?.abort();
  options.setStreaming(false);
  return { abortController: null, cancelController: null };
}
