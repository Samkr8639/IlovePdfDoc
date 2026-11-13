# Graph Report - PDF-Tool  (2026-11-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 5382 nodes · 11465 edges · 254 communities (120 shown, 134 thin omitted)
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
- PageDimensions
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
- @angular/core
- web
- ref_pdf_lib
- Dict
- browser-pdf.service.ts
- warn
- Text
- Page
- powerpoint-to-pdf.component.ts
- .constructor
- WidgetAnnotation
- PDFDocument
- Parser
- app/app.ts
- .getTextContent
- CMap
- Annotation
- excel-to-pdf.route.ts
- XRef
- edit-pdf-ocr.ts
- MarkupAnnotation
- ExpressionBuilderVisitor
- getMeasurement
- ConnectionSetNamespace
- EditElement
- pdf-size-report.ts
- compileGlyf
- edit-pdf-ocr.route.ts
- IntegerObject
- calculateSHA512
- Glyph
- excel-to-pdf.component.ts
- dependencies
- RefSet
- JpgToPdfComponent
- unreachable
- FontInfo
- PdfToJpgComponent
- CFFCompiler
- Util
- JpgToPdfOptions
- web/package.json
- .createDocumentHandler
- jpg-to-pdf.component.ts
- word-to-pdf.component.ts
- ExclGroup
- pdf-to-jpg.component.ts
- HeaderComponent
- pdf-to-excel.component.ts
- FormatError
- bytesToString
- ToolPlaceholderComponent
- engine.mjs
- PdfExportService
- pdf-to-powerpoint/build.ts
- .makeFilter
- Builder
- compileCharString
- Type1Parser
- .get
- Binder
- info
- Value
- CFFParser
- PdfToJpgService
- MergePdfComponent
- PdfToExcelComponent
- scripts
- ChunkedStreamManager
- PDFWorkerStreamReader
- JpgToPdfService
- SelectionOverlayComponent
- PdfToPowerPointComponent
- BasePdfManager
- ChunkedStream
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
- package.json
- compilerOptions
- typescript
- Area
- Type1Font
- CFFDict
- DecodeStream
- Stream
- OperatorList
- StructTreeRoot
- PDFImage
- ConsentService
- PdfToWordComponent
- WordToPdfComponent
- ColorSpace
- SingleIntersector
- pdf-text-extraction.service.ts
- PowerPointToPdfComponent
- generate-ai-manifests.js
- generate-fixtures.ts
- compilerOptions
- assert
- ContentEditableModelDirective
- IdentityCMap
- NullOptimizer
- pdf-to-jpg.service.ts
- pdf-to-jpg.component.spec.ts
- TextEditElement
- scripts
- SimpleDOMNode
- ViewportNavigationService
- UploadConsentDialogComponent
- XFAParser
- CFFStrings
- Datasets
- SystemFontInfo
- LabCS
- XFAAttribute
- scripts
- BinaryCMapStream
- NetworkPdfManager
- Color
- ContactUsComponent
- Button
- Option10
- .setBorderStyle
- FlateStream
- IdentityToUnicodeMap
- JpegSanitizer
- CookieSettingsComponent
- DropzoneComponent
- CFFFont
- DeviceRgbCS
- Jbig2Stream
- JpxStream
- MetadataParser
- StructElementNode
- canvas-limits.ts
- PrivacyPolicyComponent
- createStreamingZip
- CFFIndex
- DeviceGrayCS
- DeviceRgbaCS
- DeviceCmykCS
- HTMLResult
- LocalPdfManager
- PageArea
- Ui
- Template
- xdp_Xdp
- AlternateCS
- ErrorFont
- EvalState
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
- EquateRange
- Packets
- Fill
- LZWStream
- Occur
- Overflow
- Radial
- StreamsSequenceStream
- template_Pattern
- Variables
- pt-step-list.component.ts
- angular-cli
- pdf-lib
- Bind
- BreakBefore
- CFFFDSelect
- Comb
- config_Encryption
- Driver
- DynamicRender
- FlipLabel
- IfEmpty
- IncrementalLoad
- MediumInfo
- OutputXSL
- PaginationOverride
- Pdfa
- PrintScaling
- WebClient
- Connect
- DateTimeEdit
- Desc
- DigestMethods
- Event
- Execute
- Hyphenation
- KeyUsage
- Manifest
- PasswordEdit
- Reasons
- WorkerMessageHandler
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
- `PdfToWordJob` --references--> `PdfToWordMode`  [EXTRACTED]
  apps/api/src/routes/pdf-to-word.route.ts → packages/contracts/src/pdf-to-word.ts
