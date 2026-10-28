# PDFTailor Launch Checklist: Content & Assets to Confirm

> **Target Domain:** [pdftailor.in](https://pdftailor.in)  
> **Brand Name:** PDFTailor  
> **Audience:** Product Owners & Legal Stakeholders

The following items have been configured with sensible, high-quality production defaults and should be verified prior to DNS switchover:

---

## 1. Official Communication Channels & Inboxes

| Channel | Current Value | Verification Status |
| :--- | :--- | :--- |
| **General Support** | `support@pdftailor.in` | Verify MX records and inbox routing |
| **Legal & Privacy** | `privacy@pdftailor.in` | Verify routing to Data Protection Officer |
| **Press & Media** | `press@pdftailor.in` | Verify routing to PR/Comms team |
| **Security Reports** | `security@pdftailor.in` | Verify PGP keys / security response triage |

---

## 2. Social Media Handles & Sharing URLs

Configured in `ResultViewComponent` and footer links:
* **Twitter / X:** Current share template links to `@PDFTailor` / `pdftailor.in`.
* **LinkedIn:** Current company link points to `pdftailor.in`.
* **GitHub:** Verify repository visibility for open-source client libraries or developer SDKs.

---

## 3. Legal & Regulatory Entity Details

* **Registered Entity Name:** "PDFTailor Technologies Inc. / PDFTailor India"
* **Effective Date for Terms & Privacy Policy:** Updated to October 2026.
* **Governing Jurisdiction:** Standard arbitration and jurisdictional clauses in `terms-and-conditions.component.html` should be verified by legal counsel.

---

## 4. Ad Slot Configurations & Privacy Toggles

* Ad placements (`PtAdSlotComponent`) are prepared with clean placeholder slots and responsive dimensions.
* Integration of Google AdSense / EthicalAds tags can be swapped directly via environment tokens without touching component layout markup.
