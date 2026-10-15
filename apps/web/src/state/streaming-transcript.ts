import type { ChatMessage } from '../types';

export interface StreamingTranscript {
  conversationId: string;
  message: ChatMessage;
}

/**
 * Advance the durable transcript for one assistant message.
 *
 * The visible list is whatever conversation is on screen. After the user
 * switches conversations it no longer contains this message, but the run
 * keeps producing tokens. Those tokens have to land on the transcript that
 * belongs to the conversation the run started in, so a later reload can
 * show them. A stale visible copy must not replace a newer transcript.
 */
export function nextStreamingTranscript(
  transcript: StreamingTranscript | null,
  visible: readonly ChatMessage[],
  conversationId: string,
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
): StreamingTranscript | null {
  const base =
    transcript &&
    transcript.conversationId === conversationId &&
    transcript.message.id === messageId
      ? transcript.message
      : visible.find((message) => message.id === messageId) ?? null;
  if (!base) return transcript;
  return { conversationId, message: updater(base) };
}

export function overlayStreamingTranscripts(
  loaded: readonly ChatMessage[],
  transcripts: ReadonlyMap<string, StreamingTranscript>,
  conversationId: string,
): ChatMessage[] {
  return loaded.map((message) => {
    const snap = transcripts.get(message.id);
    if (!snap || snap.conversationId !== conversationId) return message;
    return snap.message;
  });
}
