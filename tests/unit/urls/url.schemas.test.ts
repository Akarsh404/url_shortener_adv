import { RESERVED_ALIASES, ALIAS_REGEX, MAX_URL_LENGTH } from '../../../src/modules/urls/url.schemas';

describe('URL Schemas', () => {
  describe('Reserved Aliases', () => {
    it('should include common reserved words', () => {
      const expected = ['api', 'auth', 'admin', 'health', 'docs', 'login', 'register'];
      expected.forEach((word) => {
        expect(RESERVED_ALIASES.has(word)).toBe(true);
      });
    });

    it('should not include normal words', () => {
      expect(RESERVED_ALIASES.has('my-link')).toBe(false);
      expect(RESERVED_ALIASES.has('github')).toBe(false);
    });
  });

  describe('Alias Regex', () => {
    it('should allow alphanumeric characters', () => {
      expect(ALIAS_REGEX.test('myLink123')).toBe(true);
    });

    it('should allow hyphens and underscores', () => {
      expect(ALIAS_REGEX.test('my-link')).toBe(true);
      expect(ALIAS_REGEX.test('my_link')).toBe(true);
    });

    it('should reject spaces', () => {
      expect(ALIAS_REGEX.test('my link')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(ALIAS_REGEX.test('my@link')).toBe(false);
      expect(ALIAS_REGEX.test('my/link')).toBe(false);
      expect(ALIAS_REGEX.test('my.link')).toBe(false);
    });
  });

  describe('URL validation', () => {
    it('should have MAX_URL_LENGTH of 2048', () => {
      expect(MAX_URL_LENGTH).toBe(2048);
    });
  });
});
