# PaperFlow UI/UX Research & Design System Specification

## 1. UI/UX Research & Benchmark Analysis

### 1.1 Evaluated Industry Reference Patterns
- **iLovePDF / Smallpdf / PDF24 / Acrobat Web**:
  - **Information Architecture**: Tools organized by primary job-to-be-done: *Organize* (Merge, Split, Remove), *Convert* (to/from PDF), *Optimize* (Compress), *Edit* (Watermark, Rotate), and *Security* (Protect, Unlock).
  - **Homepage Pattern**: Clear value proposition above the fold; high-contrast tool grid where every card has a recognizable badge, icon, and direct description.
  - **Upload Experience**: Expansive, accessible dropzone that reacts with visual scale and border glows on hover/dragover.
  - **Tool Workspace Workflow**:
    1. Header bar with document count, total size, and quick "Add more files" button.
    2. Visual card grid for files/pages with drag handles, delete button, rotate button, and page numbers.
    3. Sticky action sidebar or floating bottom bar with primary CTA: `[Action Name] (Processing Mode)`.
    4. Feedback: Real progress indicator (reading -> merging -> downloading).
    5. Result view: Large download button, file size savings badge, "Process another file" and related next actions.

---

## 2. Design System Tokens

### 2.1 Color Palette
An original, high-credibility productivity SaaS palette:
- **Primary Brand**:
  - `primary-50`: `#eff6ff`
  - `primary-100`: `#dbeafe`
  - `primary-500`: `#3b82f6` (Vibrant Blue - clear, trust-inspiring)
  - `primary-600`: `#2563eb` (Interactive hover state)
  - `primary-700`: `#1d4ed8`
- **Surface & Neutrals**:
  - `surface-canvas`: `#f8fafc` (Ultra-clean slate background)
  - `surface-card`: `#ffffff` (Pure white card surfaces)
  - `surface-border`: `#e2e8f0` (Subtle boundary lines)
  - `surface-muted`: `#64748b` (Secondary body text)
  - `surface-foreground`: `#0f172a` (High-contrast charcoal dark)
- **Status & Trust Badges**:
  - `badge-browser-bg`: `#ecfdf5`
  - `badge-browser-text`: `#065f46`
  - `badge-browser-border`: `#a7f3d0` (100% Private / In-Browser badge)
  - `badge-server-bg`: `#fef3c7`
  - `badge-server-text`: `#92400e` (Cloud Worker badge)

### 2.2 Typography
- **Font Family**: Modern sans-serif system stack with `Plus Jakarta Sans` / `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`.
- **Scale**:
  - `H1`: 2.5rem (40px), font-weight: 800, line-height: 1.2
  - `H2`: 1.75rem (28px), font-weight: 700
  - `H3`: 1.25rem (20px), font-weight: 600
  - `Body`: 0.95rem (15px), line-height: 1.6
  - `Small`: 0.8125rem (13px), line-height: 1.5

### 2.3 Radius & Shadows
- **Border Radius**:
  - Card / Dropzone: `16px` (`rounded-2xl`)
  - Buttons / Inputs: `10px` (`rounded-xl`)
  - Badges: `9999px` (`rounded-full`)
- **Elevation**:
  - `shadow-sm`: `0 1px 2px 0 rgb(0 0 0 / 0.05)`
  - `shadow-card`: `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)`
  - `shadow-hover`: `0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.04)`

---

## 3. Reusable UI Components Spec

1. **`AppHeader`**: Sticky top navigation bar, logo with icon mark, categories dropdown, search shortcut (`Ctrl+K`), Privacy status badge.
2. **`FileDropzone`**: Accessible file input with drag-enter state changes, file type filter, size limit indicator.
3. **`FileList` & `FileCard`**: Draggable items showing file preview icon, name, formatted size, page count, remove button, and move up/down controls.
4. **`ProcessingBar`**: Linear progress bar with phase indicators (`Reading`, `Merging`, `Optimizing`).
5. **`ResultScreen`**: Success icon, download trigger button, file details, restart button, and related tools recommendations.
