import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TPipe } from '../core/i18n';
import { IconComponent } from './icon.component';

/** Eye button that shows / hides the password typed into `for`. Place it inside the field's label. */
@Component({
  selector: 'app-pw-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  template: `
    <button type="button" class="pw-toggle" (click)="toggle()" [attr.aria-label]="(shown() ? 'common.hidePassword' : 'common.showPassword') | t"
      [attr.aria-pressed]="shown()" [title]="(shown() ? 'common.hidePassword' : 'common.showPassword') | t">
      <app-icon [name]="shown() ? 'eye-off' : 'eye'" />
    </button>
  `,
})
export class PasswordToggleComponent {
  readonly for = input.required<HTMLInputElement>();
  protected readonly shown = signal(false);

  toggle() {
    const el = this.for();
    this.shown.update((v) => !v);
    el.type = this.shown() ? 'text' : 'password';
    el.focus();
  }
}
