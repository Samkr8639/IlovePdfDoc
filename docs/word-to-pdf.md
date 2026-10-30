# Word to PDF Architecture & Operational Guide

## Overview

The **Word to PDF** converter enables high-fidelity conversion of Microsoft Word documents (`.docx`, `.doc`), OpenDocument Text (`.odt`), and Rich Text Format (`.rtf`) into clean, standard-compliant PDF documents.

## Security Model & Hardening

1. **Ephemeral Execution**: Documents are processed inside temporary directories (`wtp-<uuid>`) and ephemeral LibreOffice profiles (`wtp-<uuid>-profile`). All temporary files and user profiles are forcibly purged in `finally` blocks upon job completion or termination.
2. **Network Isolation**: LibreOffice runs headless with dummy loopback proxies (`http_proxy=http://127.0.0.1:0`), blocking outbound network calls, macro execution, and external link fetching.
3. **No Shell Invocations**: LibreOffice is invoked strictly via `execFile` with argument arrays; no shell interpretation (`exec`) is ever used.
4. **Validation**: Files are pre-validated before engine invocation:
   - MIME / magic bytes verification (OOXML ZIP signature, OLE2 magic, RTF header).
   - Maximum file size: 50 MB per file.
   - Maximum batch: 10 files per conversion.
   - Zero-byte files and corrupt documents are rejected upfront.
5. **Retention**: Converted output files are retained in memory for at most 10 minutes and automatically deleted immediately upon download or expiration.

## Filter & Export Options

| Option | Values | LibreOffice Export Flag | Description |
| :--- | :--- | :--- | :--- |
| `output` | `pdf` (default) \| `pdfa` | `SelectPdfVersion=1` | Exports standard PDF or archival ISO-compliant PDF/A-1b. |
| `imageQuality` | `standard` (default) \| `smaller` | `Quality=90` vs `Quality=75, MaxImageResolution=150` | Balances image sharpness against download file size. |
| `embedBookmarks` | `true` (default) \| `false` | `ExportBookmarks=true` | Converts heading structures into interactive PDF navigation bookmarks. |
| `useTaggedPdf` | `false` (default) \| `true` | `UseTaggedPDF=true` | Emits structural tags for screen readers and accessibility. |
| `exportHyperlinks` | `true` (default) \| `false` | `ExportLinksRelativeFsys=false` | Preserves clickable web URLs. |

## Error Codes & Status Mapping

| HTTP Code | Error Code | Description |
| :--- | :--- | :--- |
| **400** | `NO_FILES_UPLOADED` | No files were supplied in the upload payload. |
| **400** | `ZERO_BYTE_FILE` | Input file has a size of 0 bytes. |
| **400** | `TOO_MANY_FILES` | Upload batch exceeds the 10-file ceiling. |
| **413** | `FILE_TOO_LARGE` | Input file exceeds the 50MB limit. |
| **415** | `UNSUPPORTED_FILE_TYPE` | Extension is not `.doc`, `.docx`, `.odt`, or `.rtf`. |
| **415** | `INVALID_FILE_CONTENT` | Magic bytes mismatch document extension. |
| **422** | `CONVERSION_FAILED` | Document is corrupted or unreadable by LibreOffice. |
| **503** | `ENGINE_UNAVAILABLE` | LibreOffice binary not installed or not reachable on the host. |
| **504** | `CONVERSION_TIMEOUT` | Conversion process exceeded the timeout limit (90 seconds). |

## Environment Variables

- `SOFFICE_PATH`: Path to the LibreOffice binary (e.g. `/usr/bin/soffice` or `C:\Program Files\LibreOffice\program\soffice.exe`).
- `WORD_TO_PDF_TIMEOUT_MS`: Maximum duration before killing the worker process (default: `90000`).
