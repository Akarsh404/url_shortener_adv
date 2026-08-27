import { generateShortCode, BASE62_CHARS, MAX_RETRIES, DEFAULT_CODE_LENGTH } from '../../../src/modules/urls/shortCode.service';

describe('ShortCode Service', () => {
  describe('generateShortCode', () => {
    it('should generate a code of default length', () => {
      const code = generateShortCode();
      expect(code).toHaveLength(DEFAULT_CODE_LENGTH);
    });

    it('should generate a code of specified length', () => {
      const code = generateShortCode(8);
      expect(code).toHaveLength(8);
    });

    it('should only contain Base62 characters', () => {
      const base62Set = new Set(BASE62_CHARS.split(''));

      // Generate many codes and verify all characters are valid
      for (let i = 0; i < 100; i++) {
        const code = generateShortCode();
        for (const char of code) {
          expect(base62Set.has(char)).toBe(true);
        }
      }
    });

    it('should generate unique codes across multiple calls', () => {
      const codes = new Set<string>();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        codes.add(generateShortCode());
      }

      // With 62^7 possible combinations, 1000 codes should all be unique
      expect(codes.size).toBe(iterations);
    });

    it('should generate different codes each time (not deterministic)', () => {
      const code1 = generateShortCode();
      const code2 = generateShortCode();
      // While there's a tiny chance of collision, it should be astronomically unlikely
      expect(code1).not.toBe(code2);
    });

    it('should expose MAX_RETRIES constant', () => {
      expect(MAX_RETRIES).toBe(5);
    });

    it('should expose DEFAULT_CODE_LENGTH constant', () => {
      expect(DEFAULT_CODE_LENGTH).toBe(7);
    });

    it('should handle length of 1', () => {
      const code = generateShortCode(1);
      expect(code).toHaveLength(1);
      expect(BASE62_CHARS).toContain(code);
    });
  });
});