- `WordOutputFileResult` --references--> `PdfToWordMode`  [EXTRACTED]
  apps/api/src/routes/pdf-to-word.route.ts → packages/contracts/src/pdf-to-word.ts
- `ConvertPdfToWordOptions` --references--> `PdfToWordMode`  [EXTRACTED]
  apps/api/src/services/pdf-to-word/index.ts → packages/contracts/src/pdf-to-word.ts
- `BuildPptxOptions` --references--> `PdfToPowerPointMode`  [EXTRACTED]
  apps/api/src/services/pdf-to-powerpoint/build.ts → packages/contracts/src/pdf-to-powerpoint.ts
- `BuildPptxOptions` --references--> `PdfToPowerPointSlideSize`  [EXTRACTED]
  apps/api/src/services/pdf-to-powerpoint/build.ts → packages/contracts/src/pdf-to-powerpoint.ts

## Import Cycles
- None detected.

## Communities (254 total, 134 thin omitted)

### Community 0 - "pdf.worker.min.mjs"
Cohesion: 0.01
Nodes (166): aa, ac, ae, ai, an, Ao, ar, as (+158 more)

### Community 1 - "XFAObjectArray"
Cohesion: 0.02
Nodes (26): Acrobat, Agent, Common, Config, config_FontInfo, ConnectionSet, Data, Encodings (+18 more)

### Community 2 - "StringObject"
Cohesion: 0.02
Nodes (28): Amd, AppearanceFilter, Base, Certificate, config_Picture, Creator, Enforce, ExcludeNS (+20 more)

### Community 3 - "TemplateNamespace"
Cohesion: 0.02
Nodes (27): Barcode, BindItems, Bookend, Break, Calculate, Certificates, DefaultUi, DigestMethod (+19 more)

### Community 4 - "powerpoint-to-pdf.route.ts"
Cohesion: 0.04
Nodes (54): jobStore, MAX_FILES, PowerPointPdfOutputFile, PowerPointToPdfJob, powerpointToPdfRouter, upload, jobStore, PdfOutputFile (+46 more)

### Community 5 - "OptionObject"
Cohesion: 0.03
Nodes (27): ADBE_JSConsole, ADBE_JSDebugger, Attributes, AutoSave, config_Validate, Conformance, Destination, DuplexOption (+19 more)

### Community 6 - "shadow"
Cohesion: 0.05
Nodes (16): Catalog, appendIfJavaScriptDict(), parseNestedOrder(), parseOrder(), createValidAbsoluteUrl(), FeatureTest, fetchDest(), fetchRemoteDest() (+8 more)

### Community 7 - "AppError"
Cohesion: 0.04
Nodes (50): multer@^2.5.0, tesseract.js@^7.0.0, zod@^4.6.7, AppError, requirePremiumForOcr(), contactRouter, contactSchema, excelJobStore (+42 more)

### Community 8 - "LocaleSetNamespace"
Cohesion: 0.03
Nodes (25): CalendarSymbols, CurrencySymbol, CurrencySymbols, DatePattern, DatePatterns, DateTimeSymbols, Day, DayNames (+17 more)

### Community 9 - "contracts/src/index.ts"
Cohesion: 0.08
Nodes (54): extractPdfWithOcr(), analyzePdf(), getScanner(), LayoutBox, LayoutImage, LayoutLine, LayoutPage, LayoutSegment (+46 more)

### Community 10 - ".success"
Cohesion: 0.06
Nodes (35): applyAssist(), Arc, ariaLabel(), checkDimensions(), ChoiceList, computeBbox(), createWrapper(), Edge (+27 more)

### Community 11 - "XFAObject"
Cohesion: 0.03
Nodes (9): BatchOutput, BreakAfter, Compress, LabelPrinter, ps, Signature, TemplateCache, ui (+1 more)

### Community 12 - "PageDimensions"
Cohesion: 0.08
Nodes (22): BaseEditElement, DrawEditElement, DrawPoint, ElementType, HighlightEditElement, ImageEditElement, LinkEditElement, OcrLineItem (+14 more)

