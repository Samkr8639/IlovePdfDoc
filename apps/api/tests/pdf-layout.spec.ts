import { PDFDocument, rgb } from 'pdf-lib';
import { analyzePdf } from '../src/services/pdf-layout';

describe('Shared PDF Layout Scanner (analyzePdf)', () => {
  let model: any;
  let multiModel: any;

  beforeAll(async () => {
    // Generate synthetic PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle('Invoice Document Test');
    const page = pdfDoc.addPage([600, 800]);

    // Draw some text
    page.drawText('Sample Header Title', {
      x: 50,
      y: 750,
      size: 20,
      color: rgb(0.1, 0.2, 0.8)
    });

    page.drawText('Left aligned line 1', {
      x: 50,
      y: 700,
      size: 12,
      color: rgb(0, 0, 0)
    });

    // Draw a rectangle box
    page.drawRectangle({
      x: 50,
      y: 500,
      width: 500,
      height: 150,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: 1.5
    });

    // Draw a horizontal line
    page.drawLine({
      start: { x: 50, y: 450 },
      end: { x: 550, y: 450 },
      thickness: 1,
      color: rgb(0.5, 0.5, 0.5)
    });

    const pdfBytes = await pdfDoc.save();
    model = await analyzePdf(Buffer.from(pdfBytes));

    const multiDoc = await PDFDocument.create();
    multiDoc.addPage([595.28, 841.89]); // A4
    multiDoc.addPage([612, 792]);       // Letter
    const multiBytes = await multiDoc.save();
    multiModel = await analyzePdf(Buffer.from(multiBytes));
  }, 30000);

  it('should scan PDF pages and extract text blocks, dimensions, and styling', () => {
    expect(model).toBeDefined();
    expect(model.pages.length).toBe(1);
    expect(model.pages[0].width).toBe(600);
    expect(model.pages[0].height).toBe(800);
    expect(model.title).toBe('Invoice Document Test');

    // Blocks
    expect(model.pages[0].blocks.length).toBeGreaterThanOrEqual(1);
    const headerBlock = model.pages[0].blocks.find((b: any) =>
      b.lines.some((l: any[]) => l.some((r: any) => r.text.includes('Sample Header Title')))
    );
    expect(headerBlock).toBeDefined();
    expect(headerBlock?.align).toBe('left');

    // Boxes
    expect(model.pages[0].boxes.length).toBeGreaterThanOrEqual(1);
    const box = model.pages[0].boxes[0];
    expect(box.w).toBeCloseTo(500, -1);
    expect(box.h).toBeCloseTo(150, -1);
  });

  it('should handle multi-page PDFs with varying page dimensions', () => {
    expect(multiModel).toBeDefined();
    expect(multiModel.pages.length).toBe(2);
    expect(multiModel.pages[0].width).toBeCloseTo(595.28, 1);
    expect(multiModel.pages[0].height).toBeCloseTo(841.89, 1);
    expect(multiModel.pages[1].width).toBeCloseTo(612, 1);
    expect(multiModel.pages[1].height).toBeCloseTo(792, 1);
  });
});
