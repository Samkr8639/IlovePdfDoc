import { Injectable } from '@angular/core';
import {
  EditElement,
  HighlightEditElement,
  ImageEditElement,
  LinkEditElement,
  PageDimensions,
  ShapeEditElement,
  SignEditElement,
  TextEditElement,
  WhiteoutEditElement
} from '../models/document-model';

@Injectable({
  providedIn: 'root'
})
export class ElementOperationsService {
  createTextElement(
    page: PageDimensions,
    params: {
      xPt?: number;
      yPt?: number;
      fontFamily: string;
      fontSizePt: number;
      color: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      align?: 'left' | 'center' | 'right';
    }
  ): TextEditElement {
    return {
      id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: page.pageIndex,
      type: 'text',
      xPt: params.xPt ?? 100,
      yPt: params.yPt ?? 100,
      widthPt: 220,
      heightPt: 28,
      text: 'Click or edit text',
      fontFamily: params.fontFamily,
      fontSizePt: params.fontSizePt,
      color: params.color,
      bold: params.bold ?? false,
      italic: params.italic ?? false,
      underline: params.underline ?? false,
      align: params.align ?? 'left'
    };
  }

  createShapeElement(
    page: PageDimensions,
    params: {
      shapeType: 'rectangle' | 'circle' | 'line' | 'arrow' | 'star';
      strokeColor: string;
      fillColor: string;
      strokeWidth: number;
      xPt?: number;
      yPt?: number;
    }
  ): ShapeEditElement {
    const widthPt = params.shapeType === 'line' || params.shapeType === 'arrow' ? 140 : 160;
    const heightPt = params.shapeType === 'line' || params.shapeType === 'arrow' ? 70 : 100;
    const finalX = params.xPt !== undefined ? params.xPt : Math.round((page.widthPt - widthPt) / 2);
    const finalY = params.yPt !== undefined ? params.yPt : Math.round((page.heightPt - heightPt) / 2);

    return {
      id: `shape-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: page.pageIndex,
      type: 'shape',
      shapeType: params.shapeType,
      xPt: finalX,
      yPt: finalY,
      widthPt,
      heightPt,
      strokeColor: params.strokeColor,
      fillColor: params.fillColor,
      strokeWidth: params.strokeWidth
    };
  }

  createHighlightElement(
    page: PageDimensions,
    params: {
      xPt?: number;
      yPt?: number;
      color: string;
      opacity: number;
    }
  ): HighlightEditElement {
    return {
      id: `hl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: page.pageIndex,
      type: 'highlight',
      xPt: params.xPt ?? 100,
      yPt: params.yPt ?? 100,
      widthPt: 180,
      heightPt: 22,
      color: params.color,
      opacity: params.opacity
    };
  }

  createWhiteoutElement(
    page: PageDimensions,
    params: {
      xPt?: number;
      yPt?: number;
      widthPt?: number;
      heightPt?: number;
    }
  ): WhiteoutEditElement {
    return {
      id: `wo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: page.pageIndex,
      type: 'whiteout',
      xPt: params.xPt ?? 100,
      yPt: params.yPt ?? 100,
      widthPt: params.widthPt ?? 160,
      heightPt: params.heightPt ?? 30,
      fillColor: 'var(--pt-surface-white)'
    };
  }

  createSignElement(
    page: PageDimensions,
    params: {
      tab: 'type' | 'draw' | 'upload';
      text?: string;
      fontFamily?: string;
      color?: string;
      fontSizePt?: number;
      drawnDataUrl?: string | null;
      xPt?: number;
      yPt?: number;
    }
  ): SignEditElement {
    let dataUrl = '';
    let widthPt = 180;
    let heightPt = 48;

    if (params.tab === 'draw' || params.tab === 'upload') {
      dataUrl = params.drawnDataUrl || '';
      widthPt = 160;
      heightPt = 60;
    } else {
      dataUrl = params.text || 'John Doe';
      widthPt = Math.max(120, ((params.text || 'John Doe').length || 8) * 14);
      heightPt = 44;
    }

    const finalX = params.xPt !== undefined ? params.xPt : Math.round((page.widthPt - widthPt) / 2);
    const finalY = params.yPt !== undefined ? params.yPt : Math.round((page.heightPt - heightPt) / 2);

    return {
      id: `sign-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: page.pageIndex,
      type: 'sign',
      xPt: finalX,
      yPt: finalY,
      widthPt,
      heightPt,
      dataUrl,
      signatureText: params.tab === 'type' ? (params.text || 'John Doe') : undefined,
      fontFamily: params.tab === 'type' ? params.fontFamily : undefined,
      color: params.tab === 'type' ? params.color : undefined,
      fontSizePt: params.tab === 'type' ? params.fontSizePt : undefined
    };
  }

  createLinkElement(
    page: PageDimensions,
    params: {
      xPt?: number;
      yPt?: number;
      url: string;
    }
  ): LinkEditElement {
    return {
      id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: page.pageIndex,
      type: 'link',
      xPt: params.xPt ?? 100,
      yPt: params.yPt ?? 100,
      widthPt: 180,
      heightPt: 30,
      url: params.url
    };
  }

  createImageElement(
    page: PageDimensions,
    params: {
      dataUrl: string;
      naturalWidth: number;
      naturalHeight: number;
    }
  ): ImageEditElement {
    const maxW = Math.min(250, page.widthPt * 0.6);
    const maxH = Math.min(320, page.heightPt * 0.5);
    const ratio = params.naturalHeight / (params.naturalWidth || 1);
    let w = maxW;
    let h = w * ratio;
    if (h > maxH) {
      h = maxH;
      w = h / ratio;
    }

    const xPt = Math.max(20, Math.round((page.widthPt - w) / 2));
    const yPt = Math.max(20, Math.round((page.heightPt - h) / 2));

    return {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pageIndex: page.pageIndex,
      type: 'image',
      xPt,
      yPt,
      widthPt: Math.round(w),
      heightPt: Math.round(h),
      naturalWidth: params.naturalWidth,
      naturalHeight: params.naturalHeight,
      dataUrl: params.dataUrl
    };
  }

  duplicateElement(el: EditElement): EditElement {
    const id = `${el.type}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const offset = 20;

    if (el.type === 'draw') {
      const drawEl = el as any;
      const pts = drawEl.points.map((p: any) => ({ xPt: p.xPt + offset, yPt: p.yPt - offset }));
      return {
        ...el,
        id,
        xPt: el.xPt + offset,
        yPt: el.yPt - offset,
        points: pts
      };
    }

    return {
      ...el,
      id,
      xPt: el.xPt + offset,
      yPt: el.yPt - offset,
      ...(el.type === 'text' ? { isPageTextLine: false } : {})
    };
  }

  bringToFront(elements: EditElement[], id: string): EditElement[] {
    const target = elements.find(e => e.id === id);
    if (!target) return elements;
    return [...elements.filter(e => e.id !== id), target];
  }

  sendToBack(elements: EditElement[], id: string): EditElement[] {
    const target = elements.find(e => e.id === id);
    if (!target) return elements;
    return [target, ...elements.filter(e => e.id !== id)];
  }

  deleteElement(elements: EditElement[], id: string): EditElement[] {
    return elements.filter(e => e.id !== id);
  }
}