### Community 13 - "@angular/router"
Cohesion: 0.05
Nodes (33): routes, ContactService, SeoService, AboutUsComponent, ExecutionSpec, FaqItem, ToolCategoryGroup, ToolItem (+25 more)

### Community 14 - ".checkAndRepair"
Cohesion: 0.05
Nodes (37): adjustWidths(), amendFallbackToUnicode(), applyStandardFontGlyphMap(), buildToFontChar(), convertCidString(), createCmapTable(), createNameTable(), createOS2Table() (+29 more)

### Community 15 - "ConfigNamespace"
Cohesion: 0.03
Nodes (20): Acrobat7, Cache, Compression, config_Message, config_Script, config_Template, ConfigNamespace, Debug (+12 more)

### Community 16 - "PartialEvaluator"
Cohesion: 0.07
Nodes (15): addCachedImageOps(), fetchBinaryData(), getEncoding(), getTilingPatternIR(), getXfaFontDict(), getXfaFontName(), isNumberArray(), isPDFFunction() (+7 more)

### Community 17 - "Option01"
Cohesion: 0.03
Nodes (20): AddSilentPrint, AddViewerPreferences, Change, CompressLogicalStructure, config_Encrypt, ContentCopy, DocumentAssembly, Embed (+12 more)

### Community 18 - "JpegImage"
Cohesion: 0.06
Nodes (25): adjustMapping(), buildComponentData(), buildHuffmanTable(), decodeScan(), decodeBlock(), decodeHuffman(), decodeMcu(), readBit() (+17 more)

### Community 19 - "CalRGBCS"
Cohesion: 0.06
Nodes (10): CalRGBCS, IndexedCS, MathClamp(), PDFFunction, PostScriptCompiler, PostScriptEvaluator, PostScriptLexer, PostScriptParser (+2 more)

### Community 20 - "RefSetCache"
Cohesion: 0.06
Nodes (13): AppearanceStreamEvaluator, BaseLocalCache, GlobalColorSpaceCache, GlobalImageCache, isDict(), LocalColorSpaceCache, LocalFunctionCache, LocalGStateCache (+5 more)

### Community 21 - "src/app.ts"
Cohesion: 0.07
Nodes (25): dotenv@^16.4.7, express-rate-limit@^8.7.1, createApp(), env, envFile, envSchema, openApiSpec, app (+17 more)

### Community 22 - "tool-registry.service.ts"
Cohesion: 0.06
Nodes (15): LIVE_TOOL_IDS, ToolRegistryService, WebMcpService, WebMcpTool, WebMcpToolSchema, ExtendedFilterCategory, HomeComponent, PtAdSlotComponent (+7 more)

### Community 23 - "XhtmlObject"
Cohesion: 0.04
Nodes (20): _a, B, Body, Br, Html, _i, Li, Ma() (+12 more)

### Community 25 - "api/package.json"
Cohesion: 0.06
Nodes (49): dependencies, cors@^2.8.5, docx@^9.14.0, exceljs@^4.4.0, express@^4.21.2, fast-xml-parser@^5.11.2, helmet@^8.0.0, jszip@^3.10.2 (+41 more)

### Community 26 - "pdf-to-powerpoint.component.ts"
Cohesion: 0.07
Nodes (24): PdfToPowerPointJob, PowerPointOutputFileResult, PdfToWordJob, WordOutputFileResult, ConvertPdfToPptxOptions, ConvertPdfToWordOptions, ValidatedPdfFile, ConvertedPowerPointResult (+16 more)

### Community 27 - "Jbig2Error"
Cohesion: 0.08
Nodes (19): ArithmeticDecoder, ContextCache, decodeBitmap(), decodeIAID(), decodeInteger(), decodeMMRBitmap(), decodeRefinement(), decodeTextRegion() (+11 more)

### Community 28 - "ContentObject"
Cohesion: 0.04
Nodes (13): AlwaysEmbed, BehaviorOverride, ContentObject, DefaultTypeface, Exclude, NeverEmbed, Range, Record (+5 more)

### Community 29 - "getStringOption"
Cohesion: 0.07
Nodes (13): config_Area, Equate, getFloat(), getInteger(), getKeyword(), getRatio(), getRelevant(), getStringOption() (+5 more)

