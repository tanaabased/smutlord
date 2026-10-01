import assert from 'node:assert/strict';

import renderSkillTemplate from '../utils/render-skill-template.js';

describe('skills/skill-author/utils/render-skill-template', () => {
  it('should replace known lowercase tokens and preserve unknown tokens', () => {
    assert.equal(
      renderSkillTemplate('{{skill_id}} uses {{unknown_token}}.', {
        skill_id: 'smutlord-example',
      }),
      'smutlord-example uses {{unknown_token}}.',
    );
  });
});
