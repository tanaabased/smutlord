import assert from 'node:assert/strict';

import normalizeSkillDescription, {
  makeDefaultPrompt,
  makeShortDescription,
} from '../utils/normalize-skill-description.js';

describe('skills/skill-author/utils/normalize-skill-description', () => {
  it('should apply one smutlord prefix and preserve empty input', () => {
    assert.equal(normalizeSkillDescription(''), '');
    assert.equal(
      normalizeSkillDescription('  SMUTLORD-based validating local skills.  '),
      'smutlord-based validating local skills.',
    );
    assert.equal(
      normalizeSkillDescription('Smutlord based validating local skills.'),
      'smutlord-based validating local skills.',
    );
  });

  it('should cap short descriptions at 64 characters', () => {
    const shortDescription = makeShortDescription(
      'smutlord-based authoring an intentionally long local skill description that exceeds the limit.',
    );

    assert.equal(shortDescription.length, 64);
    assert.match(shortDescription, /^smutlord-based /);
    assert.match(shortDescription, /\.\.\.$/);
  });

  it('should create a prompt with the machine id and normalized action', () => {
    assert.equal(
      makeDefaultPrompt('smutlord-skill-author', 'smutlord-based Author local skills.'),
      'Use $smutlord-skill-author when you need to author local skills.',
    );
  });
});
