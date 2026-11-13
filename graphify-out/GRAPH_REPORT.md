# Graph Report - PDF-Tool  (2026-11-13)

## Corpus Check
- 342 files · ~386,859 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 57 file(s) not represented in the graph (top: .css 32, .woff 14, (none) 7)

## Summary
- 6099 nodes · 13202 edges · 241 communities (138 shown, 103 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 230 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `609a7ebb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- pdf.worker.min.mjs
- XFAObjectArray
- StringObject
- Button
- powerpoint-to-pdf.route.ts
- OptionObject
- shadow
- pdf-to-word.route.ts
- LocaleSetNamespace
- detect.ts
- .success
- XFAObject
- document-model.ts
- gdpr-compliance.component.ts
- .checkAndRepair
- ConfigNamespace
- PartialEvaluator
- sign-workflow.service.ts
- JpegImage
- CalRGBCS
- RefSetCache
- src/app.ts
- sign-pdf.component.ts
- Ma
- EditPdfComponent
- dependencies
- ValidatedPdfFile
- Jbig2Error
- ContentObject
- getInteger
- edit-pdf.component.ts
- @angular/core
- angular.json
- ref_pdf_lib
- Dict
- contracts/src/index.ts
- IccColorSpace
- pkcs12-browser.ts
- Page
- SigningRequestRecord
- CipherTransformFactory
- powerpoint-to-pdf.route.ts
- FormatError
- SignPdfComponent
- app/app.ts
- .getTextContent
- CMap
- Annotation
- BrowserPdfService
- info
- edit-pdf-ocr.ts
- ._create
- ExpressionBuilderVisitor
- FontFinder
- PageDimensions
- SignSignatureDialogComponent
- compileCharString
- SignFieldElement
- IntegerObject
- calculateSHA512
- Glyph
- WidgetAnnotation
- web/package.json
- AppError
- JpgToPdfComponent
- unreachable
- FontInfo
- PdfToJpgComponent
- CFFCompiler
- .constructor
- pdf-size-report.ts
- api/package.json
- .createDocumentHandler
- parseCMap
- ref_pdf_lib
- ExclGroup
- pdf-to-jpg.ts
- HeaderComponent
- pdf-to-excel.route.ts
- .constructPostScript
- stringToBytes
- ToolPlaceholderComponent
- engine.mjs
- PdfExportService
- pdf-to-powerpoint/build.ts
- Util
- Builder
- .get
- Type1Parser
- HomeComponent
- Binder
- excel-to-pdf.route.ts
- getMeasurement
- CFFParser
- PdfToJpgService
- MergePdfComponent
- PdfToExcelComponent
- scripts
- ChunkedStream
- PDFWorkerStreamReader
- jpg-to-pdf.component.ts
- SelectionOverlayComponent
- PdfToPowerPointComponent
- BasePdfManager
- powerpoint-to-pdf.component.ts
- PDFImage
- StructTreePage
- XmlObject
- SignPanelComponent
- ExcelToPdfComponent
- typing.ts
- XFAFactory
- SimpleXMLParser
- TextMeasure
- MessageHandler
- XMLParserBase
- ImageProbeService
- sign-core/package.json
- PostScriptStack
- compilerOptions
- typescript
- getRelevant
- pdf-to-excel/build.ts
- ButtonWidgetAnnotation
- DecodeStream
- sign-request.component.ts
- OperatorList
- pdf-layout-extractor.ts
- SignRequestService
- ConsentService
- PdfToWordComponent
- WordToPdfComponent
- ColorSpace
- SingleIntersector
- TextEditElement
- PowerPointToPdfComponent
- StringStream
- SignStampDialogComponent
- compilerOptions
- assert
- ContentEditableModelDirective
- IdentityCMap
- NullOptimizer
- pdf-to-jpg.service.ts
- sign-pdf.ts
- bytesToString
- scripts
- excel-to-pdf.component.ts
- ViewportNavigationService
- UploadConsentDialogComponent
- XFAParser
- pdf-to-excel/index.ts
- Datasets
- SystemFontInfo
- LabCS
- XFAAttribute
- MathClamp
- CalGrayCS
- BinaryCMapStream
- CFFOffsetTracker
- Color
- ContactUsComponent
- home.component.ts
- Type1Font
- SignatureStorageService
- CFFDict
- range-parser.ts
- JpegSanitizer
- CookieSettingsComponent
- word-to-pdf.route.ts
- SimpleDOMNode
- DeviceRgbCS
- SignFieldBoxComponent
- pdf-text-extraction.service.ts
- MetadataParser
- pdf-export.service.ts
- canvas-limits.ts
- PrivacyPolicyComponent
- SignExportService
- SignatureImageService
- DeviceGrayCS
- DeviceRgbaCS
- DeviceCmykCS
- PdfRenderingService
- TemplateNamespace
- CFFStrings
- Ui
- scripts
- xdp_Xdp
- PostScriptParser
- FreehandDrawingService
- compilerOptions
- edit-pdf-ocr.route.ts
- Template
- signature_Signature
- Stylesheet
- jfif-patcher.ts
- PressMediaKitComponent
- pt-faq-accordion.component.ts
- custom-environment.js
- JpegImage
- serve-prod.mjs
- PDFBase
- EvalState
- PostScriptLexer
- XhtmlObject
- serve
- Root
- AESBaseCipher
- .setBorderStyle
- cors
- @pdf-lib/fontkit@^1.1.1
- @types/multer@^2.3.0
- angular-cli
- build
- TermsAndConditionsComponent
- options
- web
- Br
- CFFIndex
- sign.route.ts
- development
- production
- staging
- P
- about-us.component.ts
- dev.mjs
- CFFFDSelect
- environment.prod.ts
- environment.staging.ts
- web/src/types/fontkit.d.ts
- sign-core/src/types/fontkit.d.ts

## God Nodes (most connected - your core abstractions)
1. `XFAObject` - 217 edges
2. `warn()` - 168 edges
3. `EditPdfComponent` - 151 edges
4. `@angular/core` - 147 edges
5. `ConfigNamespace` - 141 edges
6. `TemplateNamespace` - 115 edges
7. `SignPdfComponent` - 112 edges
8. `shadow()` - 99 edges
9. `FormatError` - 88 edges
10. `getStringOption()` - 85 edges

## Surprising Connections (you probably didn't know these)
- `ConvertPdfToExcelOptions` --inherits--> `PdfToExcelOptions`  [EXTRACTED]
  apps/api/src/services/pdf-to-excel/index.ts → packages/contracts/src/pdf-to-excel.ts
- `SanitisedPdfResult` --references--> `PdfPageBoxMetrics`  [EXTRACTED]
  apps/api/src/services/sign/sanitise-pdf.ts → packages/contracts/src/sign-pdf.ts
- `OcrJobItem` --references--> `EditPdfOcrResult`  [EXTRACTED]
  apps/api/src/routes/edit-pdf-ocr.route.ts → packages/contracts/src/edit-pdf-ocr.ts
- `SignStampDialogComponent` --references--> `SignStampShape`  [EXTRACTED]
  apps/web/src/app/pages/sign-pdf/components/stamp-dialog/stamp-dialog.component.ts → packages/contracts/src/sign-pdf.ts
- `BuildWorkbookOptions` --references--> `PdfToExcelOptions`  [EXTRACTED]
  apps/api/src/services/pdf-to-excel/build.ts → packages/contracts/src/pdf-to-excel.ts

## Import Cycles
- None detected.

## Communities (241 total, 103 thin omitted)

### Community 0 - "pdf.worker.min.mjs"
Cohesion: 0.01
Nodes (179): A, aa, ac, addChildren(), addHex(), ae, ai, an (+171 more)

### Community 1 - "XFAObjectArray"
Cohesion: 0.02
Nodes (25): Acrobat, Agent, Common, Config, config_FontInfo, Data, Desc, DigestMethods (+17 more)

### Community 2 - "StringObject"
Cohesion: 0.02
Nodes (38): Amd, Base, Certificate, config_Picture, connection_set_Uri, ConnectionSetNamespace, Creator, EffectiveInputPolicy (+30 more)

### Community 4 - "powerpoint-to-pdf.route.ts"
Cohesion: 0.05
Nodes (59): convertCsvToXlsxBuffer(), CsvConversionResult, detectDelimiter(), detectEncoding(), parseDelimitedText(), convertExcelToPdf(), ExcelConversionItemResult, MAX_PDF_PAGES (+51 more)

### Community 5 - "OptionObject"
Cohesion: 0.02
Nodes (35): ADBE_JSConsole, ADBE_JSDebugger, Attributes, AutoSave, config_Validate, Conformance, Destination, DigestMethod (+27 more)

### Community 6 - "shadow"
Cohesion: 0.05
Nodes (16): Catalog, appendIfJavaScriptDict(), parseNestedOrder(), parseOrder(), _collectJS(), createValidAbsoluteUrl(), FeatureTest, fetchDest() (+8 more)

### Community 7 - "pdf-to-word.route.ts"
Cohesion: 0.06
Nodes (29): buildDocxFromPages(), ExtractedPageContent, extractPdfPageContents(), jobStore, PdfToWordJob, pdfToWordRouter, upload, validatePdfInput() (+21 more)

### Community 8 - "LocaleSetNamespace"
Cohesion: 0.03
Nodes (25): CalendarSymbols, CurrencySymbol, CurrencySymbols, DatePattern, DatePatterns, DateTimeSymbols, Day, DayNames (+17 more)

### Community 9 - "detect.ts"
Cohesion: 0.13
Nodes (27): analyzePdf(), getScanner(), LayoutBox, LayoutImage, LayoutLine, LayoutPage, LayoutSegment, nativeImport() (+19 more)

### Community 10 - ".success"
Cohesion: 0.06
Nodes (34): applyAssist(), ariaLabel(), checkDimensions(), ChoiceList, computeBbox(), Corner, createWrapper(), DateTimeEdit (+26 more)

### Community 11 - "XFAObject"
Cohesion: 0.03
Nodes (6): ConnectionSet, Format, ps, Staple, ui, XFAObject

### Community 12 - "document-model.ts"
Cohesion: 0.10
Nodes (15): AreaSelectionState, DrawPoint, ElementType, OcrLineItem, OcrWordItem, AreaDragMoveState, MarqueeDragState, CanvasInteractionService (+7 more)

### Community 13 - "gdpr-compliance.component.ts"
Cohesion: 0.25
Nodes (5): FlowStep, GdprComplianceComponent, GdprPrinciple, SecurityControl, SubjectRight

### Community 14 - ".checkAndRepair"
Cohesion: 0.04
Nodes (41): adjustWidths(), amendFallbackToUnicode(), applyStandardFontGlyphMap(), buildToFontChar(), CFFFont, convertCidString(), createCmapTable(), createNameTable() (+33 more)

### Community 15 - "ConfigNamespace"
Cohesion: 0.02
Nodes (47): Acrobat7, AddSilentPrint, AddViewerPreferences, Cache, Change, Compression, CompressLogicalStructure, config_Encrypt (+39 more)

### Community 16 - "PartialEvaluator"
Cohesion: 0.05
Nodes (16): addCachedImageOps(), CMapFactory, ErrorFont, fetchBinaryData(), getEncoding(), getTilingPatternIR(), getXfaFontDict(), getXfaFontName() (+8 more)

### Community 17 - "sign-workflow.service.ts"
Cohesion: 0.11
Nodes (12): appendAuditEntry(), decryptDocumentAtRest(), encryptDocumentAtRest(), generateToken256(), hashSecretToken(), resolveMasterKey(), SignerRecord, SigningRequestRepository (+4 more)

### Community 18 - "JpegImage"
Cohesion: 0.10
Nodes (22): adjustMapping(), buildComponentData(), buildHuffmanTable(), decodeScan(), decodeBlock(), decodeHuffman(), decodeMcu(), readBit() (+14 more)

### Community 20 - "RefSetCache"
Cohesion: 0.05
Nodes (15): AppearanceStreamEvaluator, BaseLocalCache, clearGlobalCaches(), GlobalColorSpaceCache, GlobalImageCache, isDict(), LocalColorSpaceCache, LocalFunctionCache (+7 more)

### Community 21 - "src/app.ts"
Cohesion: 0.06
Nodes (34): zod@^4.6.7, createApp(), env, envFile, envSchema, isSignRequestsEnabled(), openApiSpec, app (+26 more)

### Community 22 - "sign-pdf.component.ts"
Cohesion: 0.11
Nodes (27): PdfInspectionService, PdfInspectionSummary, SIGN_DATE_FORMAT_OPTIONS, SIGN_FIELD_PALETTE, SignatureDialogKind, SignatureDialogTab, SIGNER_CHIP_COLORS, SignerDraft (+19 more)

### Community 23 - "Ma"
Cohesion: 0.25
Nodes (6): B, Ma(), doRun(), receiveInstance(), updateMemoryViews(), enqueueChunk()

### Community 25 - "dependencies"
Cohesion: 0.06
Nodes (35): dependencies, docx@^9.14.0, dotenv@^16.4.7, exceljs@^4.4.0, express@^4.21.2, express-rate-limit@^8.7.1, fast-xml-parser@^5.11.2, helmet@^8.0.0 (+27 more)

### Community 26 - "ValidatedPdfFile"
Cohesion: 0.06
Nodes (8): ValidatedPdfFile, ConvertedExcelResult, PdfToExcelService, ConvertedPowerPointResult, PdfToPowerPointService, PdfToWordService, FileListComponent, environment

### Community 27 - "Jbig2Error"
Cohesion: 0.08
Nodes (19): ArithmeticDecoder, ContextCache, decodeBitmap(), decodeIAID(), decodeInteger(), decodeMMRBitmap(), decodeRefinement(), decodeTextRegion() (+11 more)

### Community 28 - "ContentObject"
Cohesion: 0.02
Nodes (22): AlwaysEmbed, BehaviorOverride, BooleanElement, ContentObject, DateElement, DateTime, Decimal, DefaultTypeface (+14 more)

### Community 29 - "getInteger"
Cohesion: 0.03
Nodes (24): Arc, Barcode, Break, BreakAfter, BreakBefore, Comb, config_Area, Equate (+16 more)

### Community 30 - "edit-pdf.component.ts"
Cohesion: 0.06
Nodes (20): EditPdfHeroComponent, EditPdfTopNavComponent, DrawPanelComponent, ElementInfoPanelComponent, HighlightPanelComponent, ImagePanelComponent, LinkPanelComponent, OcrPanelComponent (+12 more)

### Community 31 - "@angular/core"
Cohesion: 0.07
Nodes (14): ServerActionGuard, CookieConsentPreferences, DEFAULT_PREFERENCES, STORAGE_CONSENT_KEY, UploadConsentOptions, UploadConsentService, UploadConsentState, OcrProgressUpdate (+6 more)

### Community 32 - "angular.json"
Cohesion: 0.25
Nodes (7): cli, analytics, packageManager, newProjectRoot, projects, $schema, version

### Community 33 - "ref_pdf_lib"
Cohesion: 0.09
Nodes (33): CompressedFileResult, CompressionJob, compressRouter, jobStore, upload, execFileAsync, findGhostscriptBinary(), isGhostscriptEngineEnabled() (+25 more)

### Community 34 - "Dict"
Cohesion: 0.08
Nodes (3): Dict, FakeUnicodeFont, FreeTextAnnotation

### Community 35 - "contracts/src/index.ts"
Cohesion: 0.05
Nodes (37): routes, ContactService, SeoService, LIVE_TOOL_IDS, ToolRegistryService, WebMcpTool, WebMcpToolSchema, ContactFormData (+29 more)

### Community 36 - "IccColorSpace"
Cohesion: 0.14
Nodes (8): fetchSync(), getUint8ArrayMemory0(), IccColorSpace, passArray8ToWasm0(), __wbg_finalize_init(), __wbg_get_imports(), __wbg_init(), WorkerMessageHandler

### Community 37 - "pkcs12-browser.ts"
Cohesion: 0.12
Nodes (33): RFC-5652, applyDetachedPdfSignature(), bytesToHex(), bytesToLatin1(), DetachedPdfSignOptions, DetachedPdfSignResult, extractPdfSignaturePayload(), formatPdfDate() (+25 more)

### Community 38 - "Page"
Cohesion: 0.05
Nodes (10): AnnotationFactory, collectActions(), getInheritableProperty(), isRefsEqual(), NullStream, ObjectLoader, objectSize(), Page (+2 more)

### Community 39 - "SigningRequestRecord"
Cohesion: 0.09
Nodes (8): DiskDocumentStorage, DiskSigningRequestRepository, ensureDir(), writeJsonAtomic(), InMemorySigningRequestRepository, SigningRequestRecord, SignRequestOrder, SignRequestStatus

### Community 40 - "CipherTransformFactory"
Cohesion: 0.19
Nodes (4): ARCFourCipher, calculateMD5(), CipherTransformFactory, NullCipher

### Community 41 - "powerpoint-to-pdf.route.ts"
Cohesion: 0.08
Nodes (24): jobStore, MAX_FILES, PowerPointPdfOutputFile, PowerPointToPdfJob, powerpointToPdfRouter, upload, mergePowerPointPdfOutputs(), PAGE_SIZES (+16 more)

### Community 42 - "FormatError"
Cohesion: 0.05
Nodes (11): addPageError(), DNLMarkerError, find(), FormatError, InvalidPDFException, Jt, Linearization, PDFDocument (+3 more)

### Community 43 - "SignPdfComponent"
Cohesion: 0.03
Nodes (11): AppliedPagesTarget, DefaultDateOption, SignFieldPaletteItem, ResizeCorner, SignPdfComponent, formatSigningDate(), SignCheckboxConfig, SignDateFormat (+3 more)

### Community 44 - "app/app.ts"
Cohesion: 0.07
Nodes (11): @ngx-translate/core@^18.1.0, App, appConfig, DEFAULT_EN_TRANSLATIONS, SUPPORTED_LANGUAGES, SupportedLanguage, TranslationService, WebMcpService (+3 more)

### Community 45 - ".getTextContent"
Cohesion: 0.08
Nodes (17): Commands, addFakeSpaces(), appendEOL(), applyInverseRotation(), buildTextContentItem(), compareWithLastPosition(), ensureTextContentItem(), flushTextContentItem() (+9 more)

### Community 47 - "Annotation"
Cohesion: 0.09
Nodes (3): Annotation, Body, getRgbColor()

### Community 48 - "BrowserPdfService"
Cohesion: 0.12
Nodes (9): fflate@^0.8.3, vitest@^5.0.0, BrowserPdfService, createStreamingZip(), ZipEntryInput, SplitRangeParser, SplitRangeParseResult, fflate (+1 more)

### Community 49 - "info"
Cohesion: 0.13
Nodes (7): CCITTFaxDecoder, Cmd, EvaluatorPreprocessor, info(), isWhiteSpace(), Parser, ParserEOFException

### Community 50 - "edit-pdf-ocr.ts"
Cohesion: 0.07
Nodes (29): detectSkewAngle(), executePdfOcrJob(), getPdfjs(), OCR_CONCURRENCY, OCR_JOB_TIMEOUT_MS, OCR_PAGE_TIMEOUT_MS, processPageOcr(), LowConfidenceWord (+21 more)

### Community 51 - "._create"
Cohesion: 0.09
Nodes (17): CaretAnnotation, CircleAnnotation, FileAttachmentAnnotation, getPdfColorArray(), getQuadPoints(), HighlightAnnotation, isNumberArray(), LineAnnotation (+9 more)

### Community 52 - "ExpressionBuilderVisitor"
Cohesion: 0.07
Nodes (13): AstArgument, AstBinaryOperation, AstLiteral, AstMin, AstNode, AstVariable, AstVariableDefinition, buildAddOperation() (+5 more)

### Community 54 - "PageDimensions"
Cohesion: 0.10
Nodes (4): EditElement, PageDimensions, AreaSelectionService, ElementOperationsService

### Community 57 - "compileCharString"
Cohesion: 0.09
Nodes (12): parseOperand(), compileCharString(), CompiledFont, compileGlyf(), getFloat214(), getSubroutineBias(), lookupCmap(), lr (+4 more)

### Community 59 - "IntegerObject"
Cohesion: 0.05
Nodes (13): AdjustData, AdobeExtensionLevel, CompressObjectStream, Copies, CurrentPage, IntegerObject, Level, MsgId (+5 more)

### Community 60 - "calculateSHA512"
Cohesion: 0.10
Nodes (11): AES128Cipher, calculateSHA384(), calculateSHA512(), ch(), littleSigma(), littleSigmaPrime(), maj(), PDF20 (+3 more)

### Community 61 - "Glyph"
Cohesion: 0.08
Nodes (5): CompositeGlyph, Contour, Glyph, GlyphHeader, SimpleGlyph

### Community 62 - "WidgetAnnotation"
Cohesion: 0.14
Nodes (7): ChoiceWidgetAnnotation, DefaultAppearanceEvaluator, escapeString(), parseDefaultAppearance(), SignatureWidgetAnnotation, TextWidgetAnnotation, WidgetAnnotation

### Community 63 - "web/package.json"
Cohesion: 0.04
Nodes (60): dependencies, @angular/cdk@^22.2.4, @angular/common@^22.2.0, @angular/compiler@^22.2.0, @angular/core@^22.2.0, @angular/forms@^22.2.0, @angular/material@^22.2.4, @angular/platform-browser@^22.2.0 (+52 more)

### Community 64 - "AppError"
Cohesion: 0.09
Nodes (17): AppError, requirePremiumForOcr(), MAX_PDF_PAGES, pdfToPowerPointRouter, pptxJobStore, RFC-5987, upload, validatePdfInput() (+9 more)

### Community 66 - "unreachable"
Cohesion: 0.12
Nodes (3): BaseStream, Pattern, unreachable()

### Community 70 - ".constructor"
Cohesion: 0.13
Nodes (6): BaseShading, DummyShading, getB(), lookupNormalRect(), MeshShading, RadialAxialShading

### Community 71 - "pdf-size-report.ts"
Cohesion: 0.10
Nodes (26): analyzePdfSize(), CategorySummary, ContentStreamDetail, extractImagePlacementsFromPdfjs(), FontDetail, formatBytes(), ImageDetail, isBinaryAvailable() (+18 more)

### Community 72 - "api/package.json"
Cohesion: 0.10
Nodes (27): devDependencies, jest@^29.7.0, supertest@^7.0.0, ts-jest@^29.2.5, tsx@^4.19.3, @types/cors@^2.8.17, @types/express@^4.17.21, @types/jest@^29.5.14 (+19 more)

### Community 73 - ".createDocumentHandler"
Cohesion: 0.18
Nodes (12): AbortException, getNewAnnotationsMap(), getVerbosityLevel(), ensureNotTerminated(), finishWorkerTask(), loadDocument(), setupDoc(), onFailure() (+4 more)

### Community 74 - "parseCMap"
Cohesion: 0.26
Nodes (15): BinaryCMapReader, createBuiltInCMap(), expectInt(), expectString(), extendCMap(), isCmd(), parseBfChar(), parseBfRange() (+7 more)

### Community 75 - "ref_pdf_lib"
Cohesion: 0.05
Nodes (23): CompressedPdfItem, CompressPdfResult, MergeResult, SplitPdfOptions, SplitPdfOutputFile, SplitPdfResult, ConvertedWordResult, ConvertedWordToPdfResult (+15 more)

### Community 76 - "ExclGroup"
Cohesion: 0.10
Nodes (6): addHTML(), createLine(), ExclGroup, flushHTML(), getAvailableSpace(), Subform

### Community 77 - "pdf-to-jpg.ts"
Cohesion: 0.18
Nodes (9): ConvertedPageItem, ConvertPagesOptions, ConvertPagesOptionsSchema, ExtractedImageItem, ExtractImagesOptions, ExtractImagesOptionsSchema, PdfToJpgMode, PdfToJpgOptionsSchema (+1 more)

### Community 79 - "pdf-to-excel.route.ts"
Cohesion: 0.11
Nodes (14): excelJobStore, ExcelOutputFileResult, MAX_PDF_PAGES, PdfToExcelJob, pdfToExcelRouter, RFC-5987, upload, validatePdfInput() (+6 more)

### Community 81 - "stringToBytes"
Cohesion: 0.25
Nodes (3): CipherTransform, stringToBytes(), toHexUtil()

### Community 83 - "engine.mjs"
Cohesion: 0.16
Nodes (17): pngjs@^7.0.0, analyzePdf(), apply(), cleanFontName(), det(), mul(), parseColor(), sanitizePdfText() (+9 more)

### Community 85 - "pdf-to-powerpoint/build.ts"
Cohesion: 0.10
Nodes (29): PdfToPowerPointJob, PowerPointOutputFileResult, extractPdfWithOcr(), getOcrWorker(), getPdfjs(), nativeRequire, OcrPageResult, OcrTextLine (+21 more)

### Community 86 - "Util"
Cohesion: 0.11
Nodes (3): getTransformMatrix(), lookupRect(), Util

### Community 87 - "Builder"
Cohesion: 0.19
Nodes (3): Builder, Empty, UnknownNamespace

### Community 88 - ".get"
Cohesion: 0.11
Nodes (5): Name, PopupAnnotation, stringToAsciiOrUTF16BE(), stringToUTF16String(), StructTreeRoot

### Community 89 - "Type1Parser"
Cohesion: 0.22
Nodes (5): decrypt(), isHexDigit(), isSpecial(), Type1CharString, Type1Parser

### Community 91 - "Binder"
Cohesion: 0.24
Nodes (3): Binder, createText(), searchNode()

### Community 92 - "excel-to-pdf.route.ts"
Cohesion: 0.08
Nodes (21): ExcelPdfOutputFile, ExcelToPdfJob, excelToPdfRouter, jobStore, upload, mergePdfBuffers(), ConvertedExcelFileItem, ExcelMargins (+13 more)

### Community 93 - "getMeasurement"
Cohesion: 0.05
Nodes (14): Caption, CheckButton, Draw, Field, fixTextIndent(), getMeasurement(), Image, mapStyle() (+6 more)

### Community 95 - "PdfToJpgService"
Cohesion: 0.29
Nodes (3): PdfToJpgService, PdfToJpgConversionResult, PdfToJpgOptions

### Community 98 - "scripts"
Cohesion: 0.06
Nodes (36): author, description, devDependencies, cross-env@^10.1.0, typescript@^5.9.3, vite@^6.4.5, typescript, vite (+28 more)

### Community 99 - "ChunkedStream"
Cohesion: 0.07
Nodes (7): arrayBuffersToBytes(), ChunkedStream, ChunkedStreamManager, MissingDataException, NetworkPdfManager, StructElement, StructElementNode

### Community 100 - "PDFWorkerStreamReader"
Cohesion: 0.12
Nodes (3): PDFWorkerStream, PDFWorkerStreamRangeReader, PDFWorkerStreamReader

### Community 101 - "jpg-to-pdf.component.ts"
Cohesion: 0.10
Nodes (21): ComputedPageLayout, ImageAlignmentOption, ImageFitOption, ImageQualityOption, JpgToPdfBuildResult, JpgToPdfImageItem, JpgToPdfOptions, JpgToPdfProgress (+13 more)

### Community 106 - "powerpoint-to-pdf.component.ts"
Cohesion: 0.13
Nodes (9): DeckInfo, getDeckInfo(), revokeDeckThumbnail(), LayoutService, ConvertedPowerPointToPdfResult, PowerPointToPdfService, SUPPORTED_EXTENSIONS, ValidatedPowerPointFile (+1 more)

### Community 107 - "PDFImage"
Cohesion: 0.11
Nodes (5): convertBlackAndWhiteToRGBA(), convertToRGBA(), ImageResizer, PDFImage, resizeImageMask()

### Community 108 - "StructTreePage"
Cohesion: 0.16
Nodes (4): NameOrNumberTree, NumberTree, StructTreePage, nodeToSerializable()

### Community 112 - "typing.ts"
Cohesion: 0.27
Nodes (13): CellType, cleanString(), CURRENCY_SYMBOLS, DateConvention, inferColumnDateConvention(), inferColumnSeparator(), MONTH_NAMES, mustStayText() (+5 more)

### Community 114 - "SimpleXMLParser"
Cohesion: 0.15
Nodes (5): DatasetReader, DatasetXMLParser, parseXFAPath(), SimpleXMLParser, updateXFA()

### Community 115 - "TextMeasure"
Cohesion: 0.19
Nodes (3): FontSelector, text_FontInfo, TextMeasure

### Community 116 - "MessageHandler"
Cohesion: 0.16
Nodes (5): MessageHandler, PasswordException, ResponseException, UnknownErrorException, wrapReason()

### Community 119 - "sign-core/package.json"
Cohesion: 0.13
Nodes (19): dependencies, @paperflow/contracts@*, pdf-lib@^1.17.1, @pdf-lib/fontkit@^1.1.1, regenerator-runtime@^0.14.1, devDependencies, typescript@^5.7.0, @paperflow/contracts (+11 more)

### Community 121 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+6 more)

### Community 122 - "typescript"
Cohesion: 0.17
Nodes (12): devDependencies, typescript@^5.7.0, typescript, main, name, private, scripts, build (+4 more)

### Community 123 - "getRelevant"
Cohesion: 0.05
Nodes (8): Area, Border, ContentArea, getContainedChildren(), getRelevant(), PageArea, PageSet, SubformSet

### Community 124 - "pdf-to-excel/build.ts"
Cohesion: 0.27
Nodes (12): buildExcelWorkbook(), BuildWorkbookOptions, cutAtWordBoundary(), getUniqueSheetName(), OutsideTextBlock, resolveFont(), sanitizeFormulaInjection(), sanitizeSheetName() (+4 more)

### Community 126 - "DecodeStream"
Cohesion: 0.04
Nodes (14): Ascii85Stream, AsciiHexStream, CCITTFaxStream, DecodeStream, DecryptStream, FlateStream, Jbig2Stream, JpxStream (+6 more)

### Community 127 - "sign-request.component.ts"
Cohesion: 0.10
Nodes (8): LoadPdfOptions, PdfPasswordError, SharedPdfjsService, CompletedFieldSubmission, SenderRequestCreateResult, SenderRequestStatusView, SignerSessionPayload, SignerRouteState

### Community 128 - "OperatorList"
Cohesion: 0.07
Nodes (9): CmykICCBasedCS, decodeString(), JpegStream, JpxError, JpxImage, Lexer, stringToUTF8String(), toHexDigit() (+1 more)

### Community 129 - "pdf-layout-extractor.ts"
Cohesion: 0.14
Nodes (14): pdf-parse@^2.4.5, tesseract.js@^7.0.0, ReconstructedDocument, SemanticElement, SemanticElementType, SemanticTableRow, VisualLine, generateDocxDocument() (+6 more)

### Community 137 - "TextEditElement"
Cohesion: 0.18
Nodes (3): TextEditElement, OcrService, TextFormattingService

### Community 139 - "StringStream"
Cohesion: 0.20
Nodes (7): codePointIter(), getPdfColor(), InkAnnotation, numberToString(), StampAnnotation, StringStream, stringToUTF16HexString()

### Community 141 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+3 more)

### Community 142 - "assert"
Cohesion: 0.26
Nodes (3): assert(), CssFontInfo, toRomanNumerals()

### Community 146 - "pdf-to-jpg.service.ts"
Cohesion: 0.39
Nodes (7): buildCombinedFilename(), buildExtractedImageFilename(), buildPageFilename(), buildZipFilename(), sanitizeBaseName(), computeImageHash(), ConversionProgress

### Community 147 - "sign-pdf.ts"
Cohesion: 0.07
Nodes (41): AuditEventType, CreateSignRequestInput, CreateSignRequestSchema, deriveInitials(), firstGrapheme(), MONTH_LONG, MONTH_SHORT, normalizePageRotation() (+33 more)

### Community 150 - "bytesToString"
Cohesion: 0.07
Nodes (30): bytesToString(), computeIDs(), createDataNode(), readBits(), escapePDFName(), FontRendererFactory, getFontFileType(), getIndexes() (+22 more)

### Community 151 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, build:dev, build:prod, build:staging, ng, prebuild, start (+3 more)

### Community 152 - "excel-to-pdf.component.ts"
Cohesion: 0.18
Nodes (7): ConvertedExcelToPdfResult, ExcelToPdfService, SUPPORTED_EXTENSIONS, ValidatedExcelFile, getSpreadsheetSheetNames(), SheetInfo, WorkspaceState

### Community 156 - "pdf-to-excel/index.ts"
Cohesion: 0.24
Nodes (14): BuildWorkbookResult, applyCoverageGuard(), computeCoverage(), CoverageResult, extractNormalisedWords(), extractWorkbookWords(), ConvertMultiplePdfsInput, ConvertMultiplePdfsResult (+6 more)

### Community 157 - "Datasets"
Cohesion: 0.20
Nodes (3): Datasets, datasets_Data, DatasetsNamespace

### Community 161 - "MathClamp"
Cohesion: 0.19
Nodes (4): ColorSpaceUtils, IndexedCS, MathClamp(), PatternCS

### Community 168 - "home.component.ts"
Cohesion: 0.16
Nodes (3): AnimationService, ExtendedFilterCategory, PtSectionHeaderComponent

### Community 169 - "Type1Font"
Cohesion: 0.19
Nodes (4): CFFCharset, CFFHeader, findBlock(), Type1Font

### Community 171 - "CFFDict"
Cohesion: 0.16
Nodes (3): CFFDict, CFFPrivateDict, CFFTopDict

### Community 172 - "range-parser.ts"
Cohesion: 0.32
Nodes (3): formatPageRange(), parsePageRange(), RangeParseResult

### Community 176 - "word-to-pdf.route.ts"
Cohesion: 0.18
Nodes (10): jobStore, PdfOutputFile, upload, WordToPdfJob, wordToPdfRouter, ConvertedPdfFileItem, WordToPdfImageQuality, WordToPdfJobResponse (+2 more)

### Community 177 - "SimpleDOMNode"
Cohesion: 0.17
Nodes (3): encodeToXmlString(), SimpleDOMNode, utf8StringToString()

### Community 180 - "pdf-text-extraction.service.ts"
Cohesion: 0.22
Nodes (5): TextLineBounds, GlyphItem, LineSegment, PdfTextExtractionService, TextBlock

### Community 182 - "pdf-export.service.ts"
Cohesion: 0.41
Nodes (9): BaseEditElement, DrawEditElement, HighlightEditElement, ImageEditElement, LinkEditElement, OcrTextLayerElement, ShapeEditElement, SignEditElement (+1 more)

### Community 183 - "canvas-limits.ts"
Cohesion: 0.48
Nodes (5): calculateSafeRenderDpi(), checkCombinedHeightLimit(), getMaxSafeCanvasArea(), isMobileOrRestrictedEnvironment(), SafeDpiResult

### Community 185 - "SignExportService"
Cohesion: 0.42
Nodes (3): SignExportService, buildSignedFilename(), SignExportOutcome

### Community 191 - "TemplateNamespace"
Cohesion: 0.02
Nodes (44): AppearanceFilter, Assist, BatchOutput, Bind, BindItems, Bookend, Calculate, Certificates (+36 more)

### Community 194 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, dev:prod, dev:staging, start, start:prod, start:staging (+1 more)

### Community 199 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir (+4 more)

### Community 200 - "edit-pdf-ocr.route.ts"
Cohesion: 0.12
Nodes (21): createPhotoBuffer(), createScannedPageImage(), createSlideBackgroundPng(), FIXTURES_DIR, generateFullFontPdf(), generatePhotoBrochurePdf(), generatePowerPointPngPdf(), generateScanned20PagePdf() (+13 more)

### Community 204 - "jfif-patcher.ts"
Cohesion: 0.53
Nodes (4): embedJpegDpi(), isValidJpeg(), JpegDpiInfo, readJpegDpi()

### Community 209 - "serve-prod.mjs"
Cohesion: 0.17
Nodes (6): __dirname, DIST_DIR, __filename, MIME_TYPES, PORT, server

### Community 210 - "PDFBase"
Cohesion: 0.36
Nodes (3): AES256Cipher, isArrayEqual(), PDFBase

### Community 213 - "XhtmlObject"
Cohesion: 0.07
Nodes (11): _a, Html, _i, Li, Ol, Span, Sub, Sup (+3 more)

### Community 214 - "serve"
Cohesion: 0.25
Nodes (8): serve, allowedHosts, host, proxyConfig, builder, configurations, defaultConfiguration, options

### Community 221 - "angular-cli"
Cohesion: 0.50
Nodes (3): cmd.exe, angular-cli, @angular/cli

### Community 222 - "build"
Cohesion: 0.29
Nodes (7): build, test, builder, configurations, defaultConfiguration, builder, architect

### Community 225 - "options"
Cohesion: 0.33
Nodes (6): options, allowedCommonJsDependencies, assets, browser, styles, tsConfig

### Community 226 - "web"
Cohesion: 0.33
Nodes (6): web, prefix, projectType, root, schematics, sourceRoot

### Community 229 - "sign.route.ts"
Cohesion: 0.05
Nodes (42): certUpload, csrfProtection(), parseCookies(), signCreateRateLimiter, signEmail, signOtpRateLimiter, signRepo, signScheduler (+34 more)

### Community 231 - "development"
Cohesion: 0.40
Nodes (5): development, buildTarget, extractLicenses, optimization, sourceMap

### Community 232 - "production"
Cohesion: 0.40
Nodes (5): production, budgets, buildTarget, fileReplacements, outputHashing

### Community 233 - "staging"
Cohesion: 0.40
Nodes (5): staging, budgets, buildTarget, fileReplacements, outputHashing

### Community 235 - "about-us.component.ts"
Cohesion: 0.22
Nodes (5): AboutUsComponent, ExecutionSpec, FaqItem, ToolCategoryGroup, ToolItem

## Knowledge Gaps
- **5 isolated node(s):** `cmd.exe`, `@angular/cli`, `RFC-5652`, `RFC-5987`, `RFC-5987`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1891 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **103 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ContentEditableModelDirective` connect `ContentEditableModelDirective` to `edit-pdf.component.ts`?**
  _High betweenness centrality (0.192) - this node is a cross-community bridge._
- **What connects `cmd.exe`, `@angular/cli`, `RFC-5652` to the rest of the system?**
  _5 weakly-connected nodes found - possible missing edges._
- **Should `pdf.worker.min.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.012344976675389691 - nodes in this community are weakly interconnected._
- **Why does `Output` connect `ContentEditableModelDirective` to `pdf.worker.min.mjs`, `XFAObject`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Should `XFAObjectArray` be split into smaller, more focused modules?**
  _Cohesion score 0.024096385542168676 - nodes in this community are weakly interconnected._
- **Why does `ConfigNamespace` connect `ConfigNamespace` to `pdf.worker.min.mjs`, `XFAObjectArray`, `StringObject`, `OptionObject`, `XFAObject`, `ContentEditableModelDirective`, `bytesToString`, `IntegerObject`, `ContentObject`, `getInteger`, `TemplateNamespace`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Should `StringObject` be split into smaller, more focused modules?**
  _Cohesion score 0.018489254108723135 - nodes in this community are weakly interconnected._