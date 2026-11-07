import type { Response } from 'express';

const cell = (v: unknown): string => {
  let s = v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 16) : String(v ?? '');
  // Neutralize spreadsheet formula injection (=, +, -, @ at the start of a cell)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Streams a CSV that Excel opens with Persian intact (UTF-8 BOM). */
export function sendCsv(res: Response, name: string, header: string[], rows: unknown[][]): void {
  const body = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send('﻿' + body);
}
