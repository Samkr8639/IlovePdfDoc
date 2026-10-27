import fs from 'fs';
import path from 'path';
import { compressSinglePdf } from '../src/routes/compress.route';
import { analyzePdfSize, formatBytes } from './pdf-size-report';

const FIXTURES = [
  { name: 'Scanned 20-page PDF', file: 'sample-1-scanned-20page.pdf' },
  { name: 'Photo-heavy brochure', file: 'sample-2-photo-brochure.pdf' },
  { name: 'Text-only contract', file: 'sample-3-text-contract.pdf' },
  { name: 'PowerPoint-exported PNGs', file: 'sample-4-powerpoint-png.pdf' },
  { name: 'Full (non-subset) fonts', file: 'sample-5-full-font.pdf' },
  { name: 'Word-exported with ICC', file: 'sample-6-word-icc.pdf' }
];

const FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures');

async function main() {
  console.log('# CURRENT COMPRESSION ENGINE BENCHMARK & DIAGNOSIS\n');

  const levels: Array<'extreme' | 'recommended' | 'less'> = ['extreme', 'recommended', 'less'];
  const results: any[] = [];

  for (const item of FIXTURES) {
    const fullPath = path.join(FIXTURES_DIR, item.file);
    if (!fs.existsSync(fullPath)) {
      console.error(`Missing fixture: ${fullPath}`);
      continue;
    }

    const origBuffer = fs.readFileSync(fullPath);
    const origSize = origBuffer.length;
    const report = await analyzePdfSize(origBuffer, fullPath);

    console.log(`\n### Sample: ${item.name} (${item.file})`);
    console.log(`- Original Size: ${formatBytes(origSize)} (${origSize.toLocaleString()} bytes)`);
    console.log(`- Page Count: ${report.pageCount}`);

    // Dominant categories
    const topCats = Object.values(report.categories)
      .filter(c => c.totalBytes > 0)
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .map(c => `${c.category}: ${formatBytes(c.totalBytes)} (${c.percentOfTotal.toFixed(1)}%)`)
      .join(', ');
    console.log(`- Composition: ${topCats}`);

    for (const lvl of levels) {
      const t0 = performance.now();
      const res = await compressSinglePdf(origBuffer, item.file, lvl);
      const durationMs = Math.round(performance.now() - t0);

      const compSize = res.compressedBuffer.length;
      const savedBytes = origSize - compSize;
      const savedPct = origSize > 0 ? ((origSize - compSize) / origSize) * 100 : 0;

      results.push({
        sample: item.name,
        file: item.file,
        level: lvl,
        originalBytes: origSize,
        compressedBytes: compSize,
        savedBytes,
        savedPercent: Math.round(savedPct * 10) / 10,
        timeMs: durationMs
      });

      console.log(
        `  * Level: [${lvl.padEnd(11)}] -> ${formatBytes(compSize).padStart(10)} | Saved: ${savedPct.toFixed(1).padStart(5)}% (${formatBytes(savedBytes)}) | Time: ${durationMs}ms`
      );
    }
  }

  console.log('\n\n## SUMMARY BENCHMARK TABLE (CURRENT ENGINE)\n');
  console.log('| Sample | Level | Original Size | Output Size | % Saved | Time (ms) |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const r of results) {
    console.log(
      `| ${r.sample} | ${r.level} | ${formatBytes(r.originalBytes)} | ${formatBytes(r.compressedBytes)} | ${r.savedPercent}% | ${r.timeMs}ms |`
    );
  }
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
