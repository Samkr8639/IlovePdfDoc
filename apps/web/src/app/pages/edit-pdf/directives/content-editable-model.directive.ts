import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';

@Directive({
  selector: '[appContentEditableModel]',
  standalone: true
})
export class ContentEditableModelDirective implements OnChanges {
  @Input('appContentEditableModel') model: { html?: string; text: string } | null = null;
  @Output() contentChange = new EventEmitter<{ html: string; text: string }>();

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (
      typeof document !== 'undefined' &&
      (document.activeElement === this.el.nativeElement ||
        this.el.nativeElement.contains(document.activeElement))
    ) {
      return; // Do not overwrite DOM while user is actively typing inside
    }
    const targetHtml = this.model?.html || (this.model?.text ? this.model.text.replace(/\n/g, '<br>') : '');
    if (this.el.nativeElement.innerHTML !== targetHtml) {
      this.el.nativeElement.innerHTML = targetHtml;
    }
  }

  @HostListener('input')
  onInput(): void {
    this.contentChange.emit({
      html: this.el.nativeElement.innerHTML,
      text: this.el.nativeElement.innerText
    });
  }

  @HostListener('blur')
  onBlur(): void {
    this.contentChange.emit({
      html: this.el.nativeElement.innerHTML,
      text: this.el.nativeElement.innerText
    });
  }
}

