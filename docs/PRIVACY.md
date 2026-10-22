# PaperFlow Privacy Policy & Document Retention

## 1. Truth in Advertising
PaperFlow commits to absolute transparency regarding where and how your documents are processed.

### Local Browser Tools
When using tools marked with the **"100% In-Browser Private"** badge (e.g., Merge PDF, Split PDF, Rotate PDF, JPG to PDF):
- **Zero Network Transmission**: Your document data is never sent over the internet.
- **Client RAM Only**: All PDF parsing, page copying, and reassembly occurs strictly inside your web browser's isolated JavaScript runtime.
- **No Analytics on Content**: We do not inspect, log, or telemetry your file names or document text.

### Hybrid & Server Tools
When using tools requiring server infrastructure (e.g., heavy compression, OCR):
- Files are transmitted over encrypted TLS connections.
- Files are saved to an isolated temporary directory with randomized identifiers.
- Files are automatically deleted immediately after processing is complete, with a maximum fallback TTL of 15 minutes.
- Files are never shared, sold, or used for model training.
