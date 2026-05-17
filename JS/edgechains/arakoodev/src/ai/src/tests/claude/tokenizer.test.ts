import { describe, test, expect } from 'vitest';
import { ClaudeTokenizer } from '../../lib/claude/tokenizer';

describe('ClaudeTokenizer', () => {
  test('should tokenize simple text', () => {
    const text = 'Hello world!';
    const tokens = ClaudeTokenizer.tokenize(text);
    expect(tokens).toContain('Hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('!');
  });

  test('should count tokens correctly', () => {
    const text = 'Hello world!';
    expect(ClaudeTokenizer.countTokens(text)).toBe(3);
  });

  test('should handle empty text', () => {
    expect(ClaudeTokenizer.tokenize('')).toEqual([]);
    expect(ClaudeTokenizer.countTokens('')).toBe(0);
  });

  test('should handle complex punctuation', () => {
    const text = 'Hello, world! (Test).';
    const tokens = ClaudeTokenizer.tokenize(text);
    expect(tokens).toContain(',');
    expect(tokens).toContain('(');
    expect(tokens).toContain(')');
    expect(tokens).toContain('.');
  });
});
