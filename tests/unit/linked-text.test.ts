import { describe, expect, it } from 'vitest';
import { linkParts } from '../../src/client/components/link-parts';

describe('linkParts', () => {
  it('links http, https and www addresses while preserving surrounding text and punctuation', () => {
    expect(linkParts('See (https://example.com/path?q=1), then www.example.org!')).toEqual([
      { text: 'See (' },
      { text: 'https://example.com/path?q=1', href: 'https://example.com/path?q=1' },
      { text: '), then ' },
      { text: 'www.example.org', href: 'https://www.example.org' },
      { text: '!' },
    ]);
  });

  it('retains balanced parentheses and ignores embedded or unsafe schemes', () => {
    expect(linkParts('https://example.com/a_(b) ftp://example.com foohttps://example.com')).toEqual([
      { text: 'https://example.com/a_(b)', href: 'https://example.com/a_(b)' },
      { text: ' ftp://example.com foohttps://example.com' },
    ]);
  });
});
