import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { applyProjectFileResponseHeaders } from '../src/server.js';

function createResponseRecorder() {
  const headers = new Map<string, string>();
  return {
    res: {
      attachment(name: string) {
        headers.set('content-disposition', `attachment; filename="${name}"`);
      },
      getHeader(name: string) {
        return headers.get(name.toLowerCase());
      },
    },
    headers,
  };
}

describe('applyProjectFileResponseHeaders', () => {
  it('forces SVG project files to download when opened directly', () => {
    const { res } = createResponseRecorder();

    applyProjectFileHeaders(res, {
      name: 'nested/malicious.svg',
      mime: 'image/svg+xml',
    });

    assert.equal(
      res.getHeader('content-disposition'),
      'attachment; filename="malicious.svg"',
    );
  });

  it('leaves inert project file types inline', () => {
    const { res } = createResponseRecorder();

    applyProjectFileHeaders(res, {
      name: 'screen.png',
      mime: 'image/png',
    });

    assert.equal(res.getHeader('content-disposition'), undefined);
  });
});
