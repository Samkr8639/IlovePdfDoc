import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-processing-state',
  templateUrl: './processing-state.component.html',
  styleUrl: './processing-state.component.css'
})
export class ProcessingStateComponent {
  readonly title = input<string>('Converting PDF to WORD...');
  readonly message = input<string>('');
  readonly percent = input<number>(0);

  readonly formattedTitle = computed(() => {
    const raw = this.title() || 'Converting PDF to WORD...';
    // Format all-caps titles like "CONVERTING PDF TO WORD..." into clean Title Case with preserved acronyms
    if (raw.toUpperCase() === raw) {
      return raw
        .toLowerCase()
        .replace(/^./, c => c.toUpperCase())
        .replace(/\bpdf\b/gi, 'PDF')
        .replace(/\bword\b/gi, 'WORD');
    }
    return raw;
  });
}
