import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Brand lockup: orange P mark + wordmark + tagline (from the approved mockup). */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a class="logo" routerLink="/" aria-label="PIPEOX — صفحه اصلی">
      <svg class="logo-mark" viewBox="0 0 46 39" aria-hidden="true" focusable="false">
        <path fill="currentColor" fill-rule="evenodd" d="M6 1H33a12 12 0 0 1 0 24H18.4L14 36.4a3 3 0 0 1-2.8 2H3.4a2 2 0 0 1-1.9-2.7L4 3a2.6 2.6 0 0 1 2-2ZM3.42 10.6H31a2.2 2.2 0 0 1 0 4.4H3.08Z" />
      </svg>
      <span class="logo-text"><b>PIPEOX</b><small>Steel Pipeline Solutions</small></span>
    </a>
  `,
})
export class LogoComponent {}
