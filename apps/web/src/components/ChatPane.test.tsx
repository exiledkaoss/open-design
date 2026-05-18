import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ChatPane, ConversationRow } from './ChatPane';
import type { Conversation } from '../types';
import type { Dict } from '../i18n/types';

const conversation: Conversation = {
  id: 'conv-a',
  projectId: 'project-1',
  title: 'Conversation A',
  createdAt: 1710000000,
  updatedAt: 1710000000,
};

const t = ((key: keyof Dict) => key) as (key: keyof Dict, vars?: Record<string, string | number>) => string;

describe('ChatPane conversation controls', () => {
  it('disables conversation switching and deletion while a run is streaming', () => {
    const markup = renderToStaticMarkup(
      <ConversationRow
        conversation={conversation}
        active={false}
        onSelect={() => {}}
        onDelete={() => {}}
        t={t}
        disabled
      />,
    );

    expect(markup).toMatch(/data-testid="conversation-select-conv-a"[^>]*disabled/);
    expect(markup).toMatch(/data-testid="conversation-delete-conv-a"[^>]*disabled/);
  });

  it('disables creating a new conversation while a run is streaming', () => {
    const markup = renderToStaticMarkup(
      <ChatPane
        messages={[]}
        streaming
        error={null}
        projectId="project-1"
        projectFiles={[]}
        onEnsureProject={async () => 'project-1'}
        onSend={() => {}}
        onStop={() => {}}
        onNewConversation={() => {}}
        conversations={[conversation]}
        activeConversationId={conversation.id}
        onSelectConversation={() => {}}
        onDeleteConversation={() => {}}
      />,
    );

    expect(markup).toMatch(/data-testid="new-conversation"[^>]*disabled/);
  });
});
