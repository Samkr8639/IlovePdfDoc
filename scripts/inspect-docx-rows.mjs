import fs from 'fs';
import JSZip from 'jszip';

const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
const xml = await zip.file('word/document.xml').async('string');
const count = (re) => (xml.match(re) || []).length;
const tally = {};
for (const m of xml.matchAll(/<w:trHeight\b([^>]*)\/?>/g)) {
  const val = /w:val="(\d+)"/.exec(m[1])?.[1] ?? '?';
  const rule = /w:hRule="(\w+)"/.exec(m[1])?.[1] ?? '(none)';
  const k = `${rule} / ${val} twips (${(val / 20).toFixed(1)} pt)`;
  tally[k] = (tally[k] || 0) + 1;
}
console.log('tables:', count(/<w:tbl>/g), '| rows:', count(/<w:tr[ >]/g));
console.log('row heights (rule / value -> rows):', tally);
console.log('EXACT-height rows (cause of broken borders/shading):', count(/w:hRule="exact"/g));
console.log('fixed table layout:', count(/<w:tblLayout w:type="fixed"/g), '| floating tables (tblpPr):', count(/<w:tblpPr/g));
console.log('table styles:', [...new Set([...xml.matchAll(/<w:tblStyle w:val="([^"]+)"/g)].map((m) => m[1]))]);

// Also check framePr hRule="exact"
const frameTally = {};
for (const m of xml.matchAll(/<w:framePr\b([^>]*)\/?>/g)) {
  const val = /w:h="(\d+)"/.exec(m[1])?.[1] ?? '?';
  const rule = /w:hRule="(\w+)"/.exec(m[1])?.[1] ?? '(none)';
  const k = `${rule} / ${val} twips (${(val / 20).toFixed(1)} pt)`;
  frameTally[k] = (frameTally[k] || 0) + 1;
}
console.log('framePr heights:', frameTally);
console.log('total w:hRule="exact" across all elements:', count(/w:hRule="exact"/g));

