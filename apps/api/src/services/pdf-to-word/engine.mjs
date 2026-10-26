import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzePdf } from './analyze.mjs';
import { buildDocx } from './build.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAutoEmbedFonts() {
  const fontsDir = path.resolve(__dirname, '../fonts');
  const embedFonts = [];
  if (fs.existsSync(fontsDir)) {
    try {
      const files = fs.readdirSync(fontsDir);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.ttf')) {
          const fontPath = path.join(fontsDir, file);
          const fontName = path.basename(file, path.extname(file));
          embedFonts.push({
            name: fontName,
            data: fs.readFileSync(fontPath)
          });
        }
      }
    } catch {
      // Ignore font read errors
    }
  }
  return embedFonts;
}

/**
 * Converts a PDF buffer into a layout-preserving DOCX buffer.
 *
 * @param {Buffer|Uint8Array} buffer - PDF binary data
 * @param {Object} [opts] - Conversion options
 * @param {Object} [opts.fontMap] - Mapping of PDF font families to Word fonts
 * @param {string} [opts.fallbackFont] - Default fallback font name
 * @param {number} [opts.baselineRatio] - Tunable vertical baseline offset ratio
 * @param {Array<{name: string, data: Buffer}>} [opts.embedFonts] - Fonts to embed
 * @returns {Promise<{ docx: Buffer, model: Object }>}
 */
export async function convertPdfToDocx(buffer, opts = {}) {
  // 1. Analyze PDF layout
  const model = await analyzePdf(buffer, opts);

  // 2. Prepare embedded fonts (auto-load from ../fonts plus user-provided)
  const autoFonts = getAutoEmbedFonts();
  const userFonts = opts.embedFonts || [];
  const combinedFonts = [...autoFonts, ...userFonts];

  const buildOpts = {
    ...opts,
    embedFonts: combinedFonts
  };

  // 3. Build DOCX
  const docx = await buildDocx(model, buildOpts);

  return { docx, model };
}

export { analyzePdf, buildDocx };
