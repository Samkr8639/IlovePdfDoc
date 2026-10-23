const fs = require('fs');
const JSZip = require('jszip');

async function inspectDocx(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const docXml = await zip.file('word/document.xml').async('text');

  console.log('\n======================================================');
  console.log('Inspecting DOCX:', filePath);
  console.log('File size:', data.length, 'bytes');
  console.log('Document XML length:', docXml.length);

  const tables = (docXml.match(/<w:tbl[\s>]/g) || []).length;
  console.log('Table count (<w:tbl>):', tables);

  const rows = (docXml.match(/<w:tr[\s>]/g) || []).length;
  console.log('Total table rows (<w:tr>):', rows);

  const cells = (docXml.match(/<w:tc[\s>]/g) || []).length;
  console.log('Total table cells (<w:tc>):', cells);

  const paragraphs = (docXml.match(/<w:p[\s>]/g) || []).length;
  console.log('Paragraph count (<w:p>):', paragraphs);

  const pageBreaks = (docXml.match(/<w:br[^>]*w:type="page"/g) || []).length;
  console.log('Explicit PageBreak count:', pageBreaks);

  const headers = zip.file(/word\/header\d+\.xml/).length;
  console.log('Word Header parts:', headers);

  const footers = zip.file(/word\/footer\d+\.xml/).length;
  console.log('Word Footer parts:', footers);

  // Check table samples
  const tblRegex = /<w:tbl[\s>](.*?)<\/w:tbl>/gs;
  let tblMatch;
  let tIdx = 0;
  while ((tblMatch = tblRegex.exec(docXml)) !== null) {
    tIdx++;
    const tblXml = tblMatch[1];
    const trMatches = tblXml.match(/<w:tr[\s>](.*?)<\/w:tr>/gs) || [];
    console.log(`\n  Table ${tIdx}: ${trMatches.length} rows`);
    trMatches.slice(0, 3).forEach((trXml, rIdx) => {
      const tcMatches = trXml.match(/<w:tc[\s>](.*?)<\/w:tc>/gs) || [];
      const cellTexts = tcMatches.map(tc => {
        const textParts = tc.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
        return textParts.map(t => t.replace(/<\/?w:t[^>]*>/g, '')).join('');
      });
      console.log(`    Row ${rIdx + 1}: ` + cellTexts.map(c => `"${c}"`).join(' | '));
    });
  }
}

async function run() {
  const target = process.argv[2] || 'test-fixtures/improved_output.docx';
  await inspectDocx(target);
}

run().catch(console.error);
