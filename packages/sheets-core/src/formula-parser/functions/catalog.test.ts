import { functionCatalog, getAllFunctionDocs, getFunctionDoc, searchFunctions } from './catalog';
import { getRegisteredFunctionNames } from './index';

describe('function catalog', () => {
  it('has an entry for every registered function', () => {
    const registered = getRegisteredFunctionNames();
    const missing = [...registered].filter((name) => !functionCatalog[name]).sort();
    expect(missing).toEqual([]);
  });

  it('has no entry for a function that is not registered', () => {
    const registered = getRegisteredFunctionNames();
    const extra = Object.keys(functionCatalog)
      .filter((name) => !registered.has(name))
      .sort();
    expect(extra).toEqual([]);
  });

  it('every entry is well-formed', () => {
    for (const doc of getAllFunctionDocs()) {
      expect(doc.description.length).toBeGreaterThan(0);
      expect(doc.name).toBe(doc.name.toUpperCase());
      // At most one variadic argument, and it must be the last one.
      const variadic = doc.args.filter((a) => a.variadic);
      expect(variadic.length).toBeLessThanOrEqual(1);
      if (variadic.length === 1) {
        expect(doc.args[doc.args.length - 1].variadic).toBe(true);
      }
    }
  });

  it('getFunctionDoc looks up case-insensitively', () => {
    expect(getFunctionDoc('sum')?.name).toBe('SUM');
    expect(getFunctionDoc('SUM')?.name).toBe('SUM');
    expect(getFunctionDoc('NOPE')).toBeUndefined();
  });

  it('searchFunctions matches by case-insensitive prefix', () => {
    const names = searchFunctions('su').map((d) => d.name);
    expect(names).toContain('SUM');
    expect(names).toContain('SUMIF');
    expect(names.every((n) => n.startsWith('SU'))).toBe(true);
    expect(searchFunctions('zzzz')).toEqual([]);
  });
});
