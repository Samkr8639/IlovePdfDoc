import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const I18N_DIR = path.resolve(__dirname, '../apps/web/public/i18n');
const PENDING_PATH = path.resolve(__dirname, '../apps/web/src/i18n-pending/split-pdf.en.json');
const DEFAULT_EN_PATH = path.resolve(__dirname, '../apps/web/src/app/core/i18n/default-en.ts');

const pendingSplit = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf-8'));
const enBase = JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'en.json'), 'utf-8'));

// Merge SPLIT_PDF into en
const enFull = {
  ...enBase,
  SPLIT_PDF: pendingSplit.SPLIT_PDF
};

fs.writeFileSync(path.join(I18N_DIR, 'en.json'), JSON.stringify(enFull, null, 2) + '\n', 'utf-8');

// Update default-en.ts
const defaultEnContent = `export const DEFAULT_EN_TRANSLATIONS: Record<string, any> = ${JSON.stringify(enFull, null, 2)};\n`;
fs.writeFileSync(DEFAULT_EN_PATH, defaultEnContent, 'utf-8');

// Supported language definitions
const LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ru', 'ko', 'zh-CN', 'zh-TW',
  'ar', 'bg', 'ca', 'nl', 'el', 'hi', 'id', 'ms', 'pl', 'sv', 'th', 'tr',
  'uk', 'vi', 'sw'
];

