import { describe, expect, it } from 'vitest';
import { isConversationHistoryReady } from './message-list';

describe('isConversationHistoryReady', () => {
  it('stays closed until the active conversation has finished loading', () => {
    expect(isConversationHistoryReady(null, null)).toBe(false);
    expect(isConversationHistoryReady(null, 'conv-b')).toBe(false);
    expect(isConversationHistoryReady('conv-a', 'conv-b')).toBe(false);
  });

  it('opens only for the conversation whose history is loaded', () => {
    expect(isConversationHistoryReady('conv-a', 'conv-a')).toBe(true);
  });
});
