import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const I18N_DIR = path.resolve(__dirname, '../apps/web/public/i18n');

const EXPECTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ru', 'ko', 'zh-CN', 'zh-TW',
  'ar', 'bg', 'ca', 'nl', 'el', 'hi', 'id', 'ms', 'pl', 'sv', 'th', 'tr',
  'uk', 'vi', 'sw'
];

const enPath = path.join(I18N_DIR, 'en.json');
if (!fs.existsSync(enPath)) {
  console.error(`ERROR: Canonical en.json does not exist at ${enPath}`);
  process.exit(1);
}

const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

function getLeafKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...getLeafKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const canonicalKeys = getLeafKeys(enData);
console.log(`Checking i18n consistency across ${EXPECTED_LANGUAGES.length} languages (${canonicalKeys.length} canonical keys)...`);

let hasError = false;

for (const lang of EXPECTED_LANGUAGES) {
  const langPath = path.join(I18N_DIR, `${lang}.json`);
  if (!fs.existsSync(langPath)) {
    console.error(`[-] Missing language file: ${lang}.json`);
    hasError = true;
    continue;
  }

  let langData;
  try {
    langData = JSON.parse(fs.readFileSync(langPath, 'utf-8'));
  } catch (err) {
    console.error(`[-] Invalid JSON syntax in ${lang}.json: ${err.message}`);
    hasError = true;
    continue;
  }

  const langKeys = new Set(getLeafKeys(langData));
  const missing = canonicalKeys.filter(k => !langKeys.has(k));

  if (missing.length > 0) {
    console.error(`[-] ${lang}.json is missing ${missing.length} keys:`);
    missing.slice(0, 10).forEach(k => console.error(`    - ${k}`));
    if (missing.length > 10) console.error(`    ... and ${missing.length - 10} more`);
    hasError = true;
  } else {
    console.log(`[+] ${lang}.json: 100% complete (${canonicalKeys.length}/${canonicalKeys.length} keys)`);
  }
}

if (hasError) {
  console.error('\ni18n verification FAILED.');
  process.exit(1);
} else {
  console.log('\nAll 26 languages verified successfully. Localization consistency: 100%.');
  process.exit(0);
}