### Community 30 - "edit-pdf.component.ts"
Cohesion: 0.07
Nodes (20): EditPdfHeroComponent, EditPdfTopNavComponent, DrawPanelComponent, ElementInfoPanelComponent, HighlightPanelComponent, ImagePanelComponent, LinkPanelComponent, OcrPanelComponent (+12 more)

### Community 31 - "@angular/core"
Cohesion: 0.07
Nodes (10): ServerActionGuard, AnimationService, UploadConsentOptions, UploadConsentService, UploadConsentState, PdfThumbnailsPanelComponent, PtBadgeComponent, PtWorkspaceLayoutComponent (+2 more)

### Community 32 - "web"
Cohesion: 0.05
Nodes (45): build, serve, test, builder, configurations, defaultConfiguration, options, cli (+37 more)

### Community 33 - "ref_pdf_lib"
Cohesion: 0.11
Nodes (30): CompressedFileResult, CompressionJob, compressRouter, jobStore, upload, execFileAsync, findGhostscriptBinary(), isGhostscriptEngineEnabled() (+22 more)

### Community 34 - "Dict"
Cohesion: 0.08
Nodes (8): codePointIter(), Dict, FakeUnicodeFont, getPdfColor(), InkAnnotation, numberToString(), StringStream, stringToUTF16HexString()

### Community 35 - "browser-pdf.service.ts"
Cohesion: 0.07
Nodes (13): BrowserPdfService, CompressedPdfItem, CompressPdfResult, MergeResult, SplitPdfOptions, SplitPdfOutputFile, SplitPdfResult, PageRange (+5 more)

### Community 36 - "warn"
Cohesion: 0.07
Nodes (10): CmykICCBasedCS, ColorSpaceUtils, decodeString(), fetchSync(), IccColorSpace, JpxError, JpxImage, passArray8ToWasm0() (+2 more)

### Community 37 - "Text"
Cohesion: 0.05
Nodes (9): BooleanElement, DateElement, DateTime, Decimal, Float, Integer, Text, Time (+1 more)

### Community 38 - "Page"
Cohesion: 0.08
Nodes (4): AnnotationFactory, isRefsEqual(), ObjectLoader, Page

### Community 39 - "powerpoint-to-pdf.component.ts"
Cohesion: 0.08
Nodes (26): PAGE_SIZES, PostProcessOptions, PostProcessResult, DeckInfo, getDeckInfo(), revokeDeckThumbnail(), LayoutService, ConvertedPowerPointToPdfResult (+18 more)

### Community 40 - ".constructor"
Cohesion: 0.08
Nodes (10): AES128Cipher, AES256Cipher, AESBaseCipher, ARCFourCipher, calculateMD5(), CipherTransformFactory, isArrayEqual(), NullCipher (+2 more)

### Community 41 - "WidgetAnnotation"
Cohesion: 0.10
Nodes (9): ButtonWidgetAnnotation, ChoiceWidgetAnnotation, DefaultAppearanceEvaluator, escapeString(), getModificationDate(), parseDefaultAppearance(), SignatureWidgetAnnotation, TextWidgetAnnotation (+1 more)

### Community 42 - "PDFDocument"
Cohesion: 0.07
Nodes (7): addPageError(), clearGlobalCaches(), find(), isName(), PDFDocument, toHexUtil(), XRefParseException

### Community 43 - "Parser"
Cohesion: 0.11
Nodes (7): Cmd, EvaluatorPreprocessor, isWhiteSpace(), Lexer, Linearization, Parser, toHexDigit()

### Community 44 - "app/app.ts"
Cohesion: 0.08
Nodes (11): @angular/platform-browser@^22.2.0, App, appConfig, DEFAULT_EN_TRANSLATIONS, SUPPORTED_LANGUAGES, SupportedLanguage, TranslationService, BackToTopComponent (+3 more)

### Community 45 - ".getTextContent"
Cohesion: 0.08
Nodes (17): Commands, addFakeSpaces(), appendEOL(), applyInverseRotation(), buildTextContentItem(), compareWithLastPosition(), ensureTextContentItem(), flushTextContentItem() (+9 more)

