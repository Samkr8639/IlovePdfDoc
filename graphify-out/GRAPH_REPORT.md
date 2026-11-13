# Graph Report - PDF-Tool  (2026-11-12)

## Corpus Check
- 274 files · ~300,095 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 40 file(s) not represented in the graph (top: .css 30, (none) 7, .example 2)

## Summary
- 5388 nodes · 11465 edges · 250 communities (116 shown, 134 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 171 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dbb249ae`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- pdf.worker.min.mjs
- XFAObjectArray
- StringObject
- TemplateNamespace
- powerpoint-to-pdf.route.ts
- OptionObject
- shadow
- AppError
- LocaleSetNamespace
- contracts/src/index.ts
- .success
- XFAObject
- CoordinateTransformService
- @angular/router
- .checkAndRepair
- ConfigNamespace
- PartialEvaluator
- Option01
- JpegImage
- CalRGBCS
- RefSetCache
- src/app.ts
- tool-registry.service.ts
- XhtmlObject
- EditPdfComponent
- api/package.json
- pdf-to-powerpoint.component.ts
- Jbig2Error
- ContentObject
- getStringOption
- edit-pdf.component.ts
- ref_pdf_lib
- web
- ref_pdf_lib
- Dict
- @angular/core
- IccColorSpace
- Text
- Page
- powerpoint-to-pdf.component.ts
- .constructor
- powerpoint-to-pdf.route.ts
- PDFDocument
- Lexer
- app/app.ts
- .getTextContent
- CMap
- Annotation
- BrowserPdfService
- XRef
- edit-pdf-ocr.ts
- MarkupAnnotation
- ExpressionBuilderVisitor
- FontFinder
- ConnectionSetNamespace
- EditElement
- run-benchmark-comparison.ts
- compileGlyf
- contact-us.component.ts
- IntegerObject
- calculateSHA512
- Glyph
- excel-to-pdf.component.ts
- web/package.json
- RefSet
- JpgToPdfComponent
- unreachable
- FontInfo
- PdfToJpgComponent
- CFFCompiler
- document-model.ts
- JpgToPdfOptions
- Parser
- .createDocumentHandler
- parseCMap
- word-to-pdf.component.ts
- ExclGroup
- pdf-to-jpg.ts
- HeaderComponent
- pdf-to-excel.route.ts
- FormatError
- bytesToString
- ToolPlaceholderComponent
- engine.mjs
- PdfExportService
- pdf-to-powerpoint.route.ts
- .makeFilter
- Builder
- .constructPostScript
- Type1Parser
- HomeComponent
- Binder
- info
- Value
- CFFParser
- PdfToJpgService
- MergePdfComponent
- PdfToExcelComponent
- scripts
- ChunkedStream
- PDFWorkerStreamReader
- JpgToPdfService
- SelectionOverlayComponent
- PdfToPowerPointComponent
- BasePdfManager
- Commands
- ImageResizer
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
- area-selection.service.ts
- PostScriptStack
- compilerOptions
- typescript
- Area
- Type1Font
- CFFDict
- DecodeStream
- Stream
- OperatorList
- FooterComponent
- MeshStreamReader
- ConsentService
- PdfToWordComponent
- WordToPdfComponent
- ColorSpace
- SingleIntersector
- pdf-text-extraction.service.ts
- PowerPointToPdfComponent
- generate-ai-manifests.js
- PostScriptParser
- compilerOptions
- assert
- ContentEditableModelDirective
- IdentityCMap
- NullOptimizer
- pdf-to-jpg.service.ts
- SharedPdfjsService
- TextEditElement
- scripts
- TextState
- ViewportNavigationService
- UploadConsentDialogComponent
- XFAParser
- .#B
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
- Button
- Equate
- EvaluatorPreprocessor
- FlateStream
- range-parser.ts
- JpegSanitizer
- CookieSettingsComponent
- PostScriptLexer
- DeviceRgbCS
- Jbig2Stream
- JpxStream
- MetadataParser
- StructElementNode
- canvas-limits.ts
- PrivacyPolicyComponent
- createStreamingZip
- DeviceGrayCS
- DeviceRgbaCS
- DeviceCmykCS
- ImageEdit
- Linear
- PageArea
- Ui
- Template
- xdp_Xdp
- AlternateCS
- Margin
- Ref
- ExData
- PageSet
- signature_Signature
- Stylesheet
- Traverse
- PressMediaKitComponent
- pt-faq-accordion.component.ts
- custom-environment.js
- Assist
- Border
- Root
- Solid
- Fill
- Type1CharString
- Acrobat7
- Overflow
- Attributes
- Button
- Certificates
- Variables
- pt-step-list.component.ts
- angular-cli
- Compression
- Bind
- config_Validate
- EncryptionLevel
- Mode
- OpenAction
- Pagination
- ValidationMessaging
- Items
- NumericEdit
- Oids
- Script
- Signature
- SignData
- Pdfa
- Signing
- TimeStamp
- Validate
- DateTimeEdit
- pt-badge.component.ts
- DigestMethods
- Execute
- Hyphenation
- PasswordEdit
- Reasons
- environment.prod.ts
- environment.staging.ts

## God Nodes (most connected - your core abstractions)
1. `XFAObject` - 217 edges
2. `warn()` - 168 edges
3. `EditPdfComponent` - 149 edges
4. `ConfigNamespace` - 141 edges
5. `@angular/core` - 133 edges
6. `TemplateNamespace` - 115 edges
7. `shadow()` - 99 edges
8. `FormatError` - 88 edges
9. `getStringOption()` - 85 edges
10. `XFAObjectArray` - 66 edges

## Surprising Connections (you probably didn't know these)
- `WordOutputFileResult` --references--> `PdfToWordMode`  [EXTRACTED]
  apps/api/src/routes/pdf-to-word.route.ts → packages/contracts/src/pdf-to-word.ts
- `PdfToWordJob` --references--> `PdfToWordMode`  [EXTRACTED]
  apps/api/src/routes/pdf-to-word.route.ts → packages/contracts/src/pdf-to-word.ts
- `ConvertPdfToWordOptions` --references--> `PdfToWordMode`  [EXTRACTED]
  apps/api/src/services/pdf-to-word/index.ts → packages/contracts/src/pdf-to-word.ts
- `OcrJobItem` --references--> `EditPdfOcrResult`  [EXTRACTED]
  apps/api/src/routes/edit-pdf-ocr.route.ts → packages/contracts/src/edit-pdf-ocr.ts
- `BuildWorkbookOptions` --references--> `PdfToExcelOptions`  [EXTRACTED]
  apps/api/src/services/pdf-to-excel/build.ts → packages/contracts/src/pdf-to-excel.ts

## Import Cycles
- None detected.

## Communities (250 total, 134 thin omitted)

### Community 0 - "pdf.worker.min.mjs"
Cohesion: 0.01
Nodes (169): aa, ac, addChildren(), addHex(), ae, ai, an, Ao (+161 more)

### Community 1 - "XFAObjectArray"
Cohesion: 0.02
Nodes (26): Acrobat, Agent, Common, Config, config_FontInfo, ConnectionSet, Data, Desc (+18 more)

### Community 2 - "StringObject"
Cohesion: 0.03
Nodes (26): Amd, Base, Certificate, config_Picture, Creator, Enforce, ExcludeNS, GroupParent (+18 more)

### Community 3 - "TemplateNamespace"
Cohesion: 0.02
Nodes (29): AppearanceFilter, Arc, Barcode, BindItems, Bookend, Break, BreakAfter, BreakBefore (+21 more)

### Community 4 - "powerpoint-to-pdf.route.ts"
Cohesion: 0.04
Nodes (56): ExcelPdfOutputFile, ExcelToPdfJob, excelToPdfRouter, jobStore, upload, jobStore, PdfOutputFile, upload (+48 more)

### Community 5 - "OptionObject"
Cohesion: 0.02
Nodes (30): ADBE_JSConsole, ADBE_JSDebugger, AutoSave, Conformance, Destination, DigestMethod, DuplexOption, DynamicRender (+22 more)

### Community 6 - "shadow"
Cohesion: 0.05
Nodes (17): Catalog, appendIfJavaScriptDict(), parseNestedOrder(), parseOrder(), _collectJS(), createValidAbsoluteUrl(), FeatureTest, fetchDest() (+9 more)

### Community 7 - "AppError"
Cohesion: 0.08
Nodes (27): AppError, buildDocxFromPages(), ExtractedPageContent, extractPdfPageContents(), jobStore, PdfToWordJob, pdfToWordRouter, upload (+19 more)

### Community 8 - "LocaleSetNamespace"
Cohesion: 0.03
Nodes (25): CalendarSymbols, CurrencySymbol, CurrencySymbols, DatePattern, DatePatterns, DateTimeSymbols, Day, DayNames (+17 more)

### Community 9 - "contracts/src/index.ts"
Cohesion: 0.08
Nodes (54): extractPdfWithOcr(), analyzePdf(), getScanner(), LayoutBox, LayoutImage, LayoutLine, LayoutPage, LayoutSegment (+46 more)

### Community 10 - ".success"
Cohesion: 0.07
Nodes (35): applyAssist(), ariaLabel(), CheckButton, checkDimensions(), ChoiceList, computeBbox(), Corner, createWrapper() (+27 more)

### Community 11 - "XFAObject"
Cohesion: 0.02
Nodes (14): BatchOutput, Compress, config_Area, ContentArea, Keep, LabelPrinter, Mdp, PageOffset (+6 more)

### Community 12 - "CoordinateTransformService"
Cohesion: 0.11
Nodes (8): DrawPoint, CanvasInteractionService, CoordinateTransformService, PdfPoint, PdfRect, ScreenPoint, ScreenRect, FreehandDrawingService

### Community 13 - "@angular/router"
Cohesion: 0.04
Nodes (35): routes, CookieConsentPreferences, DEFAULT_PREFERENCES, STORAGE_CONSENT_KEY, SeoService, LoadPdfOptions, PdfPasswordError, AboutUsComponent (+27 more)

### Community 14 - ".checkAndRepair"
Cohesion: 0.04
Nodes (43): adjustWidths(), amendFallbackToUnicode(), applyStandardFontGlyphMap(), buildToFontChar(), CFFFont, convertCidString(), createCmapTable(), createNameTable() (+35 more)

### Community 15 - "ConfigNamespace"
Cohesion: 0.03
Nodes (23): Cache, config_Encryption, config_Message, config_Script, config_Template, ConfigNamespace, Debug, Driver (+15 more)

### Community 16 - "PartialEvaluator"
Cohesion: 0.05
Nodes (15): addCachedImageOps(), CMapFactory, ErrorFont, EvalState, fetchBinaryData(), getTilingPatternIR(), getXfaFontDict(), getXfaFontName() (+7 more)

### Community 17 - "Option01"
Cohesion: 0.03
Nodes (20): AddSilentPrint, AddViewerPreferences, Change, CompressLogicalStructure, config_Encrypt, ContentCopy, DocumentAssembly, Embed (+12 more)

### Community 18 - "JpegImage"
Cohesion: 0.07
Nodes (28): adjustMapping(), buildComponentData(), buildHuffmanTable(), decodeScan(), decodeBlock(), decodeHuffman(), decodeMcu(), readBit() (+20 more)

### Community 20 - "RefSetCache"
Cohesion: 0.04
Nodes (14): AppearanceStreamEvaluator, BaseLocalCache, GlobalColorSpaceCache, GlobalImageCache, Intersector, LocalColorSpaceCache, LocalFunctionCache, LocalGStateCache (+6 more)

### Community 21 - "src/app.ts"
Cohesion: 0.07
Nodes (20): createApp(), env, envFile, envSchema, openApiSpec, app, errorHandler(), apiRateLimiter (+12 more)

### Community 22 - "tool-registry.service.ts"
Cohesion: 0.10
Nodes (12): LIVE_TOOL_IDS, ToolRegistryService, WebMcpService, WebMcpTool, WebMcpToolSchema, LIVE_TOOL_IDS, ProcessingMode, TOOL_REGISTRY (+4 more)

### Community 23 - "XhtmlObject"
Cohesion: 0.05
Nodes (19): _a, B, Br, Html, _i, Li, Ma(), doRun() (+11 more)

### Community 25 - "api/package.json"
Cohesion: 0.03
Nodes (79): dependencies, cors@^2.8.5, docx@^9.14.0, dotenv@^16.4.7, exceljs@^4.4.0, express@^4.21.2, express-rate-limit@^8.7.1, fast-xml-parser@^5.11.2 (+71 more)

### Community 26 - "pdf-to-powerpoint.component.ts"
Cohesion: 0.08
Nodes (13): ValidatedPdfFile, PdfToExcelService, PdfToPowerPointService, ConvertedWordResult, PdfToWordService, WorkspaceState, FileListComponent, environment (+5 more)

### Community 27 - "Jbig2Error"
Cohesion: 0.08
Nodes (19): ArithmeticDecoder, ContextCache, decodeBitmap(), decodeIAID(), decodeInteger(), decodeMMRBitmap(), decodeRefinement(), decodeTextRegion() (+11 more)

### Community 28 - "ContentObject"
Cohesion: 0.04
Nodes (13): AlwaysEmbed, BehaviorOverride, ContentObject, DefaultTypeface, Exclude, NeverEmbed, Range, Record (+5 more)

### Community 29 - "getStringOption"
Cohesion: 0.10
Nodes (8): getFloat(), getInteger(), getKeyword(), getMeasurement(), getRatio(), getRelevant(), getStringOption(), LockDocument

### Community 30 - "edit-pdf.component.ts"
Cohesion: 0.06
Nodes (19): EditPdfHeroComponent, EditPdfTopNavComponent, DrawPanelComponent, ElementInfoPanelComponent, HighlightPanelComponent, ImagePanelComponent, LinkPanelComponent, SelectionPanelComponent (+11 more)

### Community 31 - "ref_pdf_lib"
Cohesion: 0.15
Nodes (5): ServerActionGuard, UploadConsentOptions, UploadConsentService, UploadConsentState, OcrProgressUpdate

### Community 32 - "web"
Cohesion: 0.05
Nodes (45): build, serve, test, builder, configurations, defaultConfiguration, options, cli (+37 more)

### Community 33 - "ref_pdf_lib"
Cohesion: 0.07
Nodes (46): analyzePdfSize(), CategorySummary, ContentStreamDetail, extractImagePlacementsFromPdfjs(), FontDetail, formatBytes(), ImageDetail, isBinaryAvailable() (+38 more)

### Community 34 - "Dict"
Cohesion: 0.04
Nodes (19): codePointIter(), DefaultAppearanceEvaluator, Dict, escapeString(), FakeUnicodeFont, FreeTextAnnotation, getModificationDate(), getPdfColor() (+11 more)

### Community 35 - "@angular/core"
Cohesion: 0.07
Nodes (21): CompressedPdfItem, CompressPdfResult, MergeResult, SplitPdfOutputFile, SplitPdfResult, LayoutService, WorkspaceState, WorkspaceState (+13 more)

### Community 36 - "IccColorSpace"
Cohesion: 0.19
Nodes (6): getUint8ArrayMemory0(), IccColorSpace, passArray8ToWasm0(), __wbg_finalize_init(), __wbg_get_imports(), __wbg_init()

### Community 37 - "Text"
Cohesion: 0.05
Nodes (9): BooleanElement, DateElement, DateTime, Decimal, Float, Integer, Text, Time (+1 more)

### Community 38 - "Page"
Cohesion: 0.06
Nodes (9): AnnotationFactory, addPageError(), clearGlobalCaches(), isRefsEqual(), JpxError, JpxImage, ObjectLoader, Page (+1 more)

### Community 39 - "powerpoint-to-pdf.component.ts"
Cohesion: 0.12
Nodes (20): DeckInfo, getDeckInfo(), revokeDeckThumbnail(), ConvertedPowerPointToPdfResult, PowerPointToPdfService, SUPPORTED_EXTENSIONS, ValidatedPowerPointFile, WorkspaceState (+12 more)

### Community 40 - ".constructor"
Cohesion: 0.08
Nodes (10): AES128Cipher, AES256Cipher, AESBaseCipher, ARCFourCipher, calculateMD5(), CipherTransformFactory, isArrayEqual(), NullCipher (+2 more)

### Community 41 - "powerpoint-to-pdf.route.ts"
Cohesion: 0.07
Nodes (30): jobStore, MAX_FILES, PowerPointPdfOutputFile, PowerPointToPdfJob, powerpointToPdfRouter, upload, convertPowerPointToPdf(), mergePowerPointPdfOutputs() (+22 more)

### Community 42 - "PDFDocument"
Cohesion: 0.08
Nodes (6): DatasetReader, decodeString(), find(), PDFDocument, stringToUTF8String(), toHexUtil()

### Community 43 - "Lexer"
Cohesion: 0.20
Nodes (4): Cmd, Lexer, Linearization, toHexDigit()

### Community 44 - "app/app.ts"
Cohesion: 0.06
Nodes (13): @ngx-translate/core@^18.1.0, App, appConfig, DEFAULT_EN_TRANSLATIONS, AnimationService, SUPPORTED_LANGUAGES, SupportedLanguage, TranslationService (+5 more)

### Community 45 - ".getTextContent"
Cohesion: 0.22
Nodes (15): addFakeSpaces(), appendEOL(), applyInverseRotation(), buildTextContentItem(), compareWithLastPosition(), ensureTextContentItem(), flushTextContentItem(), getCurrentTextTransform() (+7 more)

### Community 47 - "Annotation"
Cohesion: 0.06
Nodes (8): Annotation, AnnotationBorderStyle, Body, getRgbColor(), getTransformMatrix(), lookupNormalRect(), lookupRect(), PopupAnnotation

### Community 48 - "BrowserPdfService"
Cohesion: 0.15
Nodes (5): BrowserPdfService, SplitPdfOptions, PageRange, SplitRangeParser, SplitRangeParseResult

### Community 49 - "XRef"
Cohesion: 0.11
Nodes (5): InvalidPDFException, isCmd(), XRef, XRefEntryException, XRefParseException

### Community 50 - "edit-pdf-ocr.ts"
Cohesion: 0.05
Nodes (40): editPdfOcrRouter, JOB_RETENTION_MS, OCR_MAX_FILE_SIZE, OCR_MAX_PAGES, OcrJobItem, ocrJobStore, upload, validateOcrPdf() (+32 more)

### Community 51 - "MarkupAnnotation"
Cohesion: 0.06
Nodes (20): CaretAnnotation, CircleAnnotation, FileAttachmentAnnotation, getPdfColorArray(), getQuadPoints(), HighlightAnnotation, isNumberArray(), LineAnnotation (+12 more)

### Community 52 - "ExpressionBuilderVisitor"
Cohesion: 0.08
Nodes (12): AstArgument, AstBinaryOperation, AstLiteral, AstMin, AstNode, AstVariable, AstVariableDefinition, buildAddOperation() (+4 more)

### Community 54 - "ConnectionSetNamespace"
Cohesion: 0.06
Nodes (12): connection_set_Uri, ConnectionSetNamespace, EffectiveInputPolicy, EffectiveOutputPolicy, Operation, RootElement, SoapAction, SoapAddress (+4 more)

### Community 55 - "EditElement"
Cohesion: 0.10
Nodes (5): AreaSelectionState, EditElement, PageDimensions, AreaSelectionService, ElementOperationsService

### Community 56 - "run-benchmark-comparison.ts"
Cohesion: 0.21
Nodes (10): AfterResult, AUDIT_TMP_DIR, BEFORE_DATA, DOCS_DIR, Fixture, FIXTURES, FIXTURES_DIR, formatBytes() (+2 more)

### Community 57 - "compileGlyf"
Cohesion: 0.06
Nodes (24): parseOperand(), compileCharString(), CompiledFont, compileGlyf(), createDataNode(), readBits(), FontRendererFactory, getFloat214() (+16 more)

### Community 58 - "contact-us.component.ts"
Cohesion: 0.21
Nodes (10): ContactService, ContactFormData, ApiErrorDetail, ApiResponse, ContactSubmissionPayload, ContactSubmissionResult, HealthCheckData, ProcessingStage (+2 more)

### Community 59 - "IntegerObject"
Cohesion: 0.05
Nodes (13): AdjustData, AdobeExtensionLevel, CompressObjectStream, Copies, CurrentPage, IntegerObject, Level, MsgId (+5 more)

### Community 60 - "calculateSHA512"
Cohesion: 0.08
Nodes (19): calculate_sha256_ch(), calculate_sha256_littleSigma(), calculate_sha256_littleSigmaPrime(), calculate_sha256_maj(), calculate_sha256_sigma(), calculate_sha256_sigmaPrime(), calculateSHA256(), calculateSHA384() (+11 more)

### Community 61 - "Glyph"
Cohesion: 0.07
Nodes (6): CompositeGlyph, Contour, GlyfTable, Glyph, GlyphHeader, SimpleGlyph

### Community 62 - "excel-to-pdf.component.ts"
Cohesion: 0.10
Nodes (23): ConvertedExcelToPdfResult, ExcelToPdfService, SUPPORTED_EXTENSIONS, ValidatedExcelFile, getSpreadsheetSheetNames(), SheetInfo, WorkspaceState, ConvertedExcelFileItem (+15 more)

### Community 63 - "web/package.json"
Cohesion: 0.05
Nodes (55): dependencies, @angular/cdk@^22.2.4, @angular/common@^22.2.0, @angular/compiler@^22.2.0, @angular/core@^22.2.0, @angular/forms@^22.2.0, @angular/material@^22.2.4, @angular/platform-browser@^22.2.0 (+47 more)

### Community 64 - "RefSet"
Cohesion: 0.11
Nodes (6): ButtonWidgetAnnotation, ChoiceWidgetAnnotation, collectActions(), getInheritableProperty(), objectSize(), RefSet

### Community 65 - "JpgToPdfComponent"
Cohesion: 0.07
Nodes (6): ImageAlignmentOption, ImageFitOption, ImageQualityOption, MarginOption, PageOrientationOption, JpgToPdfComponent

### Community 66 - "unreachable"
Cohesion: 0.12
Nodes (3): BaseStream, Pattern, unreachable()

### Community 68 - "PdfToJpgComponent"
Cohesion: 0.13
Nodes (3): PdfToJpgComponent, PdfToJpgDpiPreset, PdfToJpgQualityPreset

### Community 70 - "document-model.ts"
Cohesion: 0.35
Nodes (12): BaseEditElement, DrawEditElement, ElementType, HighlightEditElement, ImageEditElement, LinkEditElement, OcrLineItem, OcrTextLayerElement (+4 more)

### Community 71 - "JpgToPdfOptions"
Cohesion: 0.17
Nodes (11): JpgToPdfImageItem, JpgToPdfOptions, JpgToPdfWarning, MeasurementUnit, PageSizeOption, SupportedImageFormat, INCH_TO_PT, MAX_PDF_PAGE_DIM_PT (+3 more)

### Community 73 - ".createDocumentHandler"
Cohesion: 0.17
Nodes (12): AbortException, getNewAnnotationsMap(), getVerbosityLevel(), ensureNotTerminated(), finishWorkerTask(), loadDocument(), setupDoc(), onFailure() (+4 more)

### Community 74 - "parseCMap"
Cohesion: 0.27
Nodes (13): createBuiltInCMap(), expectInt(), expectString(), extendCMap(), parseBfChar(), parseBfRange(), parseCidChar(), parseCidRange() (+5 more)

### Community 75 - "word-to-pdf.component.ts"
Cohesion: 0.19
Nodes (10): ConvertedWordToPdfResult, SUPPORTED_EXTENSIONS, ValidatedWordFile, WordToPdfService, WorkspaceState, ConvertedPdfFileItem, WordToPdfImageQuality, WordToPdfJobResponse (+2 more)

### Community 76 - "ExclGroup"
Cohesion: 0.10
Nodes (6): addHTML(), createLine(), ExclGroup, flushHTML(), getAvailableSpace(), Subform

### Community 77 - "pdf-to-jpg.ts"
Cohesion: 0.22
Nodes (8): ConvertedPageItem, ConvertPagesOptions, ConvertPagesOptionsSchema, ExtractedImageItem, ExtractImagesOptions, ExtractImagesOptionsSchema, PdfToJpgMode, PdfToJpgOptionsSchema

### Community 79 - "pdf-to-excel.route.ts"
Cohesion: 0.13
Nodes (14): excelJobStore, ExcelOutputFileResult, MAX_PDF_PAGES, PdfToExcelJob, pdfToExcelRouter, RFC-5987, upload, validatePdfInput() (+6 more)

### Community 80 - "FormatError"
Cohesion: 0.16
Nodes (6): BaseShading, DummyShading, FormatError, getB(), MeshShading, RadialAxialShading

### Community 81 - "bytesToString"
Cohesion: 0.14
Nodes (17): bytesToString(), CipherTransform, computeIDs(), escapePDFName(), getFontFileType(), getIndexes(), getSizeInBytes(), incrementalUpdate() (+9 more)

### Community 83 - "engine.mjs"
Cohesion: 0.19
Nodes (15): analyzePdf(), apply(), cleanFontName(), det(), mul(), parseColor(), sanitizePdfText(), buildDocx() (+7 more)

### Community 85 - "pdf-to-powerpoint.route.ts"
Cohesion: 0.06
Nodes (38): requirePremiumForOcr(), MAX_PDF_PAGES, PdfToPowerPointJob, pdfToPowerPointRouter, PowerPointOutputFileResult, pptxJobStore, RFC-5987, upload (+30 more)

### Community 86 - ".makeFilter"
Cohesion: 0.11
Nodes (6): Ascii85Stream, AsciiHexStream, CCITTFaxStream, LZWStream, PredictorStream, RunLengthStream

### Community 87 - "Builder"
Cohesion: 0.19
Nodes (3): Builder, Empty, UnknownNamespace

### Community 88 - ".constructPostScript"
Cohesion: 0.28
Nodes (3): PDFFunction, PostScriptCompiler, toNumberArray()

### Community 89 - "Type1Parser"
Cohesion: 0.30
Nodes (4): decrypt(), isHexDigit(), isSpecial(), Type1Parser

### Community 91 - "Binder"
Cohesion: 0.26
Nodes (3): Binder, createText(), searchNode()

### Community 93 - "Value"
Cohesion: 0.10
Nodes (6): Caption, Draw, Field, Image, _setValue(), Value

### Community 94 - "CFFParser"
Cohesion: 0.18
Nodes (3): CFFEncoding, CFFFDSelect, CFFParser

### Community 95 - "PdfToJpgService"
Cohesion: 0.24
Nodes (7): embedJpegDpi(), isValidJpeg(), JpegDpiInfo, readJpegDpi(), PdfToJpgService, PdfToJpgConversionResult, PdfToJpgOptions

### Community 98 - "scripts"
Cohesion: 0.06
Nodes (33): author, description, devDependencies, cross-env@^10.1.0, typescript@^5.9.3, vite@^6.4.5, typescript, vite (+25 more)

### Community 99 - "ChunkedStream"
Cohesion: 0.08
Nodes (5): arrayBuffersToBytes(), ChunkedStream, ChunkedStreamManager, MissingDataException, NetworkPdfManager

### Community 100 - "PDFWorkerStreamReader"
Cohesion: 0.12
Nodes (3): PDFWorkerStream, PDFWorkerStreamRangeReader, PDFWorkerStreamReader

### Community 101 - "JpgToPdfService"
Cohesion: 0.26
Nodes (4): ComputedPageLayout, JpgToPdfBuildResult, JpgToPdfProgress, JpgToPdfService

### Community 107 - "ImageResizer"
Cohesion: 0.13
Nodes (5): convertBlackAndWhiteToRGBA(), convertToRGBA(), ImageResizer, PDFImage, resizeImageMask()

### Community 108 - "StructTreePage"
Cohesion: 0.16
Nodes (4): NameOrNumberTree, NumberTree, StructTreePage, nodeToSerializable()

### Community 112 - "typing.ts"
Cohesion: 0.27
Nodes (13): CellType, cleanString(), CURRENCY_SYMBOLS, DateConvention, inferColumnDateConvention(), inferColumnSeparator(), MONTH_NAMES, mustStayText() (+5 more)

### Community 114 - "SimpleXMLParser"
Cohesion: 0.10
Nodes (6): DatasetXMLParser, encodeToXmlString(), parseXFAPath(), SimpleDOMNode, SimpleXMLParser, updateXFA()

### Community 115 - "TextMeasure"
Cohesion: 0.19
Nodes (3): FontSelector, text_FontInfo, TextMeasure

### Community 116 - "MessageHandler"
Cohesion: 0.18
Nodes (4): fetchSync(), MessageHandler, WorkerMessageHandler, wrapReason()

### Community 119 - "area-selection.service.ts"
Cohesion: 0.20
Nodes (4): AreaDragMoveState, MarqueeDragState, Command, CommandHistoryService

### Community 121 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+6 more)

### Community 122 - "typescript"
Cohesion: 0.18
Nodes (11): devDependencies, typescript@^5.7.0, typescript, main, name, private, scripts, build (+3 more)

### Community 123 - "Area"
Cohesion: 0.14
Nodes (3): Area, getContainedChildren(), SubformSet

### Community 124 - "Type1Font"
Cohesion: 0.10
Nodes (6): CFF, CFFCharset, CFFHeader, CFFStrings, findBlock(), Type1Font

### Community 125 - "CFFDict"
Cohesion: 0.16
Nodes (3): CFFDict, CFFPrivateDict, CFFTopDict

### Community 126 - "DecodeStream"
Cohesion: 0.13
Nodes (3): DecodeStream, DecryptStream, StreamsSequenceStream

### Community 127 - "Stream"
Cohesion: 0.12
Nodes (3): LocalPdfManager, NullStream, Stream

### Community 128 - "OperatorList"
Cohesion: 0.07
Nodes (3): CmykICCBasedCS, JpegStream, OperatorList

### Community 137 - "pdf-text-extraction.service.ts"
Cohesion: 0.22
Nodes (5): TextLineBounds, GlyphItem, LineSegment, PdfTextExtractionService, TextBlock

### Community 139 - "generate-ai-manifests.js"
Cohesion: 0.11
Nodes (19): createPhotoBuffer(), createScannedPageImage(), createSlideBackgroundPng(), FIXTURES_DIR, generateFullFontPdf(), generatePhotoBrochurePdf(), generatePowerPointPngPdf(), generateScanned20PagePdf() (+11 more)

### Community 141 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+3 more)

### Community 142 - "assert"
Cohesion: 0.26
Nodes (3): assert(), CssFontInfo, toRomanNumerals()

### Community 146 - "pdf-to-jpg.service.ts"
Cohesion: 0.39
Nodes (7): buildCombinedFilename(), buildExtractedImageFilename(), buildPageFilename(), buildZipFilename(), sanitizeBaseName(), computeImageHash(), ConversionProgress

### Community 150 - "TextEditElement"
Cohesion: 0.19
Nodes (3): TextEditElement, PdfRenderingService, TextFormattingService

### Community 151 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, build:dev, build:prod, build:staging, ng, prebuild, start (+3 more)

### Community 157 - "Datasets"
Cohesion: 0.20
Nodes (3): Datasets, datasets_Data, DatasetsNamespace

### Community 168 - "Button"
Cohesion: 0.40
Nodes (3): A, fixURL(), recoverJsURL()

### Community 172 - "range-parser.ts"
Cohesion: 0.47
Nodes (3): formatPageRange(), parsePageRange(), RangeParseResult

### Community 183 - "canvas-limits.ts"
Cohesion: 0.48
Nodes (5): calculateSafeRenderDpi(), checkCombinedHeightLimit(), getMaxSafeCanvasArea(), isMobileOrRestrictedEnvironment(), SafeDpiResult

### Community 185 - "createStreamingZip"
Cohesion: 0.36
Nodes (4): fflate@^0.8.3, createStreamingZip(), ZipEntryInput, fflate

### Community 221 - "angular-cli"
Cohesion: 0.50
Nodes (3): cmd.exe, angular-cli, @angular/cli

## Knowledge Gaps
- **4 isolated node(s):** `cmd.exe`, `@angular/cli`, `RFC-5987`, `RFC-5987`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1674 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **134 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ContentEditableModelDirective` connect `ContentEditableModelDirective` to `edit-pdf.component.ts`?**
  _High betweenness centrality (0.270) - this node is a cross-community bridge._
- **What connects `cmd.exe`, `@angular/cli`, `RFC-5987` to the rest of the system?**
  _4 weakly-connected nodes found - possible missing edges._
- **Should `pdf.worker.min.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.012597402597402597 - nodes in this community are weakly interconnected._
- **Why does `Output` connect `ContentEditableModelDirective` to `pdf.worker.min.mjs`, `XFAObject`?**
  _High betweenness centrality (0.270) - this node is a cross-community bridge._
- **Should `XFAObjectArray` be split into smaller, more focused modules?**
  _Cohesion score 0.023809523809523808 - nodes in this community are weakly interconnected._
- **Why does `ConfigNamespace` connect `ConfigNamespace` to `pdf.worker.min.mjs`, `XFAObjectArray`, `StringObject`, `OptionObject`, `XFAObject`, `ContentEditableModelDirective`, `Option01`, `ContentObject`, `Equate`, `IntegerObject`, `Acrobat7`, `Attributes`, `Compression`, `config_Validate`, `EncryptionLevel`, `Mode`, `OpenAction`, `Pagination`, `ValidationMessaging`, `Pdfa`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Should `StringObject` be split into smaller, more focused modules?**
  _Cohesion score 0.02564102564102564 - nodes in this community are weakly interconnected._