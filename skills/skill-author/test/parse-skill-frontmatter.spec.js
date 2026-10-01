import assert from 'node:assert/strict';

import parseSkillFrontmatter, {
  splitLeadingSkillFrontmatter,
} from '../utils/parse-skill-frontmatter.js';

describe('skills/skill-author/utils/parse-skill-frontmatter', () => {
  const content = `---
name: smutlord-example
metadata:
  type: generic
  tags: [smutlord, generic, example]
  openclaw:
    emoji: '🧩'
    homepage: https://example.com/skill
    requires:
      bins:
        - bun
        - node
---
# Example
`;

  it('should parse nested metadata, lists, and the remaining body', () => {
    assert.deepEqual(parseSkillFrontmatter(content), {
      metadata: {
        openclaw: {
          emoji: '🧩',
          homepage: 'https://example.com/skill',
          requires: { bins: ['bun', 'node'] },
        },
        tags: ['smutlord', 'generic', 'example'],
        type: 'generic',
      },
      name: 'smutlord-example',
    });
    assert.equal(splitLeadingSkillFrontmatter(content).body, '# Example\n');
  });

  it('should distinguish absent skill frontmatter from a malformed template', () => {
    assert.equal(parseSkillFrontmatter('# Example\n'), null);
    assert.throws(
      () => splitLeadingSkillFrontmatter('# Example\n'),
      /Template is missing leading template frontmatter/,
    );
  });

  it('should retain fields after comments and decode multiline descriptions', () => {
    const text =
      '---\r\nname: smutlord-example\r\n# comment\r\nlicense: MIT\r\ndescription: >-\r\n  smutlord-based help:\r\n  keeps # punctuation.\r\n---\r\n# Example\r\n';
    assert.deepEqual(parseSkillFrontmatter(text), {
      name: 'smutlord-example',
      license: 'MIT',
      description: 'smutlord-based help: keeps # punctuation.',
    });
  });

  it('should reject invalid YAML instead of returning partially parsed metadata', () => {
    assert.throws(
      () => parseSkillFrontmatter('---\nname: smutlord-example\ndescription: bad: value\n---\n'),
      SyntaxError,
    );
    assert.throws(() => splitLeadingSkillFrontmatter('---\n- sequence\n---\n'), /mapping/);
  });
});
