import { Component, input } from '@angular/core';

@Component({
  selector: 'app-processing-state',
  templateUrl: './processing-state.component.html',
  styleUrl: './processing-state.component.css'
})
export class ProcessingStateComponent {
  readonly title = input<string>('Merging PDF Documents...');
  readonly message = input<string>('');
  readonly percent = input<number>(0);
}