### Community 46 - "CMap"
Cohesion: 0.07
Nodes (20): addHex(), BinaryCMapReader, CMap, CMapFactory, createBuiltInCMap(), expectInt(), expectString(), extendCMap() (+12 more)

### Community 47 - "Annotation"
Cohesion: 0.09
Nodes (3): Annotation, getRgbColor(), PopupAnnotation

### Community 48 - "excel-to-pdf.route.ts"
Cohesion: 0.09
Nodes (26): ExcelPdfOutputFile, ExcelToPdfJob, excelToPdfRouter, jobStore, upload, convertCsvToXlsxBuffer(), CsvConversionResult, detectDelimiter() (+18 more)

### Community 49 - "XRef"
Cohesion: 0.09
Nodes (7): InvalidPDFException, isCmd(), Jt, ParserEOFException, Ref, XRef, XRefEntryException

### Community 50 - "edit-pdf-ocr.ts"
Cohesion: 0.07
Nodes (23): OcrJobItem, LowConfidenceWord, OcrService, OcrWorkflowService, EDIT_PDF_FEATURES, EditPdfFeatureCategory, EditPdfFeatureConfig, EditPdfFeatureId (+15 more)

### Community 51 - "MarkupAnnotation"
Cohesion: 0.10
Nodes (14): CaretAnnotation, CircleAnnotation, getPdfColorArray(), getQuadPoints(), HighlightAnnotation, LineAnnotation, MarkupAnnotation, PolygonAnnotation (+6 more)

### Community 52 - "ExpressionBuilderVisitor"
Cohesion: 0.08
Nodes (12): AstArgument, AstBinaryOperation, AstLiteral, AstMin, AstNode, AstVariable, AstVariableDefinition, buildAddOperation() (+4 more)

### Community 53 - "getMeasurement"
Cohesion: 0.06
Nodes (11): Caption, CheckButton, ContentArea, Corner, FontFinder, getMeasurement(), Margin, Medium (+3 more)

### Community 54 - "ConnectionSetNamespace"
Cohesion: 0.06
Nodes (12): connection_set_Uri, ConnectionSetNamespace, EffectiveInputPolicy, EffectiveOutputPolicy, Operation, RootElement, SoapAction, SoapAddress (+4 more)

### Community 55 - "EditElement"
Cohesion: 0.10
Nodes (4): AreaSelectionState, EditElement, AreaSelectionService, ElementOperationsService

### Community 56 - "pdf-size-report.ts"
Cohesion: 0.09
Nodes (28): pdf-parse@^2.4.5, analyzePdfSize(), CategorySummary, ContentStreamDetail, extractImagePlacementsFromPdfjs(), FontDetail, formatBytes(), ImageDetail (+20 more)

### Community 57 - "compileGlyf"
Cohesion: 0.07
Nodes (20): parseOperand(), compileGlyf(), createDataNode(), readBits(), FontRendererFactory, getFloat214(), I, Jbig2Image (+12 more)

### Community 58 - "edit-pdf-ocr.route.ts"
Cohesion: 0.10
Nodes (24): @napi-rs/canvas@^0.1.80, editPdfOcrRouter, JOB_RETENTION_MS, OCR_MAX_FILE_SIZE, OCR_MAX_PAGES, ocrJobStore, upload, validateOcrPdf() (+16 more)

### Community 59 - "IntegerObject"
Cohesion: 0.06
Nodes (10): AdobeExtensionLevel, Copies, CurrentPage, IntegerObject, Level, MsgId, NumberOfCopies, Part (+2 more)

### Community 60 - "calculateSHA512"
Cohesion: 0.08
Nodes (19): calculate_sha256_ch(), calculate_sha256_littleSigma(), calculate_sha256_littleSigmaPrime(), calculate_sha256_maj(), calculate_sha256_sigma(), calculate_sha256_sigmaPrime(), calculateSHA256(), calculateSHA384() (+11 more)

### Community 61 - "Glyph"
Cohesion: 0.07
Nodes (6): CompositeGlyph, Contour, GlyfTable, Glyph, GlyphHeader, SimpleGlyph

### Community 62 - "excel-to-pdf.component.ts"
Cohesion: 0.10
Nodes (22): ConvertedExcelToPdfResult, ExcelToPdfService, SUPPORTED_EXTENSIONS, ValidatedExcelFile, getSpreadsheetSheetNames(), SheetInfo, WorkspaceState, ConvertedExcelFileItem (+14 more)

