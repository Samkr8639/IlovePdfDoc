import { describe, it, expect, beforeEach } from 'vitest';
import { WatermarkComplianceService } from './watermark-compliance.service';

describe('WatermarkComplianceService', () => {
  let service: WatermarkComplianceService;

  beforeEach(() => {
    service = new WatermarkComplianceService();
  });

  it('detects standard PDF without compliance warnings', () => {
    const raw = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
    const bytes = new TextEncoder().encode(raw);
    const report = service.checkCompliance(bytes);

    expect(report.isPdfA).toBe(false);
    expect(report.isPdfA1).toBe(false);
    expect(report.warningMessage).toBeNull();
  });

  it('detects PDF/A-1 conformance and generates advisory warning (R-041)', () => {
    const xmp = `
      %PDF-1.4
      <x:xmpmeta xmlns:x="adobe:ns:meta/">
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
          <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
            <pdfaid:part>1</pdfaid:part>
            <pdfaid:conformance>B</pdfaid:conformance>
          </rdf:Description>
        </rdf:RDF>
      </x:xmpmeta>
      %%EOF
    `;
    const bytes = new TextEncoder().encode(xmp);
    const report = service.checkCompliance(bytes);

    expect(report.isPdfA).toBe(true);
    expect(report.isPdfA1).toBe(true);
    expect(report.conformanceLevel).toBe('PDF/A-1');
    expect(report.warningMessage).toContain('conforms to PDF/A-1');
    expect(report.warningMessage).toContain('transparent watermark');
  });

  it('detects GTS_PDFA1 marker directly', () => {
    const raw = '%PDF-1.4\n/OutputIntents [ << /S /GTS_PDFA1 /OutputCondition (sRGB) >> ]\n%%EOF';
    const bytes = new TextEncoder().encode(raw);
    const report = service.checkCompliance(bytes);

    expect(report.isPdfA1).toBe(true);
    expect(report.warningMessage).toContain('PDF/A-1');
  });

  it('detects PDF/X print profiles and warns appropriately', () => {
    const raw = '%PDF-1.3\n/OutputIntents [ << /S /GTS_PDFX /OutputCondition (SWOP) >> ]\n%%EOF';
    const bytes = new TextEncoder().encode(raw);
    const report = service.checkCompliance(bytes);

    expect(report.isPdfX).toBe(true);
    expect(report.warningMessage).toContain('PDF/X print specifications');
  });

  it('detects digital signatures, encryption, XFA, and CMYK (R-044, R-045, R-046, R-047)', () => {
    const raw = `
      %PDF-1.6
      1 0 obj << /Type /Sig /ByteRange [0 100 200 300] >> endobj
      2 0 obj << /Encrypt 3 0 R >> endobj
      3 0 obj << /XFA [ (template) 4 0 R ] >> endobj
      4 0 obj << /ColorSpace /DeviceCMYK >> endobj
      trailer << /Root 1 0 R >> %%EOF
    `;
    const bytes = new TextEncoder().encode(raw);
    const report = service.checkCompliance(bytes);

    expect(report.hasSignatures).toBe(true);
    expect(report.isEncrypted).toBe(true);
    expect(report.hasXfa).toBe(true);
    expect(report.hasCmyk).toBe(true);
  });
});
