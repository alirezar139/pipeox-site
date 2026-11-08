import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { langOf, translateMessage } from '../i18n.js';

const FA: Partial<Record<number, string>> = {
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'حجم فایل بیش از حد مجاز است.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید.',
  [HttpStatus.NOT_FOUND]: 'پیدا نشد.',
  [HttpStatus.UNAUTHORIZED]: 'ابتدا وارد شوید.',
  [HttpStatus.FORBIDDEN]: 'دسترسی مجاز نیست.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'خطای داخلی سرور. لطفاً دوباره تلاش کنید.',
};

/**
 * One error shape for the whole API: { statusCode, message, field? }.
 * Unexpected errors are logged with detail but answered generically (no stack traces leak).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('API');

  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    const lang = langOf(host.switchToHttp().getRequest<Request>());

    if (!(err instanceof HttpException)) {
      this.log.error(err instanceof Error ? err.stack : String(err));
      res.status(500).json({ statusCode: 500, message: translateMessage(FA[500]!, lang) });
      return;
    }
    const status = err.getStatus();
    const body = err.getResponse();
    let message = typeof body === 'string' ? body : (body as { message?: unknown }).message;
    const field = typeof body === 'object' ? (body as { field?: string }).field : undefined;
    if (Array.isArray(message)) message = message[0];
    // Persian, user-facing text when Nest/multer produced an English default
    if (typeof message !== 'string' || !/[؀-ۿ]/.test(message)) message = FA[status] ?? message ?? 'درخواست نامعتبر است.';
    res.status(status).json({ statusCode: status, message: translateMessage(String(message), lang), ...(field ? { field } : {}) });
  }
}