### Community 63 - "dependencies"
Cohesion: 0.07
Nodes (30): @paperflow/contracts@*, pdfjs-dist@^5.4.296, @paperflow/contracts, pdfjs-dist, dependencies, @angular/cdk@^22.2.4, @angular/common@^22.2.0, @angular/compiler@^22.2.0 (+22 more)

### Community 64 - "RefSet"
Cohesion: 0.10
Nodes (7): addChildren(), collectActions(), _collectJS(), getInheritableProperty(), mayHaveChildren(), objectSize(), RefSet

### Community 66 - "unreachable"
Cohesion: 0.11
Nodes (3): BaseStream, Pattern, unreachable()

### Community 70 - "Util"
Cohesion: 0.11
Nodes (3): getTransformMatrix(), lookupRect(), Util

### Community 71 - "JpgToPdfOptions"
Cohesion: 0.19
Nodes (8): JpgToPdfImageItem, JpgToPdfOptions, MeasurementUnit, INCH_TO_PT, MAX_PDF_PAGE_DIM_PT, MiniPreviewStyle, MM_TO_PT, PageLayoutService

### Community 72 - "web/package.json"
Cohesion: 0.11
Nodes (22): @ngx-translate/http-loader@^18.1.0, tslib@^2.3.0, devDependencies, @angular/build@^22.2.3, @angular/cli@^22.2.3, @angular/compiler-cli@^22.2.0, jsdom@^30.0.0, prettier@^3.8.1 (+14 more)

### Community 73 - ".createDocumentHandler"
Cohesion: 0.15
Nodes (12): AbortException, getNewAnnotationsMap(), getVerbosityLevel(), ensureNotTerminated(), finishWorkerTask(), loadDocument(), setupDoc(), onFailure() (+4 more)

### Community 74 - "jpg-to-pdf.component.ts"
Cohesion: 0.15
Nodes (9): ImageAlignmentOption, ImageFitOption, ImageQualityOption, JpgToPdfWarning, MarginOption, PageOrientationOption, PageSizeOption, SupportedImageFormat (+1 more)

### Community 75 - "word-to-pdf.component.ts"
Cohesion: 0.14
Nodes (13): ConvertedWordToPdfResult, SUPPORTED_EXTENSIONS, ValidatedWordFile, WordToPdfService, OcrProgressUpdate, WorkspaceState, environment, EditPdfOcrJobStatus (+5 more)

### Community 76 - "ExclGroup"
Cohesion: 0.10
Nodes (6): addHTML(), createLine(), ExclGroup, flushHTML(), getAvailableSpace(), Subform

### Community 77 - "pdf-to-jpg.component.ts"
Cohesion: 0.13
Nodes (16): ConversionProgress, formatPageRange(), parsePageRange(), RangeParseResult, SelectedPdfFile, WorkspaceState, ConvertedPageItem, ConvertPagesOptions (+8 more)

### Community 79 - "pdf-to-excel.component.ts"
Cohesion: 0.18
Nodes (11): PdfToExcelJob, ConvertedExcelResult, PdfToExcelService, WorkspaceState, MultiFileOutput, PdfToExcelMode, PdfToExcelOptionsSchema, PdfToExcelResponse (+3 more)

### Community 80 - "FormatError"
Cohesion: 0.16
Nodes (6): BaseShading, DummyShading, FormatError, getB(), MeshShading, RadialAxialShading

### Community 81 - "bytesToString"
Cohesion: 0.14
Nodes (17): bytesToString(), CipherTransform, computeIDs(), escapePDFName(), getFontFileType(), getIndexes(), getSizeInBytes(), incrementalUpdate() (+9 more)

### Community 83 - "engine.mjs"
Cohesion: 0.17
Nodes (15): analyzePdf(), apply(), cleanFontName(), det(), mul(), parseColor(), sanitizePdfText(), buildDocx() (+7 more)

### Community 85 - "pdf-to-powerpoint/build.ts"
Cohesion: 0.15
Nodes (16): OcrPageResult, PdfLayoutModel, BASELINE_RATIO, buildPptx(), BuildPptxOptions, BuildPptxResult, cleanHex(), estimateTextWidth() (+8 more)

