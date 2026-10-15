import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import {
  nextStreamingTranscript,
  overlayStreamingTranscripts,
  type StreamingTranscript,
} from './streaming-transcript';

function assistant(content: string, id = 'assistant-1'): ChatMessage {
  return { id, role: 'assistant', content, runStatus: 'running' };
}

describe('nextStreamingTranscript', () => {
  it('keeps appending after the visible conversation no longer contains the message', () => {
    const seeded: StreamingTranscript = {
      conversationId: 'conversation-a',
      message: assistant('Hello'),
    };
    const otherConversation = [assistant('unrelated', 'assistant-b')];

    const next = nextStreamingTranscript(
      seeded,
      otherConversation,
      'conversation-a',
      'assistant-1',
      (message) => ({ ...message, content: message.content + ' world' }),
    );

    expect(next?.conversationId).toBe('conversation-a');
    expect(next?.message.content).toBe('Hello world');
    expect(otherConversation[0]?.content).toBe('unrelated');
  });

  it('does not let a stale visible copy replace tokens already in the transcript', () => {
    const transcript: StreamingTranscript = {
      conversationId: 'conversation-a',
      message: assistant('Hello world'),
    };
    const staleVisible = [assistant('Hello')];

    const next = nextStreamingTranscript(
      transcript,
      staleVisible,
      'conversation-a',
      'assistant-1',
      (message) => ({ ...message, content: message.content + '!' }),
    );

    expect(next?.message.content).toBe('Hello world!');
  });

  it('seeds from the visible message before a transcript exists', () => {
    const visible = [assistant('Hi')];
    const next = nextStreamingTranscript(
      null,
      visible,
      'conversation-a',
      'assistant-1',
      (message) => ({ ...message, content: message.content + ' there' }),
    );
    expect(next).toEqual({
      conversationId: 'conversation-a',
      message: assistant('Hi there'),
    });
  });
});

describe('overlayStreamingTranscripts', () => {
  it('shows the in-flight transcript when its conversation is loaded again', () => {
    const transcripts = new Map<string, StreamingTranscript>([
      [
        'assistant-1',
        { conversationId: 'conversation-a', message: assistant('Hello world') },
      ],
    ]);
    const loaded = overlayStreamingTranscripts(
      [assistant('Hello')],
      transcripts,
      'conversation-a',
    );
    expect(loaded[0]?.content).toBe('Hello world');
  });

  it('does not apply another conversation’s transcript', () => {
    const transcripts = new Map<string, StreamingTranscript>([
      [
        'assistant-1',
        { conversationId: 'conversation-a', message: assistant('Hello world') },
      ],
    ]);
    const loaded = overlayStreamingTranscripts(
      [assistant('partial from B', 'assistant-1')],
      transcripts,
      'conversation-b',
    );
    expect(loaded[0]?.content).toBe('partial from B');
  });
});
