/**
 * History for `activeConversationId` is safe to send against only after that
 * conversation's message GET has been applied. Sending earlier races the
 * in-flight GET, which replaces the whole list and drops the live turn.
 */
export function isConversationHistoryReady(
  loadedConversationId: string | null,
  activeConversationId: string | null,
): boolean {
  return activeConversationId !== null && loadedConversationId === activeConversationId;
}
