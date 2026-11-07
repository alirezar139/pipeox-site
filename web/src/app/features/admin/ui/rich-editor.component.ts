import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, model, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../admin-api.service';
import { ToastService } from './toast.service';

/**
 * Lightweight article editor (headings, lists, quote, links, images) with an HTML source view.
 * Output is cleaned again on the server (allow-list sanitizer) — the editor is a convenience, not a guard.
 */
@Component({
  selector: 'adm-rich-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: { class: 'adm-editor', '[class.source]': 'source()' },
  template: `
    <div class="adm-ed-tools" role="toolbar" aria-label="ابزار ویرایش">
      <button type="button" (mousedown)="$event.preventDefault()" (click)="block('h2')">تیتر</button>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="block('h3')">زیرتیتر</button>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="block('p')">متن</button>
      <i class="sep"></i>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('bold')" title="پررنگ"><b>B</b></button>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('italic')" title="کج"><i>I</i></button>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('insertUnorderedList')">• فهرست</button>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('insertOrderedList')">۱. فهرست</button>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="block('blockquote')">❝ نقل‌قول</button>
      <i class="sep"></i>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="link()">پیوند</button>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="file.click()" [disabled]="busy()">{{ busy() ? '...' : 'تصویر' }}</button>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('removeFormat')">پاک‌کردن قالب</button>
      <i class="sep"></i>
      <button type="button" (click)="toggleSource()" [class.on]="source()">&lt;/&gt; HTML</button>
      <input #file type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="image($event)">
    </div>
    <div #area class="adm-ed-area prose" contenteditable="true" dir="rtl" (input)="sync()" (paste)="paste($event)"></div>
    <textarea class="adm-ed-source" dir="ltr" spellcheck="false" [ngModel]="value()" (ngModelChange)="value.set($event)"></textarea>
  `,
})
export class RichEditorComponent {
  readonly value = model('');
  private readonly area = viewChild.required<ElementRef<HTMLDivElement>>('area');
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly source = signal(false);
  protected readonly busy = signal(false);

  constructor() {
    afterNextRender(() => {
      this.area().nativeElement.innerHTML = this.value();
      document.execCommand('defaultParagraphSeparator', false, 'p');
    });
  }

  /** Call after loading a different document into `value`. */
  reload(html: string) {
    this.value.set(html);
    const el = this.area()?.nativeElement;
    if (el) el.innerHTML = html;
  }

  protected sync() {
    this.value.set(this.area().nativeElement.innerHTML);
  }
  protected cmd(name: string, arg?: string) {
    this.area().nativeElement.focus();
    document.execCommand(name, false, arg);
    this.sync();
  }
  protected block(tag: string) {
    this.cmd('formatBlock', `<${tag}>`);
  }
  protected link() {
    const url = prompt('آدرس پیوند (https://… یا /products/…):');
    if (url && /^(https?:\/\/|\/|mailto:|tel:)/i.test(url.trim())) this.cmd('createLink', url.trim());
  }
  protected toggleSource() {
    if (this.source()) this.area().nativeElement.innerHTML = this.value();
    this.source.update((v) => !v);
  }

  protected async image(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.busy.set(true);
    try {
      const { url } = await this.api.upload(f);
      const alt = (prompt('توضیح کوتاه تصویر (برای دسترس‌پذیری و سئو):') ?? '').replace(/["<>]/g, '');
      this.cmd('insertHTML', `<img src="${url}" alt="${alt}">`);
    } catch (err) {
      this.toast.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  /** Paste from Word/websites: keep the structure, drop styling and scripts. */
  protected paste(e: ClipboardEvent) {
    const html = e.clipboardData?.getData('text/html');
    if (!html) return;
    e.preventDefault();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('style,script,meta,link,iframe,object').forEach((n) => n.remove());
    doc.body.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((a) => !['href', 'src', 'alt'].includes(a.name) && n.removeAttribute(a.name)));
    this.cmd('insertHTML', doc.body.innerHTML);
  }
}
