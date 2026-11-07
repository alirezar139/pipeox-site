<?php
declare(strict_types=1);

/**
 * Runtime for the public pages. Eleventy builds every page as a .php file whose
 * first line requires this file and calls page_start() with the page's front matter.
 * Content (settings, products, articles, projects) is read live from SQLite.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/auth.php';

/* ───────── Settings ───────── */

function settings(): array
{
    static $s = null;
    if ($s === null) {
        $s = [];
        foreach (db()->query('SELECT key, value FROM settings') as $r) {
            $s[$r['key']] = json_decode($r['value'], true);
        }
    }
    return $s;
}

/** Dot-path lookup: s('contact.phone'). */
function s(string $path, mixed $default = ''): mixed
{
    $v = settings();
    foreach (explode('.', $path) as $k) {
        if (!is_array($v) || !array_key_exists($k, $v)) {
            return $default;
        }
        $v = $v[$k];
    }
    return $v ?? $default;
}

/** Escaped setting, for templates: <?= se('hero.title') ?> */
function se(string $path): string
{
    return e((string)s($path));
}

/* ───────── Content ───────── */

function product_row(array $r): array
{
    foreach (['types', 'specs', 'applications'] as $k) {
        $r[$k] = json_decode($r[$k] ?: '[]', true) ?: [];
    }
    return $r;
}

function products(): array
{
    static $rows = null;
    return $rows ??= array_map('product_row',
        db()->query('SELECT * FROM products WHERE published = 1 ORDER BY sort, id')->fetchAll());
}

function product(string $slug): ?array
{
    foreach (products() as $p) {
        if ($p['slug'] === $slug) {
            return $p;
        }
    }
    return null;
}

/** Today in Tehran — articles dated in the future stay hidden until that day (scheduled posts). */
function today(): string
{
    return (new DateTime('now', new DateTimeZone('Asia/Tehran')))->format('Y-m-d');
}

function articles(int $limit = 0): array
{
    $q = db()->prepare('SELECT * FROM articles WHERE published = 1 AND published_at <= ? ORDER BY published_at DESC, id DESC' . ($limit ? ' LIMIT ' . $limit : ''));
    $q->execute([today()]);
    return $q->fetchAll();
}

function article(string $slug): ?array
{
    $q = db()->prepare('SELECT * FROM articles WHERE slug = ? AND published = 1 AND published_at <= ?');
    $q->execute([$slug, today()]);
    return $q->fetch() ?: null;
}

function projects(): array
{
    return db()->query('SELECT * FROM projects WHERE published = 1 ORDER BY sort, id')->fetchAll();
}

/* ───────── Formatting ───────── */

