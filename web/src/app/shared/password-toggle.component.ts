import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { IconComponent } from './icon.component';

/** Eye button that shows / hides the password typed into `for`. Place it inside the field's label. */
@Component({
  selector: 'app-pw-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button type="button" class="pw-toggle" (click)="toggle()" [attr.aria-label]="shown() ? 'پنهان کردن رمز' : 'نمایش رمز'"
      [attr.aria-pressed]="shown()" [title]="shown() ? 'پنهان کردن رمز' : 'نمایش رمز'">
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
