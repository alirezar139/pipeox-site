<?php
declare(strict_types=1);

/** Shared setup: config, database, small helpers. */

function config(): array
{
    static $config = null;
    if ($config === null) {
        $file = __DIR__ . '/../config.php';
        if (!is_file($file)) {
            throw new RuntimeException('config.php is missing — copy config.sample.php and fill it in.');
        }
        $config = require $file;
    }
    return $config;
}

function data_dir(string $sub = ''): string
{
    $dir = rtrim(config()['data_dir'], '/\\') . ($sub !== '' ? '/' . $sub : '');
    if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
        throw new RuntimeException("Cannot create data directory: $dir");
    }
    return $dir;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO('sqlite:' . data_dir() . '/pipeox.sqlite', null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA busy_timeout = 3000');
        $pdo->exec(<<<SQL
            CREATE TABLE IF NOT EXISTS inquiries (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
                name            TEXT    NOT NULL,
                phone           TEXT    NOT NULL,
                category        TEXT    NOT NULL DEFAULT '',
                details         TEXT    NOT NULL DEFAULT '',
                attachment_path TEXT,
                attachment_name TEXT,
                page            TEXT    NOT NULL DEFAULT '',
                ip              TEXT    NOT NULL DEFAULT '',
                user_agent      TEXT    NOT NULL DEFAULT '',
                status          TEXT    NOT NULL DEFAULT 'new',
                notes           TEXT    NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_inquiries_ip_time ON inquiries (ip, created_at);
            CREATE INDEX IF NOT EXISTS idx_inquiries_status  ON inquiries (status);
        SQL);
    }
    return $pdo;
}

const STATUSES = [
    'new'       => 'جدید',
    'contacted' => 'تماس گرفته شد',
    'quoted'    => 'پیشنهاد ارسال شد',
    'won'       => 'منجر به فروش',
    'closed'    => 'بسته شد',
];

function client_ip(): string
{
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

function e(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Persian/Arabic-Indic digits → ASCII, so "۰۹۱۲" validates like "0912". */
function normalize_digits(string $s): string
{
    return strtr($s, [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    ]);
}

function clean_text(mixed $value, int $max): string
{
    $s = is_string($value) ? $value : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}