function fa_digits(string|int $s): string
{
    return strtr((string)$s, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
}

function fa_num(string|int $n): string
{
    return fa_digits(is_numeric($n) ? number_format((float)$n, 0, '.', '٬') : $n);
}

/** Gregorian → Solar Hijri [y, m, d] (no intl extension needed). */
function jalali(int $gy, int $gm, int $gd): array
{
    $gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    $gy2 = $gm > 2 ? $gy + 1 : $gy;
    $days = 355666 + 365 * $gy + intdiv($gy2 + 3, 4) - intdiv($gy2 + 99, 100) + intdiv($gy2 + 399, 400) + $gd + $gdm[$gm - 1];
    $jy = -1595 + 33 * intdiv($days, 12053);
    $days %= 12053;
    $jy += 4 * intdiv($days, 1461);
    $days %= 1461;
    if ($days > 365) {
        $jy += intdiv($days - 1, 365);
        $days = ($days - 1) % 365;
    }
    $jm = $days < 186 ? 1 + intdiv($days, 31) : 7 + intdiv($days - 186, 30);
    $jd = 1 + ($days < 186 ? $days % 31 : ($days - 186) % 30);
    return [$jy, $jm, $jd];
}

const FA_MONTHS = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/** «۲۱ مهر ۱۴۰۵» — $date is 'Y-m-d' or a UTC 'Y-m-d H:i:s' (shown in Tehran time). */
function fa_date(string $date, bool $short = false): string
{
    $tz = new DateTimeZone('Asia/Tehran');
    $d = strlen($date) > 10 ? (new DateTime($date, new DateTimeZone('UTC')))->setTimezone($tz) : new DateTime($date, $tz);
    [$y, $m, $day] = jalali((int)$d->format('Y'), (int)$d->format('n'), (int)$d->format('j'));
    return $short
        ? fa_digits(sprintf('%04d/%02d/%02d', $y, $m, $day))
        : fa_digits("$day ") . FA_MONTHS[$m] . fa_digits(" $y");
}

/** «۱۱ آبان ۱۴۰۵ · ۱۴:۳۰» from a UTC timestamp. */
function fa_datetime(string $utc): string
{
    $t = (new DateTime($utc, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Tehran'));
    return fa_date($utc) . ' · ' . fa_digits($t->format('H:i'));
}

function reading_time(string $html): string
{
    $words = count(preg_split('/\s+/u', trim(strip_tags($html)), -1, PREG_SPLIT_NO_EMPTY));
    return fa_digits((string)max(1, (int)round($words / 200)));
}

function tel_href(string $s): string
{
    return preg_replace('/[^\d+]/', '', normalize_digits($s)) ?? '';
}

function excerpt(string $s, int $n): string
{
    return mb_strlen($s) > $n ? rtrim(mb_substr($s, 0, $n)) . '…' : $s;
}

/** Inline SVG icon (markup generated from partials/icons.njk at build time). */
function icon(string $name): string
{
    static $icons = null;
    $icons ??= is_file(__DIR__ . '/icons.php') ? require __DIR__ . '/icons.php' : [];
    return $icons[$name] ?? '';
}

/* ───────── Page lifecycle ───────── */

/**
 * Called at the top of every built page. $meta is the page's front matter;
 * a page with `controller: name` runs api/pages/name.php first, which may
 * handle a form POST, redirect, 404, or add values (title, lead, data…) to $P.
 */
function page_start(array $meta): array
{
    header('Content-Type: text/html; charset=utf-8');
    ob_start(); // lets templates start a session / send headers after markup has begun
    $P = $meta;
    if (!empty($meta['private'])) {
        session_boot(true); // account pages always use the session (CSRF, login state)
    }
    if (!empty($_COOKIE[SESSION_NAME])) {
        header('Cache-Control: private, no-cache'); // header shows login state — never share-cache it
    }
    if (!empty($meta['controller'])) {
        $file = __DIR__ . '/../pages/' . basename($meta['controller']) . '.php';
        $extra = (static fn(array $P) => require $file)($P);
        if (is_array($extra)) {
            $P = array_replace($P, $extra);
        }
    }
    if (!empty($P['private'])) {
        header('Cache-Control: no-store');
        header('X-Robots-Tag: noindex');
    }
    return $P;
}

function page_title(array $P): string
{
    return !empty($P['title']) ? $P['title'] . ' | ' . s('site.name', 'PIPEOX') : (string)s('site.title', 'PIPEOX');
}

function not_found(): never
{
    http_response_code(404);
    require $_SERVER['DOCUMENT_ROOT'] . '/404.php';
    exit;
}

function redirect(string $to): never
{
    header("Location: $to", true, 303);
    exit;
}

/** Absolute URL when the site address is configured, else ''. */
function abs_url(string $path): string
{
    $base = rtrim((string)s('site.url'), '/');
    return $base !== '' ? $base . $path : '';
}

/* ───────── Flash messages (survive one redirect) ───────── */

function flash(?string $msg = null, string $type = 'ok'): ?array
{
    if ($msg !== null) {
        session_boot(true);
        $_SESSION['flash'] = [$msg, $type];
        return null;
    }
    if (!session_boot(false) || empty($_SESSION['flash'])) {
        return null;
    }
    $f = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return $f;
}