// High-quality translations for key common languages and systematic localization for all 26
const TRANSLATIONS = {
  es: {
    ...JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'es.json'), 'utf-8')),
    SPLIT_PDF: {
      TITLE: "Dividir PDF",
      SUBTITLE: "Extrae una página o un conjunto para convertirlo fácilmente en archivos independientes con total privacidad.",
      CHANGE_FILE: "Cambiar archivo",
      MODE_CUSTOM: "Rangos personalizados",
      MODE_CUSTOM_DESC: "Define rangos de páginas específicos para extraer en archivos independientes",
      MODE_FIXED: "Bloques fijos de páginas",
      MODE_FIXED_DESC: "Divide el documento en partes iguales de N páginas",
      MODE_EXTRACT_ALL: "Extraer todas las páginas",
      MODE_EXTRACT_ALL_DESC: "Convierte cada página en un archivo PDF independiente",
      RANGE_FROM: "Desde página",
      RANGE_TO: "hasta",
      ADD_RANGE: "+ Añadir otro rango",
      CHUNK_SIZE_LABEL: "Páginas por archivo dividido",
      SUMMARY_TITLE: "Resumen de división",
      SUMMARY_FILES_COUNT: "archivos PDF independientes serán creados",
      SUMMARY_SINGLE_FILE: "Se creará 1 archivo PDF",
      SUMMARY_DELIVERY_ZIP: "Empaquetado en un archivo ZIP",
      SUMMARY_DELIVERY_SINGLE: "Descargado directamente como un único PDF",
      BTN_SPLIT: "Dividir PDF",
      PAGE: "Página",
      PART: "Parte",
      EXCLUDED: "Excluida",
      ERROR_SINGLE_FILE_ONLY: "Dividir PDF acepta un archivo a la vez. Por favor sube un solo documento.",
      ERROR_INVALID_RANGES: "Por favor corrige los rangos de páginas no válidos antes de dividir.",
      SECTION_DISTRIBUTION_TITLE: "Distribución visual de páginas",
      SECTION_DISTRIBUTION_DESC: "Las etiquetas de colores indican a qué archivo dividido pertenece cada página.",
      SECTION_CONFIG_TITLE: "Configuración de división",
      MODES_LABEL: "Modos de división",
      DEFINED_RANGES: "Rangos definidos",
      RANGE_LABEL: "Rango",
      RANGES_LABEL: "Rangos",
      PAGE_LABEL: "página",
      PAGES_LABEL: "páginas",
      REMOVE_RANGE: "Eliminar rango",
      FIXED_HINT_PREFIX: "Cada",
      FIXED_HINT_SUFFIX: "se guardará en un PDF independiente.",
      EXTRACT_ALL_HINT: "Todas las páginas se extraerán como archivos PDF individuales y se empaquetarán en un archivo ZIP.",
      PROCESSING_TITLE: "Dividiendo PDF...",
      PREPARING_MSG: "Preparando documento para dividir...",
      ERR_CHUNK_SIZE_MIN: "Las páginas por bloque deben ser al menos 1.",
      ERR_CHUNK_SIZE_MAX: "Las páginas por bloque no pueden superar el total de páginas.",
      ERR_NO_RANGES: "Añada al menos un rango de páginas.",
      ERR_INVALID_NUMBER: "Los números de página deben ser números enteros.",
      ERR_START_MIN: "La página de inicio debe ser al menos 1.",
      ERR_END_MIN: "La página final debe ser al menos 1.",
      ERR_START_EXCEEDS: "La página de inicio supera el total de páginas.",
      ERR_END_EXCEEDS: "La página final supera el total de páginas.",
      ERR_START_GREATER: "La página de inicio no puede ser mayor que la página final.",
      ERR_OVERLAP: "se superpone con un rango anterior.",
      ERR_FIX_RANGES: "Corrija los errores de rango antes de dividir."
    }
  },
  hi: {
    ...JSON.parse(fs.readFileSync(path.join(I18N_DIR, 'hi.json'), 'utf-8')),
    SPLIT_PDF: {
      TITLE: "PDF विभाजित करें",
      SUBTITLE: "पूर्ण गोपनीयता के साथ एक या एकाधिक पृष्ठों को स्वतंत्र PDF फाइलों में अलग करें।",
      CHANGE_FILE: "फाइल बदलें",
      MODE_CUSTOM: "कस्टम रेंज",
      MODE_CUSTOM_DESC: "अलग फाइलों में निकालने के लिए विशिष्ट पेज रेंज चुनें",
      MODE_FIXED: "निश्चित पेज समूह",
      MODE_FIXED_DESC: "दस्तावेज़ को N पृष्ठों के समान भागों में विभाजित करें",
      MODE_EXTRACT_ALL: "सभी पेज अलग करें",
      MODE_EXTRACT_ALL_DESC: "प्रत्येक पृष्ठ को एक स्वतंत्र PDF फाइल में बदलें",
      RANGE_FROM: "पेज से",
      RANGE_TO: "तक",
      ADD_RANGE: "+ अन्य रेंज जोड़ें",
      CHUNK_SIZE_LABEL: "प्रति फाइल पेज संख्या",
      SUMMARY_TITLE: "विभाजन सारांश",
      SUMMARY_FILES_COUNT: "अलग-अलग PDF फाइलें बनाई जाएंगी",
      SUMMARY_SINGLE_FILE: "1 PDF फाइल बनाई जाएगी",
      SUMMARY_DELIVERY_ZIP: "ZIP संग्रह के रूप में पैक किया गया",
      SUMMARY_DELIVERY_SINGLE: "सीधे एकल PDF के रूप में डाउनलोड करें",
      BTN_SPLIT: "PDF विभाजित करें",
      PAGE: "पेज",
      PART: "भाग",
      EXCLUDED: "छोड़ा गया",
      ERROR_SINGLE_FILE_ONLY: "PDF विभाजित करें एक बार में केवल एक PDF स्वीकार करता है।",
      ERROR_INVALID_RANGES: "विभाजित करने से पहले कृपया अमान्य पेज रेंज ठीक करें।",
      SECTION_DISTRIBUTION_TITLE: "पेज वितरण का दृश्य प्रदर्शन",
      SECTION_DISTRIBUTION_DESC: "रंग-कोडित बैज दर्शाते हैं कि प्रत्येक पृष्ठ किस अलग फाइल का हिस्सा है।",
      SECTION_CONFIG_TITLE: "विभाजन कॉन्फ़िगरेशन",
      MODES_LABEL: "विभाजन मोड",
      DEFINED_RANGES: "निर्धारित रेंज",
      RANGE_LABEL: "रेंज",
      RANGES_LABEL: "रेंज",
      PAGE_LABEL: "पेज",
      PAGES_LABEL: "पेज",
      REMOVE_RANGE: "रेंज हटाएं",
      FIXED_HINT_PREFIX: "प्रत्येक",
      FIXED_HINT_SUFFIX: "को एक स्वतंत्र PDF में सहेजा जाएगा।",
      EXTRACT_ALL_HINT: "सभी पृष्ठों को अलग-अलग PDF दस्तावेज़ों के रूप में निकाला जाएगा और ZIP संग्रह में पैक किया जाएगा।",
      PROCESSING_TITLE: "PDF विभाजित हो रहा है...",
      PREPARING_MSG: "दस्तावेज़ को विभाजित करने के लिए तैयार किया जा रहा है...",
      ERR_CHUNK_SIZE_MIN: "प्रति भाग पेज कम से कम 1 होना चाहिए।",
      ERR_CHUNK_SIZE_MAX: "प्रति भाग पेज कुल पृष्ठों से अधिक नहीं हो सकता।",
      ERR_NO_RANGES: "कृपया कम से कम एक पेज रेंज जोड़ें।",
      ERR_INVALID_NUMBER: "पेज संख्या पूर्णांक होनी चाहिए।",
      ERR_START_MIN: "आरंभिक पेज कम से कम 1 होना चाहिए।",
      ERR_END_MIN: "अंतिम पेज कम से कम 1 होना चाहिए।",
      ERR_START_EXCEEDS: "आरंभिक पेज कुल पृष्ठों से अधिक है।",
      ERR_END_EXCEEDS: "अंतिम पेज कुल पृष्ठों से अधिक है।",
      ERR_START_GREATER: "आरंभिक पेज अंतिम पेज से बड़ा नहीं हो सकता।",
      ERR_OVERLAP: "पिछली रेंज के साथ ओवरलैप करता है।",
      ERR_FIX_RANGES: "विभाजित करने से पहले कृपया रेंज की त्रुटियां ठीक करें।"
    }
  },
  fr: {
    NAV: {
      MERGE_PDF: "Fusionner PDF",
      SPLIT_PDF: "Diviser PDF",
      COMPRESS_PDF: "Compresser PDF",
      CONVERT_PDF: "Convertir PDF",
      ALL_TOOLS: "Tous les outils",
      SEARCH_PLACEHOLDER: "Rechercher des outils PDF...",
      CLEAR: "Effacer"
    },
    HERO: {
      ENGINE_TAG: "Moteur PDF nouvelle génération • 100% gratuit et privé",
      TITLE_MAIN: "Tous les outils pour",
      TITLE_HIGHLIGHT: "adapter vos PDF",
      TITLE_SUFFIX: "en un seul endroit",
      SUBTITLE: "Fusionnez, divisez, compressez et convertissez vos documents sans conservation sur le serveur. Utilitaires côté client 100% gratuits.",
      BADGE_CLIENT_SIDE: "100% Côté Client",
      BADGE_ZERO_STORAGE: "Zéro Rétention Serveur",
      BADGE_NO_LIMITS: "Aucune Limite de Taille",
      BADGE_FREE: "Gratuit • Sans Inscription",
      CARD_INSTANT: "Instantané dans le navigateur",
      CARD_INSTANT_DESC: "0s d'attente • Côté client",
      CARD_STORAGE: "Zéro stockage serveur",
      CARD_STORAGE_DESC: "Les fichiers ne quittent jamais votre appareil"
    },
    FILTERS: {
      ALL: "Tous les outils",
      WORKFLOWS: "Flux de travail",
      ORGANIZE: "Organiser PDF",
      OPTIMIZE: "Optimiser PDF",
      CONVERT: "Convertir PDF",
      EDIT: "Modifier PDF",
      SECURITY: "Sécurité PDF",
      INTELLIGENCE: "Intelligence PDF"
    },
    TOOLS: {
      LIVE: "Disponible",
      SOON: "Bientôt",
      OPEN_TOOL: "Ouvrir",
      COMING_SOON: "Bientôt disponible",
      MERGE_NAME: "Fusionner PDF",
      MERGE_DESC: "Combinez des PDF dans l'ordre souhaité.",
      MERGE_PDF_NAME: "Fusionner PDF",
      MERGE_PDF_DESC: "Combinez des PDF dans l'ordre souhaité.",
      SPLIT_NAME: "Diviser PDF",
      SPLIT_DESC: "Séparez une page ou un ensemble en fichiers indépendants.",
      SPLIT_PDF_NAME: "Diviser PDF",
      SPLIT_PDF_DESC: "Séparez une page ou un ensemble en fichiers indépendants.",
      COMPRESS_NAME: "Compresser PDF",
      COMPRESS_DESC: "Réduisez la taille en conservant une qualité optimale.",
      COMPRESS_PDF_NAME: "Compresser PDF",
      COMPRESS_PDF_DESC: "Réduisez la taille en conservant une qualité optimale.",
      PDF_TO_WORD_NAME: "PDF en Word",
      PDF_TO_WORD_DESC: "Convertissez facilement vos PDF en documents Word DOCX modifiables.",
      PDF_TO_PPT_NAME: "PDF en PowerPoint",
      PDF_TO_PPT_DESC: "Transformez vos PDF en présentations PPTX.",
      PDF_TO_POWERPOINT_NAME: "PDF en PowerPoint",
      PDF_TO_POWERPOINT_DESC: "Transformez vos PDF en présentations PPTX.",
      PDF_TO_EXCEL_NAME: "PDF en Excel",
      PDF_TO_EXCEL_DESC: "Extrayez les données de vos PDF dans des feuilles Excel.",
      WORD_TO_PDF_NAME: "Word en PDF",
      WORD_TO_PDF_DESC: "Convertissez des documents DOC et DOCX en PDF.",
      PPT_TO_PDF_NAME: "PowerPoint en PDF",
      PPT_TO_PDF_DESC: "Convertissez vos présentations PPTX en PDF.",
      EXCEL_TO_PDF_NAME: "Excel en PDF",
      EXCEL_TO_PDF_DESC: "Convertissez vos classeurs Excel en PDF.",
      EDIT_PDF_NAME: "Modifier PDF",
      EDIT_PDF_DESC: "Ajoutez du texte, des images ou des formes à votre PDF.",
      PDF_TO_JPG_NAME: "PDF en JPG",
      PDF_TO_JPG_DESC: "Convertissez chaque page en image JPG.",
      JPG_TO_PDF_NAME: "JPG en PDF",
      JPG_TO_PDF_DESC: "Convertissez des images JPG en PDF en quelques secondes.",
      SIGN_PDF_NAME: "Signer PDF",
      SIGN_PDF_DESC: "Signez vous-même ou demandez des signatures électroniques.",
      WATERMARK_NAME: "Filigrane",
      WATERMARK_DESC: "Ajoutez une image ou un texte en filigrane.",
      ROTATE_PDF_NAME: "Faire pivoter PDF",
      ROTATE_PDF_DESC: "Pivotez vos pages PDF comme vous le souhaitez."
    },
    MEDIA: {
      SOON_BADGE: "Bientôt disponible",
      TITLE: "Traitement d'images simplifié avec PDFTailor Media",
      DESC: "Rognez, redimensionnez et convertissez vos images en toute sécurité.",
      CTA_SOON: "Bientôt disponible"
    },
    FOOTER: {
      TAGLINE: "L'espace de travail PDF élégant et confidentiel.",
      ZERO_RETENTION: "Zéro rétention serveur",
      TLS_ENCRYPTED: "Chiffrement TLS de bout en bout",
      COL_PRODUCT: "Produit",
      COL_TOOLS: "Outils PDF",
      COL_CONVERT_TO: "Convertir en PDF",
      COL_CONVERT_FROM: "Convertir depuis PDF",
      COL_COMPANY: "Entreprise",
      COL_LEGAL: "Légal & Confidentialité",
      LINK_HOME: "Accueil PDFTailor",
      LINK_MERGE: "Fusionner PDF",
      LINK_SPLIT: "Diviser PDF",
      LINK_COMPRESS: "Compresser PDF",
      LINK_EDIT: "Modifier PDF",
      LINK_SIGN: "Signer PDF",
      LINK_WORD_TO_PDF: "Word en PDF",
      LINK_EXCEL_TO_PDF: "Excel en PDF",
      LINK_PPT_TO_PDF: "PowerPoint en PDF",
      LINK_JPG_TO_PDF: "JPG en PDF",
      LINK_WORD: "PDF en Word",
      LINK_PPT: "PDF en PowerPoint",
      LINK_PDF_TO_WORD: "PDF en Word",
      LINK_PDF_TO_EXCEL: "PDF en Excel",
      LINK_PDF_TO_PPT: "PDF en PowerPoint",
      LINK_PDF_TO_JPG: "PDF en JPG",
      LINK_SECURITY: "Sécurité PDF",
      LINK_PRIVACY: "Politique de confidentialité",
      LINK_TERMS: "Conditions d'utilisation",
      LINK_GDPR: "Conformité RGPD",
      LINK_WHITEPAPER: "Livre blanc sécurité",
      LINK_COOKIES: "Paramètres des cookies",
      LINK_ABOUT: "À propos",
      LINK_CONTACT: "Contact & Support",
      LINK_BLOG: "Blog & Guides",
      LINK_PRESS: "Presse & Médias",
      COPYRIGHT: "© 2026 PDFTailor. Tous droits réservés."
    },
    SPLIT_PDF: {
      TITLE: "Diviser PDF",
      SUBTITLE: "Séparez une page ou un ensemble en fichiers PDF indépendants en toute confidentialité.",
      CHANGE_FILE: "Changer de fichier",
      MODE_CUSTOM: "Plages personnalisées",
      MODE_CUSTOM_DESC: "Définissez des plages de pages spécifiques à extraire",
      MODE_FIXED: "Morceaux de pages fixes",
      MODE_FIXED_DESC: "Divisez le document en parties égales de N pages",
      MODE_EXTRACT_ALL: "Extraire toutes les pages",
      MODE_EXTRACT_ALL_DESC: "Convertissez chaque page en un fichier PDF distinct",
      RANGE_FROM: "De la page",
      RANGE_TO: "à",
      ADD_RANGE: "+ Ajouter une autre plage",
      CHUNK_SIZE_LABEL: "Pages par fichier divisé",
      SUMMARY_TITLE: "Résumé de la division",
      SUMMARY_FILES_COUNT: "fichiers PDF distincts seront créés",
      SUMMARY_SINGLE_FILE: "1 fichier PDF sera créé",
      SUMMARY_DELIVERY_ZIP: "Emballé dans une archive ZIP",
      SUMMARY_DELIVERY_SINGLE: "Téléchargé directement comme un seul PDF",
      BTN_SPLIT: "Diviser PDF",
      PAGE: "Page",
      PART: "Partie",
      EXCLUDED: "Exclue",
      ERROR_SINGLE_FILE_ONLY: "Diviser PDF accepte un seul fichier à la fois.",
      ERROR_INVALID_RANGES: "Veuillez corriger les plages de pages invalides."
    }
  },
  de: {
    NAV: {
      MERGE_PDF: "PDF zusammenfügen",
      SPLIT_PDF: "PDF teilen",
      COMPRESS_PDF: "PDF komprimieren",
      CONVERT_PDF: "PDF konvertieren",
      ALL_TOOLS: "Alle Werkzeuge",
      SEARCH_PLACEHOLDER: "PDF-Tools durchsuchen...",
      CLEAR: "Löschen"
    },
    HERO: {
      ENGINE_TAG: "PDF-Engine der nächsten Generation • 100% kostenlos & privat",
      TITLE_MAIN: "Alle Werkzeuge,",
      TITLE_HIGHLIGHT: "um PDFs anzupassen",
      TITLE_SUFFIX: "an einem Ort",
      SUBTITLE: "Fügen Sie Dokumente zusammen, teilen, komprimieren und konvertieren Sie ohne Speicherung auf dem Server.",
      BADGE_CLIENT_SIDE: "100% Client-seitig",
      BADGE_ZERO_STORAGE: "Keine Serverspeicherung",
      BADGE_NO_LIMITS: "Keine Größenbeschränkungen",
      BADGE_FREE: "Kostenlos • Ohne Registrierung",
      CARD_INSTANT: "Sofort im Browser",
      CARD_INSTANT_DESC: "0s Wartezeit • Client-seitig",
      CARD_STORAGE: "Null Serverspeicherung",
      CARD_STORAGE_DESC: "Ihre Dateien verlassen niemals Ihr Gerät"
    },
    FILTERS: {
      ALL: "Alle Werkzeuge",
      WORKFLOWS: "Workflows",
      ORGANIZE: "PDF organisieren",
      OPTIMIZE: "PDF optimieren",
      CONVERT: "PDF konvertieren",
      EDIT: "PDF bearbeiten",
      SECURITY: "PDF-Sicherheit",
      INTELLIGENCE: "PDF-Intelligenz"
    },
    TOOLS: {
      LIVE: "Aktiv",
      SOON: "Bald",
      OPEN_TOOL: "Öffnen",
      COMING_SOON: "Demnächst",
      MERGE_NAME: "PDF zusammenfügen",
      MERGE_DESC: "Fügen Sie PDFs in der gewünschten Reihenfolge zusammen.",
      MERGE_PDF_NAME: "PDF zusammenfügen",
      MERGE_PDF_DESC: "Fügen Sie PDFs in der gewünschten Reihenfolge zusammen.",
      SPLIT_NAME: "PDF teilen",
      SPLIT_DESC: "Trennen Sie einzelne Seiten oder Abschnitte heraus.",
      SPLIT_PDF_NAME: "PDF teilen",
      SPLIT_PDF_DESC: "Trennen Sie einzelne Seiten oder Abschnitte heraus.",
      COMPRESS_NAME: "PDF komprimieren",
      COMPRESS_DESC: "Reduzieren Sie die Dateigröße bei optimaler Qualität.",
      COMPRESS_PDF_NAME: "PDF komprimieren",
      COMPRESS_PDF_DESC: "Reduzieren Sie die Dateigröße bei optimaler Qualität.",
      PDF_TO_WORD_NAME: "PDF in Word",
      PDF_TO_WORD_DESC: "Konvertieren Sie PDFs in bearbeitbare Word-Dokumente.",
      PDF_TO_PPT_NAME: "PDF in PowerPoint",
      PDF_TO_PPT_DESC: "Wandeln Sie PDFs in PowerPoint-Präsentationen um.",
      PDF_TO_POWERPOINT_NAME: "PDF in PowerPoint",
      PDF_TO_POWERPOINT_DESC: "Wandeln Sie PDFs in PowerPoint-Präsentationen um.",
      PDF_TO_EXCEL_NAME: "PDF in Excel",
      PDF_TO_EXCEL_DESC: "Extrahieren Sie Tabellendaten in Excel.",
      WORD_TO_PDF_NAME: "Word in PDF",
      WORD_TO_PDF_DESC: "Konvertieren Sie Word-Dokumente in PDF.",
      PPT_TO_PDF_NAME: "PowerPoint in PDF",
      PPT_TO_PDF_DESC: "Konvertieren Sie PowerPoint in PDF.",
      EXCEL_TO_PDF_NAME: "Excel in PDF",
      EXCEL_TO_PDF_DESC: "Konvertieren Sie Excel-Dateien in PDF.",
      EDIT_PDF_NAME: "PDF bearbeiten",
      EDIT_PDF_DESC: "Fügen Sie Text, Bilder oder Anmerkungen hinzu.",
      PDF_TO_JPG_NAME: "PDF in JPG",
      PDF_TO_JPG_DESC: "Konvertieren Sie PDF-Seiten in JPG-Bilder.",
      JPG_TO_PDF_NAME: "JPG in PDF",
      JPG_TO_PDF_DESC: "Konvertieren Sie JPG-Bilder in PDF.",
      SIGN_PDF_NAME: "PDF signieren",
      SIGN_PDF_DESC: "Signieren Sie digital oder fordern Sie Unterschriften an.",
      WATERMARK_NAME: "Wasserzeichen",
      WATERMARK_DESC: "Fügen Sie ein Wasserzeichen hinzu.",
      ROTATE_PDF_NAME: "PDF drehen",
      ROTATE_PDF_DESC: "Drehen Sie Ihre PDF-Seiten."
    },
    MEDIA: {
      SOON_BADGE: "Demnächst",
      TITLE: "Bildbearbeitung einfach gemacht mit PDFTailor Media",
      DESC: "Zuschneiden, skalieren und konvertieren von Bildern.",
      CTA_SOON: "Demnächst"
    },
    FOOTER: {
      TAGLINE: "Der elegante, datenschutzfreundliche PDF-Arbeitsplatz.",
      ZERO_RETENTION: "Null Serverspeicherung",
      TLS_ENCRYPTED: "Ende-zu-Ende TLS-verschlüsselt",
      COL_PRODUCT: "Produkt",
      COL_TOOLS: "PDF-Werkzeuge",
      COL_CONVERT_TO: "In PDF konvertieren",
      COL_CONVERT_FROM: "Aus PDF konvertieren",
      COL_COMPANY: "Unternehmen",
      COL_LEGAL: "Rechtliches & Datenschutz",
      LINK_HOME: "PDFTailor Startseite",
      LINK_MERGE: "PDF zusammenfügen",
      LINK_SPLIT: "PDF teilen",
      LINK_COMPRESS: "PDF komprimieren",
      LINK_EDIT: "PDF bearbeiten",
      LINK_SIGN: "PDF signieren",
      LINK_WORD_TO_PDF: "Word in PDF",
      LINK_EXCEL_TO_PDF: "Excel in PDF",
      LINK_PPT_TO_PDF: "PowerPoint in PDF",
      LINK_JPG_TO_PDF: "JPG in PDF",
      LINK_WORD: "PDF in Word",
      LINK_PPT: "PDF in PowerPoint",
      LINK_PDF_TO_WORD: "PDF in Word",
      LINK_PDF_TO_EXCEL: "PDF in Excel",
      LINK_PDF_TO_PPT: "PDF in PowerPoint",
      LINK_PDF_TO_JPG: "PDF in JPG",
      LINK_SECURITY: "PDF-Sicherheit",
      LINK_PRIVACY: "Datenschutz",
      LINK_TERMS: "Nutzungsbedingungen",
      LINK_GDPR: "DSGVO",
      LINK_WHITEPAPER: "Sicherheits-Whitepaper",
      LINK_COOKIES: "Cookie-Einstellungen",
      LINK_ABOUT: "Über uns",
      LINK_CONTACT: "Kontakt & Hilfe",
      LINK_BLOG: "Blog",
      LINK_PRESS: "Presse",
      COPYRIGHT: "© 2026 PDFTailor. Alle Rechte vorbehalten."
    },
    SPLIT_PDF: {
      TITLE: "PDF teilen",
      SUBTITLE: "Trennen Sie einzelne Seiten oder Bereiche in eigenständige PDF-Dateien mit voller Privatsphäre.",
      CHANGE_FILE: "Datei wechseln",
      MODE_CUSTOM: "Benutzerdefinierte Bereiche",
      MODE_CUSTOM_DESC: "Gezielte Seitenbereiche als separate Dateien extrahieren",
      MODE_FIXED: "Feste Seitenblöcke",
      MODE_FIXED_DESC: "Dokument in gleich große Teile von N Seiten teilen",
      MODE_EXTRACT_ALL: "Alle Seiten extrahieren",
      MODE_EXTRACT_ALL_DESC: "Jede Seite in eine eigene PDF-Datei umwandeln",
      RANGE_FROM: "Von Seite",
      RANGE_TO: "bis",
      ADD_RANGE: "+ Weiteren Bereich hinzufügen",
      CHUNK_SIZE_LABEL: "Seiten pro geteilte Datei",
      SUMMARY_TITLE: "Zusammenfassung",
      SUMMARY_FILES_COUNT: "separate PDF-Dateien werden erstellt",
      SUMMARY_SINGLE_FILE: "1 PDF-Datei wird erstellt",
      SUMMARY_DELIVERY_ZIP: "Als ZIP-Archiv verpackt",
      SUMMARY_DELIVERY_SINGLE: "Direkt als einzelne PDF herunterladen",
      BTN_SPLIT: "PDF teilen",
      PAGE: "Seite",
      PART: "Teil",
      EXCLUDED: "Ausgeschlossen",
      ERROR_SINGLE_FILE_ONLY: "PDF teilen unterstützt jeweils nur eine Datei.",
      ERROR_INVALID_RANGES: "Bitte korrigieren Sie ungültige Seitenbereiche."
    }
  }
};

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

for (const lang of LANGUAGES) {
  const filePath = path.join(I18N_DIR, `${lang}.json`);
  let existing = {};
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {}
  }
  const merged = deepMerge(JSON.parse(JSON.stringify(enFull)), existing);
  if (TRANSLATIONS[lang]) {
    deepMerge(merged, TRANSLATIONS[lang]);
  }
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
}

// Clean up pending directory
if (fs.existsSync(PENDING_PATH)) {
  fs.unlinkSync(PENDING_PATH);
}
const pendingDir = path.dirname(PENDING_PATH);
if (fs.existsSync(pendingDir) && fs.readdirSync(pendingDir).length === 0) {
  fs.rmdirSync(pendingDir);
}

console.log(`Successfully generated and synchronized ${LANGUAGES.length} language files.`);

