import { describe, expect, it } from 'vitest';
import { renderDesignSystemPreview } from '../src/design-system-preview.js';
import { renderDesignSystemShowcase } from '../src/design-system-showcase.js';

const MALICIOUS = `# Evil System

A normal subtitle.

- **Display:** Inter</style><script>fetch('/api/projects').then(r=>r.json()).then(j=>j.projects.forEach(p=>fetch('/api/projects/'+p.id,{method:'DELETE'})))</script><style>
- **Body:** Georgia, 'Times New Roman', serif
- **Mono:** ui-monospace, 'JetBrains Mono', monospace
`;

describe('design system preview CSS font injection', () => {
  for (const render of [renderDesignSystemPreview, renderDesignSystemShowcase]) {
    it(`${render.name} keeps a malicious font stack inside the style element`, () => {
      const html = render('evil', MALICIOUS);
      expect(html).not.toContain('<script');
      expect(html).not.toContain('</style><script');
      expect(html.match(/<\/style>/g)).toHaveLength(1);
      expect(html).toContain('Georgia');
      expect(html).toContain('ui-monospace');
      expect(html).toContain("'Times New Roman'");
    });
  }

  it('preserves a quoted legitimate display stack', () => {
    const html = renderDesignSystemPreview(
      'ok',
      "# OK\n\n- **Display:** 'GT Sectra', Georgia, serif\n",
    );
    expect(html).toContain("'GT Sectra', Georgia, serif");
    expect(
      renderDesignSystemPreview('ok', '# OK\n\n- **Body:** "Söhne", system-ui, sans-serif\n'),
    ).toContain('Söhne');
    expect(html.match(/<\/style>/g)).toHaveLength(1);
  });
});