### Community 86 - ".makeFilter"
Cohesion: 0.13
Nodes (5): Ascii85Stream, AsciiHexStream, CCITTFaxStream, PredictorStream, RunLengthStream

### Community 87 - "Builder"
Cohesion: 0.14
Nodes (4): Builder, Empty, Root, UnknownNamespace

### Community 88 - "compileCharString"
Cohesion: 0.13
Nodes (8): compileCharString(), CompiledFont, getSubroutineBias(), lookupCmap(), lr, recoverGlyphName(), type1FontGlyphMapping(), Type2Compiled

### Community 89 - "Type1Parser"
Cohesion: 0.22
Nodes (5): decrypt(), isHexDigit(), isSpecial(), Type1CharString, Type1Parser

### Community 90 - ".get"
Cohesion: 0.14
Nodes (5): FreeTextAnnotation, Name, StampAnnotation, stringToAsciiOrUTF16BE(), stringToUTF16String()

### Community 91 - "Binder"
Cohesion: 0.24
Nodes (3): Binder, createText(), searchNode()

### Community 92 - "info"
Cohesion: 0.29
Nodes (3): CalGrayCS, CCITTFaxDecoder, info()

### Community 93 - "Value"
Cohesion: 0.11
Nodes (5): Draw, Field, Image, _setValue(), Value

### Community 95 - "PdfToJpgService"
Cohesion: 0.24
Nodes (7): embedJpegDpi(), isValidJpeg(), JpegDpiInfo, readJpegDpi(), PdfToJpgService, PdfToJpgConversionResult, PdfToJpgOptions

### Community 98 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, build:api, build:contracts, build:dev, build:prod, build:staging, build:web (+10 more)

### Community 100 - "PDFWorkerStreamReader"
Cohesion: 0.12
Nodes (3): PDFWorkerStream, PDFWorkerStreamRangeReader, PDFWorkerStreamReader

### Community 101 - "JpgToPdfService"
Cohesion: 0.26
Nodes (4): ComputedPageLayout, JpgToPdfBuildResult, JpgToPdfProgress, JpgToPdfService

### Community 107 - "ImageResizer"
Cohesion: 0.22
Nodes (3): convertBlackAndWhiteToRGBA(), convertToRGBA(), ImageResizer

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
Cohesion: 0.19
Nodes (5): MessageHandler, PasswordException, ResponseException, UnknownErrorException, wrapReason()

### Community 119 - "area-selection.service.ts"
Cohesion: 0.20
Nodes (4): AreaDragMoveState, MarqueeDragState, Command, CommandHistoryService

### Community 120 - "package.json"
Cohesion: 0.15
Nodes (14): author, description, devDependencies, cross-env@^10.1.0, typescript@^5.9.3, vite@^6.4.5, vite, keywords (+6 more)

### Community 121 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+6 more)

### Community 122 - "typescript"
Cohesion: 0.15
Nodes (13): typescript@^5.7.0, typescript@~6.0.2, typescript, devDependencies, typescript@^5.7.0, main, name, private (+5 more)

### Community 123 - "Area"
Cohesion: 0.14
Nodes (3): Area, getContainedChildren(), SubformSet

### Community 124 - "Type1Font"
Cohesion: 0.19
Nodes (4): CFFCharset, CFFHeader, findBlock(), Type1Font

### Community 125 - "CFFDict"
Cohesion: 0.16
Nodes (3): CFFDict, CFFPrivateDict, CFFTopDict

### Community 131 - "ConsentService"
Cohesion: 0.16
Nodes (4): ConsentService, CookieConsentPreferences, DEFAULT_PREFERENCES, STORAGE_CONSENT_KEY

### Community 137 - "pdf-text-extraction.service.ts"
Cohesion: 0.22
Nodes (5): TextLineBounds, GlyphItem, LineSegment, PdfTextExtractionService, TextBlock

### Community 139 - "generate-ai-manifests.js"
Cohesion: 0.15
Nodes (8): availableTools, catalog, fs, liveSet, path, queriesMap, webPublicDir, wellKnownDir

