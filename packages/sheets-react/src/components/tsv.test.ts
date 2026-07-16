import { encodeTsv, parseTsv } from './tsv';

describe('TSV encode/parse for copy & paste', () => {
  it('round-trips plain rows', () => {
    const rows = [
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ];
    expect(parseTsv(encodeTsv(rows))).toEqual(rows);
  });

  it('quotes and round-trips a field with a newline (no phantom row)', () => {
    const rows = [['line1\nline2', 'z']];
    const tsv = encodeTsv(rows);
    expect(tsv).toBe('"line1\nline2"\tz');
    expect(parseTsv(tsv)).toEqual(rows);
  });

  it('quotes and round-trips a field with a tab', () => {
    const rows = [['a\tb', 'c']];
    expect(parseTsv(encodeTsv(rows))).toEqual(rows);
  });

  it('escapes and round-trips embedded quotes', () => {
    const rows = [['he said "hi"', 'ok']];
    expect(parseTsv(encodeTsv(rows))).toEqual(rows);
  });

  it('parses external CRLF TSV without a trailing \\r', () => {
    expect(parseTsv('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});
