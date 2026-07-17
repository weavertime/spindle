import { excelDateToJS, dateStringToExcelSerial, dateTimeStringToExcelSerial } from './utils/format-utils';

describe('date serial <-> picker string round-trips (timezone-independent)', () => {
  it('date string -> serial -> date string is stable', () => {
    for (const serial of [1, 45458, 45657, 60000]) {
      const iso = excelDateToJS(serial).toISOString().split('T')[0];
      expect(dateStringToExcelSerial(iso)).toBe(serial);
    }
  });
  it('a known date maps to the correct serial', () => {
    expect(dateStringToExcelSerial('2024-06-15')).toBe(45458);
  });
  it('datetime string -> serial -> datetime string is stable', () => {
    const iso = excelDateToJS(45458).toISOString().slice(0, 16);
    expect(dateTimeStringToExcelSerial(iso)).toBe(45458);
  });
});
