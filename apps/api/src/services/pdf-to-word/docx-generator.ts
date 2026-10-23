import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  Header,
  Footer,
  PageNumber
} from 'docx';
import { ReconstructedDocument, SemanticElement } from './document-layout-reconstructor';
import { AppError } from '../../middleware/errorHandler';

const PAGE_WIDTH_DXA = 9360; // Printable width in dxa (approx 6.5 inches)

/**
 * Generates a production-grade, genuine DOCX document from reconstructed semantic document models.
 */
export async function generateDocxDocument(docModel: ReconstructedDocument): Promise<Buffer> {
  const docChildren: (Paragraph | Table)[] = [];

  for (let idx = 0; idx < docModel.elements.length; idx++) {
    const el = docModel.elements[idx];

    switch (el.type) {
      case 'title':
        docChildren.push(
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { before: 200, after: 120 },
            keepNext: true,
            children: [
              new TextRun({
                text: el.text || '',
                bold: true,
                size: 44, // 22pt
                color: '0F172A',
                font: 'Calibri'
              })
            ]
          })
        );
        break;

      case 'heading1':
        docChildren.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            keepNext: true,
            children: [
              new TextRun({
                text: el.text || '',
                bold: true,
                size: 32, // 16pt
                color: '0F172A',
                font: 'Calibri'
              })
            ]
          })
        );
        break;

      case 'heading2':
        docChildren.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 80 },
            keepNext: true,
            children: [
              new TextRun({
                text: el.text || '',
                bold: true,
                size: 26, // 13pt
                color: '1E293B',
                font: 'Calibri'
              })
            ]
          })
        );
        break;

      case 'bullet':
        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80, line: 260 },
            children: [
              new TextRun({
                text: el.text || '',
                size: 22, // 11pt
                color: '1F2937',
                font: 'Calibri'
              })
            ]
          })
        );
        break;

      case 'numbered':
        docChildren.push(
          new Paragraph({
            indent: { left: 540, hanging: 360 },
            spacing: { after: 100, line: 260 },
            children: [
              new TextRun({
                text: (el.num || '1.') + ' ',
                bold: true,
                size: 22,
                color: '0F172A',
                font: 'Calibri'
              }),
              new TextRun({
                text: el.text || '',
                size: 22,
                color: '1F2937',
                font: 'Calibri'
              })
            ]
          })
        );
        break;

      case 'leadin_paragraph':
        docChildren.push(
          new Paragraph({
            spacing: { after: 120, line: 270 },
            children: [
              new TextRun({
                text: (el.leadIn || '') + ' ',
                bold: true,
                size: 22,
                color: '0F172A',
                font: 'Calibri'
              }),
              new TextRun({
                text: el.text || '',
                size: 22,
                color: '1F2937',
                font: 'Calibri'
              })
            ]
          })
        );
        break;

      case 'paragraph':
        docChildren.push(
          new Paragraph({
            spacing: { after: 120, line: 270 },
            children: [
              new TextRun({
                text: el.text || '',
                size: 22,
                color: '1F2937',
                font: 'Calibri'
              })
            ]
          })
        );
        break;

      case 'table':
        if (!el.rows || el.rows.length === 0) break;

        const numCols = el.colStarts?.length || el.rows[0].cells.length;
        const colWidthsDxa: number[] = [];

        if (numCols === 4) {
          colWidthsDxa.push(2650, 1600, 2400, 2710);
        } else if (numCols === 3) {
          colWidthsDxa.push(2800, 3200, 3360);
        } else if (numCols === 2) {
          colWidthsDxa.push(2600, 6760);
        } else {
          const perCol = Math.floor(PAGE_WIDTH_DXA / numCols);
          for (let c = 0; c < numCols; c++) colWidthsDxa.push(perCol);
        }

        const borderConfig = {
          style: BorderStyle.SINGLE,
          size: 4,
          color: 'CBD5E1'
        };

        const tableRows: TableRow[] = [];

        for (let rIdx = 0; rIdx < el.rows.length; rIdx++) {
          const rowData = el.rows[rIdx];
          const isHeaderRow = (rIdx === 0);

          const cells: TableCell[] = [];
          for (let cIdx = 0; cIdx < numCols; cIdx++) {
            const cellText = (rowData.cells[cIdx] || '').trim();
            cells.push(
              new TableCell({
                width: {
                  size: colWidthsDxa[cIdx] || Math.floor(PAGE_WIDTH_DXA / numCols),
                  type: WidthType.DXA
                },
                margins: {
                  top: 100,
                  bottom: 100,
                  left: 140,
                  right: 140
                },
                shading: isHeaderRow ? {
                  fill: 'F1F5F9',
                  type: ShadingType.CLEAR
                } : undefined,
                borders: {
                  top: borderConfig,
                  bottom: borderConfig,
                  left: borderConfig,
                  right: borderConfig
                },
                children: [
                  new Paragraph({
                    spacing: { after: 40, line: 240 },
                    children: [
                      new TextRun({
                        text: cellText,
                        bold: isHeaderRow,
                        size: isHeaderRow ? 21 : 20, // 10.5pt / 10pt
                        color: isHeaderRow ? '0F172A' : '1F2937',
                        font: 'Calibri'
                      })
                    ]
                  })
                ]
              })
            );
          }

          tableRows.push(
            new TableRow({
              tableHeader: isHeaderRow,
              cantSplit: true,
              children: cells
            })
          );
        }

        docChildren.push(
          new Table({
            width: {
              size: PAGE_WIDTH_DXA,
              type: WidthType.DXA
            },
            rows: tableRows
          }),
          new Paragraph({ spacing: { after: 160 } }) // Margins after table
        );
        break;
    }
  }

  const doc = new Document({
    creator: 'PDF flow (I Love PDF & Doc)',
    title: docModel.title || 'Converted Document',
    description: 'Converted from PDF by PDF flow high-precision DOCX converter',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080,
              bottom: 1080,
              left: 1080,
              right: 1080
            }
          }
        },
        headers: docModel.runningHeader ? {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: docModel.runningHeader,
                    size: 16, // 8pt
                    color: '94A3B8',
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        } : undefined,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 16,
                    color: '94A3B8',
                    font: 'Calibri'
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '94A3B8',
                    font: 'Calibri'
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: '94A3B8',
                    font: 'Calibri'
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '94A3B8',
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        },
        children: docChildren
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);

  if (!buffer || buffer.length < 500) {
    throw new AppError(500, 'DOCX_GENERATION_FAILED', 'Failed to generate a valid Word document.');
  }

  // OpenXML ZIP signature validation (0x50 0x4B)
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new AppError(500, 'INVALID_DOCX_OUTPUT', 'Output document signature is corrupted.');
  }

  return buffer;
}
