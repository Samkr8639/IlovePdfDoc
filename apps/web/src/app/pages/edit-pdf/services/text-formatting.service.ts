import { Injectable } from '@angular/core';
import { TextEditElement } from '../models/document-model';

@Injectable({
  providedIn: 'root'
})
export class TextFormattingService {
  restoreTextSelection(
    el: TextEditElement,
    savedRange: Range | null
  ): { hasSelection: boolean; activeEl: HTMLElement | null; updatedRange: Range | null } {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { hasSelection: false, activeEl: null, updatedRange: savedRange };
    }

    const activeEl = document.getElementById(`text-editable-${el.id}`);
    if (!activeEl) {
      return { hasSelection: false, activeEl: null, updatedRange: savedRange };
    }

    const sel = window.getSelection();
    let currentSaved = savedRange;

    // If currently there is no selection inside activeEl, restore savedRange if valid
    if (sel && activeEl.contains(sel.anchorNode) && !sel.isCollapsed) {
      currentSaved = sel.getRangeAt(0).cloneRange();
    } else if (currentSaved && sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(currentSaved);
      } catch {
        // Range expired
      }
    }

    const hasSelection = !!(
      sel &&
      sel.rangeCount > 0 &&
      !sel.isCollapsed &&
      activeEl.contains(sel.anchorNode)
    );

    return { hasSelection, activeEl, updatedRange: currentSaved };
  }

  applyInlineFormatting(
    command: 'bold' | 'italic' | 'underline',
    el: TextEditElement,
    savedRange: Range | null
  ): { handled: boolean; updatedRange: Range | null } {
    const { hasSelection, activeEl, updatedRange } = this.restoreTextSelection(el, savedRange);

    if (hasSelection && activeEl) {
      document.execCommand(command, false);
      el.html = activeEl.innerHTML;
      el.text = activeEl.innerText;
      if (el.isPageTextLine) {
        el.isEdited = true;
      }
      const sel = window.getSelection();
      const newRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : updatedRange;
      return { handled: true, updatedRange: newRange };
    }

    return { handled: false, updatedRange };
  }

  detectLinkUrl(el: TextEditElement, savedRange: Range | null): string {
    const { hasSelection, activeEl } = this.restoreTextSelection(el, savedRange);

    if (hasSelection && activeEl && typeof window !== 'undefined') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let parent: Node | null = sel.getRangeAt(0).commonAncestorContainer;
        if (parent && parent.nodeType === Node.TEXT_NODE) parent = parent.parentElement;
        const anchor = (parent as HTMLElement)?.closest?.('a');
        if (anchor) {
          return anchor.getAttribute('href') || '';
        }
      }
    }

    if (el.html && el.html.includes('href="')) {
      const match = el.html.match(/href="([^"]*)"/i);
      if (match) return match[1];
    }

    if (el.linkUrl) {
      return el.linkUrl;
    }

    return '';
  }

  formatUrl(url: string): string {
    let targetUrl = url.trim();
    if (!targetUrl || targetUrl === 'https://' || targetUrl === 'http://') {
      return '';
    }
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    return targetUrl;
  }

  applyLink(
    el: TextEditElement,
    url: string,
    savedRange: Range | null
  ): { updatedRange: Range | null } {
    const targetUrl = this.formatUrl(url);
    if (!targetUrl) {
      return this.removeLink(el, savedRange);
    }

    const { hasSelection, activeEl, updatedRange } = this.restoreTextSelection(el, savedRange);
    let newRange = updatedRange;

    if (hasSelection && activeEl) {
      document.execCommand('createLink', false, targetUrl);

      const anchors = activeEl.querySelectorAll('a');
      anchors.forEach(a => {
        if (a.getAttribute('href') === targetUrl || !a.getAttribute('href')) {
          a.setAttribute('href', targetUrl);
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
          a.style.color = '#2563EB';
          a.style.textDecoration = 'underline';
        }
      });

      el.html = activeEl.innerHTML;
      el.text = activeEl.innerText;
      if (el.isPageTextLine) {
        el.isEdited = true;
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        newRange = sel.getRangeAt(0).cloneRange();
      }
    } else {
      el.linkUrl = targetUrl;
      const textToWrap = el.text || 'Link';
      el.html = `<a href="${targetUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline;">${el.html || textToWrap}</a>`;
      if (el.isPageTextLine) {
        el.isEdited = true;
      }
    }

    return { updatedRange: newRange };
  }

  removeLink(
    el: TextEditElement,
    savedRange: Range | null
  ): { updatedRange: Range | null } {
    const { hasSelection, activeEl, updatedRange } = this.restoreTextSelection(el, savedRange);
    let newRange = updatedRange;

    if (hasSelection && activeEl) {
      document.execCommand('unlink', false);
      el.html = activeEl.innerHTML;
      el.text = activeEl.innerText;
      if (el.isPageTextLine) {
        el.isEdited = true;
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        newRange = sel.getRangeAt(0).cloneRange();
      }
    } else {
      delete el.linkUrl;
      if (el.html) {
        el.html = el.html.replace(/<\/?a[^>]*>/gi, '');
      }
      if (el.isPageTextLine) {
        el.isEdited = true;
      }
    }

    return { updatedRange: newRange };
  }
}
