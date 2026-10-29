import {
  cleanString,
  mustStayText,
  parseNumber,
  parseDate,
  inferColumnSeparator,
  inferColumnDateConvention,
  typeColumnCells
} from '../src/services/pdf-to-excel/typing';

describe('Cell Typing & Value Parser (typing.ts)', () => {
  describe('cleanString', () => {
    it('normalizes NBSP, zero-width spaces, and trims', () => {
      const input = '\u00A0  Hello\u202FWorld\u200B  \u00A0';
      const { text } = cleanString(input);
      expect(text).toBe('Hello World');
    });

    it('fixes line-wrap hyphenation across newlines', () => {
      const input = 'This is an inter-\r\nface definition.';
      const { text } = cleanString(input);
      expect(text).toBe('This is an interface definition.');
    });

    it('preserves unicode, RTL, and emoji', () => {
      const input = 'مرحبا بالعالم 🚀 English 123';
      const { text } = cleanString(input);
      expect(text).toBe('مرحبا بالعالم 🚀 English 123');
    });

    it('truncates strings longer than 32,767 characters and warns', () => {
      const longStr = 'A'.repeat(33000);
      const { text, warning } = cleanString(longStr);
      expect(text.length).toBe(32767);
      expect(warning).toBeDefined();
    });
  });

  describe('mustStayText', () => {
    it('keeps values with leading zeros as text', () => {
      expect(mustStayText('0123')).toBe(true);
      expect(mustStayText('007')).toBe(true);
      expect(mustStayText('00')).toBe(true);
      // Zero itself is fine
      expect(mustStayText('0')).toBe(false);
      expect(mustStayText('0.00')).toBe(false);
    });

    it('keeps numbers longer than 15 digits as text to avoid precision loss', () => {
      expect(mustStayText('1234567890123456')).toBe(true);
      expect(mustStayText('123456789012345')).toBe(false);
    });

    it('keeps scientific codes like 1E5 as text', () => {
      expect(mustStayText('1E5')).toBe(true);
      expect(mustStayText('2e10')).toBe(true);
    });

    it('keeps IDs, PAN, GSTIN, and IFSC codes as text', () => {
      expect(mustStayText('22AAAAA0000A1Z5')).toBe(true);
      expect(mustStayText('ABCDE1234F')).toBe(true);
      expect(mustStayText('HDFC0001234')).toBe(true);
      expect(mustStayText('+91 98765 43210')).toBe(true);
    });
  });

  describe('parseNumber', () => {
    it('parses standard numbers with commas', () => {
      const res = parseNumber('1,234,567.89', 'standard');
      expect(res).not.toBeNull();
      expect(res?.num).toBe(1234567.89);
    });

    it('parses Indian number grouping (1,23,456.78)', () => {
      const res = parseNumber('1,23,456.78', 'indian');
      expect(res).not.toBeNull();
      expect(res?.num).toBe(123456.78);
    });

    it('parses European decimal comma (1.234,56)', () => {
      const res = parseNumber('1.234,56', 'decimal_comma');
      expect(res).not.toBeNull();
      expect(res?.num).toBe(1234.56);
    });

    it('parses currencies into numeric values with proper format', () => {
      const inr = parseNumber('₹ 50,000.00', 'indian');
      expect(inr?.num).toBe(50000);
      expect(inr?.numFmt).toContain('₹');

      const usd = parseNumber('$1,500.50', 'standard');
      expect(usd?.num).toBe(1500.5);
      expect(usd?.numFmt).toContain('$');

      const eur = parseNumber('99,95 €', 'decimal_comma');
      expect(eur?.num).toBe(99.95);
      expect(eur?.numFmt).toContain('€');
    });

    it('parses percentages into decimal with percent format', () => {
      const res = parseNumber('12.50%', 'standard');
      expect(res?.num).toBe(0.125);
      expect(res?.numFmt).toBe('0.00%');
    });

    it('parses various negative number notations', () => {
      const paren = parseNumber('(1,234.50)', 'standard');
      expect(paren?.num).toBe(-1234.5);

      const trailing = parseNumber('1,234.50-', 'standard');
      expect(trailing?.num).toBe(-1234.5);

      const leadingMinus = parseNumber('−1,234.50', 'standard');
      expect(leadingMinus?.num).toBe(-1234.5);
    });
  });

  describe('parseDate and Date Convention Inference', () => {
    it('infers dd/mm when day > 12 is present in the column', () => {
      const col = ['15/01/2024', '04/05/2024', '22/08/2024'];
      const conv = inferColumnDateConvention(col);
      expect(conv).toBe('dd/mm');

      const parsed = parseDate('04/05/2024', conv);
      expect(parsed).not.toBeNull();
      // May 4th (day 4, month 5)
      expect(parsed?.date.getUTCDate()).toBe(4);
      expect(parsed?.date.getUTCMonth()).toBe(4); // 0-indexed month
    });

    it('infers mm/dd when month > 12 is NOT present but second part > 12', () => {
      const col = ['01/15/2024', '05/22/2024'];
      const conv = inferColumnDateConvention(col);
      expect(conv).toBe('mm/dd');

      const parsed = parseDate('01/15/2024', conv);
      expect(parsed?.date.getUTCDate()).toBe(15);
      expect(parsed?.date.getUTCMonth()).toBe(0); // January
    });

    it('parses ISO format yyyy-mm-dd', () => {
      const parsed = parseDate('2024-11-28', 'yyyy-mm-dd');
      expect(parsed?.date.getUTCFullYear()).toBe(2024);
      expect(parsed?.date.getUTCMonth()).toBe(10); // November
      expect(parsed?.date.getUTCDate()).toBe(28);
    });

    it('parses named month format dd MMM yyyy', () => {
      const parsed = parseDate('15 Mar 2024');
      expect(parsed?.date.getUTCMonth()).toBe(2); // March
      expect(parsed?.date.getUTCDate()).toBe(15);
    });
  });

  describe('typeColumnCells', () => {
    it('keeps a mixed column as text if < 60% of entries are numeric', () => {
      // 2 numbers out of 5 non-empty entries = 40% < 60%
      const col = ['100', 'Apple', 'Banana', 'Orange', '200'];
      const typed = typeColumnCells(col, true);
      expect(typed.every(c => c.type === 'string')).toBe(true);
      expect(typed[0].value).toBe('100');
    });

    it('types a predominantly numeric column as numbers', () => {
      // 4 numbers out of 5 entries = 80% >= 60%
      const col = ['100.50', '200.75', 'N/A', '450.00', '1,200.00'];
      const typed = typeColumnCells(col, true);
      expect(typed[0].type).toBe('number');
      expect(typed[0].value).toBe(100.5);
      expect(typed[1].type).toBe('number');
      expect(typed[2].type).toBe('string');
      expect(typed[3].type).toBe('number');
      expect(typed[4].type).toBe('number');
      expect(typed[4].value).toBe(1200);
    });
  });
});
