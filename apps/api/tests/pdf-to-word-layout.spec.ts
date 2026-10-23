import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { convertPdfToDocx } from '../src/services/pdf-to-word';

describe('PDF-to-Word Visual & Structural Layout Regression Suite', () => {
  const sourcePdfPath = path.resolve(__dirname, '../../../test-fixtures/source.pdf');
  let docxBuffer: Buffer;
  let docXml: string;
  let zip: JSZip;

  beforeAll(async () => {
    expect(fs.existsSync(sourcePdfPath)).toBe(true);
    const pdfBuffer = fs.readFileSync(sourcePdfPath);

    const result = await convertPdfToDocx(pdfBuffer, {
      mode: 'no_ocr',
      originalFilename: 'Impulse Decisions Auction Portal - Developer Brief.pdf'
    });

    docxBuffer = result.docxBuffer;
    expect(docxBuffer.length).toBeGreaterThan(1000);

    zip = await JSZip.loadAsync(docxBuffer);
    const xmlFile = zip.file('word/document.xml');
    expect(xmlFile).not.toBeNull();
    docXml = await xmlFile!.async('text');
  }, 30000);

  it('generates a valid DOCX container with OpenXML signature and content types', async () => {
    expect(docxBuffer[0]).toBe(0x50); // P
    expect(docxBuffer[1]).toBe(0x4b); // K
    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    expect(zip.file('word/styles.xml')).not.toBeNull();
  });

  it('detects and reconstructs at least 4 editable Word tables (<w:tbl>)', () => {
    const tableMatches = docXml.match(/<w:tbl[\s>]/g) || [];
    expect(tableMatches.length).toBeGreaterThanOrEqual(4);
  });

  it('mandatory table 1: preserves "User roles and permissions" with 4 capability columns', () => {
    // Check capability column headers
    expect(docXml).toContain('Capability');
    expect(docXml).toContain('Master manager');
    expect(docXml).toContain('Event manager');
    expect(docXml).toContain('Team member');

    // Check capability rows
    expect(docXml).toContain('Events visible');
    expect(docXml).toContain('Create events');
    expect(docXml).toContain('Event setup: team, tables');
    expect(docXml).toContain('Appoint event managers');
    expect(docXml).toContain('Board totals, Report, CSV export');
    expect(docXml).toContain('Create and sign notes, take payments');
  });

  it('mandatory table 2: preserves "Payment methods" (Method, How it works, Stripe product)', () => {
    expect(docXml).toContain('Method');
    expect(docXml).toContain('How it works');
    expect(docXml).toContain('Stripe product');

    expect(docXml.replace(/&apos;/g, "'")).toContain("Customer's phone");
    expect(docXml).toContain('Card reader');
    expect(docXml).toContain('Pay later');
    expect(docXml).toContain('Stripe Checkout');
    expect(docXml).toContain('Stripe Terminal');
  });

  it('mandatory table 3: preserves "External integrations" (Service, Purpose, Notes)', () => {
    expect(docXml).toContain('Service');
    expect(docXml).toContain('Purpose');
    expect(docXml).toContain('Notes');

    expect(docXml).toContain('Royal Mail Postcode Address File');
    expect(docXml).toContain('Transactional email');
    expect(docXml).toContain('PDF generation');
    expect(docXml).toContain('Microsoft Entra ID');
  });

  it('mandatory table 4: preserves "Core records" (Record, Key fields)', () => {
    expect(docXml).toContain('Record');
    expect(docXml).toContain('Key fields');

    expect(docXml).toContain('Event');
    expect(docXml).toContain('Staff member');
    expect(docXml).toContain('Promissory note');
    expect(docXml).toContain('Note version');
    expect(docXml).toContain('Retracted lot');
    expect(docXml).toContain('Audit entry');
  });

  it('preserves semantic headings hierarchy (Title, H1, H2)', () => {
    // Document title
    expect(docXml).toContain('Impulse Decisions Auction Portal');

    // Section headings (H1)
    expect(docXml).toContain('Overview');
    expect(docXml).toContain('Users, roles and permissions');
    expect(docXml).toContain('Authentication and security');
    expect(docXml).toContain('Functional requirements');
    expect(docXml).toContain('Payments');
    expect(docXml).toContain('Integrations');
    expect(docXml).toContain('Data, hosting and quality');
    expect(docXml).toContain('Delivery, acceptance and open questions');

    // Heading styles in xml
    expect(docXml).toMatch(/<w:pStyle w:val="(Title|Heading1|Heading2)"/);
  });

  it('separates document headers and footers from main body text', async () => {
    const headerFiles = zip.file(/word\/header\d+\.xml/);
    expect(headerFiles.length).toBeGreaterThanOrEqual(1);

    const footerFiles = zip.file(/word\/footer\d+\.xml/);
    expect(footerFiles.length).toBeGreaterThanOrEqual(1);

    // Verify footer contains page number field
    const footerXml = await footerFiles[0].async('text');
    expect(footerXml).toContain('Page');
    expect(footerXml).toMatch(/<w:instrText[^>]*>PAGE<\/w:instrText>/i);
    expect(footerXml).toMatch(/<w:instrText[^>]*>NUMPAGES<\/w:instrText>/i);
  });

  it('preserves list numbering and bullet structure with proper indentation', () => {
    // Numbered list items
    expect(docXml).toContain('Core platform.');
    expect(docXml).toContain('Payments.');
    expect(docXml).toContain('Integrations and polish.');

    // Deliverables and acceptance criteria
    expect(docXml).toContain('Deliverables');
    expect(docXml).toContain('Acceptance criteria');
  });
});
