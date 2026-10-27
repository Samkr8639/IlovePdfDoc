import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function testMergeAndDownload() {
  const dir = 'd:/PDF-Tool/test-fixtures';
  const file1Path = path.join(dir, 'sample_doc_1.pdf');
  const file2Path = path.join(dir, 'sample_doc_2.pdf');
  const outPath = path.join(dir, 'test_merged_output.pdf');

  console.log('--- Step 1: Reading input PDF files ---');
  const buf1 = fs.readFileSync(file1Path);
  const buf2 = fs.readFileSync(file2Path);
  console.log(`File 1 size: ${buf1.length} bytes`);
  console.log(`File 2 size: ${buf2.length} bytes`);

  console.log('--- Step 2: Emulating BrowserPdfService Merge Logic ---');
  const mergedPdf = await PDFDocument.create();

  // Load doc1
  const doc1 = await PDFDocument.load(buf1);
  const doc1Count = doc1.getPageCount();
  console.log(`Loaded doc1: ${doc1Count} pages`);
  const copiedPages1 = await mergedPdf.copyPages(doc1, doc1.getPageIndices());
  copiedPages1.forEach(p => mergedPdf.addPage(p));

  // Load doc2
  const doc2 = await PDFDocument.load(buf2);
  const doc2Count = doc2.getPageCount();
  console.log(`Loaded doc2: ${doc2Count} pages`);
  const copiedPages2 = await mergedPdf.copyPages(doc2, doc2.getPageIndices());
  copiedPages2.forEach(p => mergedPdf.addPage(p));

  // Set standard metadata
  mergedPdf.setProducer('PaperFlow (https://paperflow.app) - 100% In-Browser Privacy');
  mergedPdf.setCreator('PaperFlow Client-Side Engine');

  const mergedBytes = await mergedPdf.save();
  fs.writeFileSync(outPath, mergedBytes);
  console.log(`Merged PDF written to: ${outPath} (${mergedBytes.length} bytes)`);

  console.log('--- Step 3: Validating Downloaded Merged PDF Structure ---');
  const verifyDoc = await PDFDocument.load(mergedBytes);
  const totalPages = verifyDoc.getPageCount();
  console.log(`Merged document total pages: ${totalPages}`);

  if (totalPages !== doc1Count + doc2Count) {
    throw new Error(`Page count mismatch! Expected ${doc1Count + doc2Count}, got ${totalPages}`);
  }

  // Check header
  const header = Buffer.from(mergedBytes.buffer, mergedBytes.byteOffset, 8).toString('ascii');
  console.log(`PDF Header: ${header.trim()}`);
  if (!header.startsWith('%PDF-')) {
    throw new Error(`Invalid PDF header: ${header}`);
  }

  console.log('--- Step 4: Page Inspection ---');
  for (let i = 0; i < totalPages; i++) {
    const page = verifyDoc.getPage(i);
    const { width, height } = page.getSize();
    console.log(`  Page ${i + 1}: ${width}x${height} pt, rotation: ${page.getRotation().angle}°`);
  }

  console.log('--- SUCCESS: Merged PDF is 100% structurally valid and ready for download ---');
}

testMergeAndDownload().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