### Community 140 - "generate-fixtures.ts"
Cohesion: 0.30
Nodes (11): createPhotoBuffer(), createScannedPageImage(), createSlideBackgroundPng(), FIXTURES_DIR, generateFullFontPdf(), generatePhotoBrochurePdf(), generatePowerPointPngPdf(), generateScanned20PagePdf() (+3 more)

### Community 141 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+3 more)

### Community 142 - "assert"
Cohesion: 0.26
Nodes (3): assert(), CssFontInfo, toRomanNumerals()

### Community 146 - "pdf-to-jpg.service.ts"
Cohesion: 0.41
Nodes (7): buildCombinedFilename(), buildExtractedImageFilename(), buildPageFilename(), buildZipFilename(), sanitizeBaseName(), computeImageHash(), vitest

### Community 147 - "pdf-to-jpg.component.spec.ts"
Cohesion: 0.21
Nodes (3): LoadPdfOptions, PdfPasswordError, SharedPdfjsService

### Community 151 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, build:dev, build:prod, build:staging, ng, prebuild, start (+3 more)

### Community 157 - "Datasets"
Cohesion: 0.20
Nodes (3): Datasets, datasets_Data, DatasetsNamespace

### Community 162 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, dev:prod, dev:staging, start, start:prod, start:staging (+1 more)

### Community 168 - "Button"
Cohesion: 0.25
Nodes (4): A, Button, fixURL(), recoverJsURL()

### Community 169 - "Option10"
Cohesion: 0.25
Nodes (3): AdjustData, CompressObjectStream, Option10

### Community 183 - "canvas-limits.ts"
Cohesion: 0.48
Nodes (5): calculateSafeRenderDpi(), checkCombinedHeightLimit(), getMaxSafeCanvasArea(), isMobileOrRestrictedEnvironment(), SafeDpiResult

### Community 185 - "createStreamingZip"
Cohesion: 0.53
Nodes (4): fflate@^0.8.3, createStreamingZip(), ZipEntryInput, fflate

### Community 221 - "angular-cli"
Cohesion: 0.50
Nodes (3): cmd.exe, angular-cli, @angular/cli

### Community 222 - "pdf-lib"
Cohesion: 0.67
Nodes (3): pdf-lib@^1.17.1, pdf-lib, pdf-lib@^1.17.1

## Knowledge Gaps
- **4 isolated node(s):** `cmd.exe`, `@angular/cli`, `RFC-5987`, `RFC-5987`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1674 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **134 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ContentEditableModelDirective` connect `ContentEditableModelDirective` to `edit-pdf.component.ts`?**
  _High betweenness centrality (0.267) - this node is a cross-community bridge._
- **What connects `cmd.exe`, `@angular/cli`, `RFC-5987` to the rest of the system?**
  _4 weakly-connected nodes found - possible missing edges._
- **Should `pdf.worker.min.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.01278389772881817 - nodes in this community are weakly interconnected._
- **Why does `Output` connect `ContentEditableModelDirective` to `pdf.worker.min.mjs`, `XFAObject`?**
  _High betweenness centrality (0.267) - this node is a cross-community bridge._
- **Should `XFAObjectArray` be split into smaller, more focused modules?**
  _Cohesion score 0.023529411764705882 - nodes in this community are weakly interconnected._
- **Why does `@angular/core` connect `@angular/core` to `ConsentService`, `AppError`, `pdf-text-extraction.service.ts`, `PageDimensions`, `@angular/router`, `ContentEditableModelDirective`, `pdf-to-jpg.service.ts`, `pdf-to-jpg.component.spec.ts`, `tool-registry.service.ts`, `TextEditElement`, `ViewportNavigationService`, `pdf-to-powerpoint.component.ts`, `edit-pdf.component.ts`, `browser-pdf.service.ts`, `powerpoint-to-pdf.component.ts`, `app/app.ts`, `edit-pdf-ocr.ts`, `excel-to-pdf.component.ts`, `dependencies`, `JpgToPdfOptions`, `web/package.json`, `jpg-to-pdf.component.ts`, `word-to-pdf.component.ts`, `pdf-to-jpg.component.ts`, `pt-faq-accordion.component.ts`, `pdf-to-excel.component.ts`, `pt-step-list.component.ts`, `area-selection.service.ts`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Should `StringObject` be split into smaller, more focused modules?**
  _Cohesion score 0.024096385542168676 - nodes in this community are weakly interconnected._