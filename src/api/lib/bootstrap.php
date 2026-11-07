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
            CREATE TABLE IF NOT EXISTS subscribers (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT    NOT NULL DEFAULT (datetime('now')),
                email      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
                ip         TEXT    NOT NULL DEFAULT ''
            );
        SQL);
        migrate($pdo);
    }
    return $pdo;
}

/** Schema v2: site content (edited in the admin panel) + customer accounts. Runs once. */
function migrate(PDO $pdo): void
{
    if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() >= 2) {
        return;
    }
    $pdo->beginTransaction();
    $pdo->exec(<<<SQL
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS products (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            slug         TEXT    NOT NULL UNIQUE,
            title        TEXT    NOT NULL,
            short_title  TEXT    NOT NULL DEFAULT '',
            code         TEXT    NOT NULL DEFAULT '',
            summary      TEXT    NOT NULL DEFAULT '',
            intro        TEXT    NOT NULL DEFAULT '',
            image        TEXT    NOT NULL DEFAULT '',
            alt          TEXT    NOT NULL DEFAULT '',
            keywords     TEXT    NOT NULL DEFAULT '',
            orbit        TEXT    NOT NULL DEFAULT '',
            types        TEXT    NOT NULL DEFAULT '[]',
            specs        TEXT    NOT NULL DEFAULT '[]',
            applications TEXT    NOT NULL DEFAULT '[]',
            sort         INTEGER NOT NULL DEFAULT 0,
            published    INTEGER NOT NULL DEFAULT 1,
            updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS articles (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            slug         TEXT    NOT NULL UNIQUE,
            title        TEXT    NOT NULL,
            description  TEXT    NOT NULL DEFAULT '',
            category     TEXT    NOT NULL DEFAULT '',
            image        TEXT    NOT NULL DEFAULT '',
            image_alt    TEXT    NOT NULL DEFAULT '',
            show_cover   INTEGER NOT NULL DEFAULT 1,
            body         TEXT    NOT NULL DEFAULT '',
            published_at TEXT    NOT NULL DEFAULT (date('now')),
            published    INTEGER NOT NULL DEFAULT 1,
            updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS projects (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            title     TEXT    NOT NULL,
            client    TEXT    NOT NULL DEFAULT '',
            year      TEXT    NOT NULL DEFAULT '',
            industry  TEXT    NOT NULL DEFAULT '',
            scope     TEXT    NOT NULL DEFAULT '',
            image     TEXT    NOT NULL DEFAULT '',
            sort      INTEGER NOT NULL DEFAULT 0,
            published INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
            email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT    NOT NULL,
            name          TEXT    NOT NULL DEFAULT '',
            phone         TEXT    NOT NULL DEFAULT '',
            company       TEXT    NOT NULL DEFAULT '',
            last_login    TEXT,
            active        INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS password_resets (
            token_hash TEXT    PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            expires_at TEXT    NOT NULL
        );
        CREATE TABLE IF NOT EXISTS auth_attempts (
            ip         TEXT NOT NULL,
            kind       TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_attempts ON auth_attempts (ip, kind, created_at);
    SQL);
    $cols = array_column($pdo->query('PRAGMA table_info(inquiries)')->fetchAll(), 'name');
    if (!in_array('user_id', $cols, true)) {
        $pdo->exec('ALTER TABLE inquiries ADD COLUMN user_id INTEGER');
        $pdo->exec('CREATE INDEX idx_inquiries_user ON inquiries (user_id)');
    }
    seed_content($pdo);
    $pdo->exec('PRAGMA user_version = 2');
    $pdo->commit();
}

/** Fresh install: load the starter content exported at build time (api/seed/seed.json). */
function seed_content(PDO $pdo): void
{
    $file = __DIR__ . '/../seed/seed.json';
    if (!is_file($file) || (int)$pdo->query('SELECT COUNT(*) FROM settings')->fetchColumn() > 0) {
        return;
    }
    $seed = json_decode((string)file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
    $j = fn($v) => json_encode($v, JSON_UNESCAPED_UNICODE);

    $q = $pdo->prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    foreach ($seed['settings'] as $k => $v) {
        $q->execute([$k, $j($v)]);
    }
    $q = $pdo->prepare('INSERT INTO products (slug, title, short_title, code, summary, intro, image, alt, keywords, orbit, types, specs, applications, sort)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($seed['products'] as $i => $r) {
        $q->execute([$r['slug'], $r['title'], $r['shortTitle'] ?? '', $r['code'] ?? '', $r['summary'] ?? '', $r['intro'] ?? '',
            $r['image'] ?? '', $r['alt'] ?? '', $r['keywords'] ?? '', $r['orbit'] ?? '',
            $j($r['types'] ?? []), $j($r['specs'] ?? []), $j($r['applications'] ?? []), $i + 1]);
    }
    $q = $pdo->prepare('INSERT INTO articles (slug, title, description, category, image, image_alt, show_cover, body, published_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($seed['articles'] as $r) {
        $q->execute([$r['slug'], $r['title'], $r['description'], $r['category'], $r['image'], $r['imageAlt'], (int)$r['cover'], $r['body'], $r['date']]);
    }
    $q = $pdo->prepare('INSERT INTO projects (title, client, year, industry, scope, image, sort) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($seed['projects'] as $i => $r) {
        $q->execute([$r['title'], $r['client'] ?? '', (string)($r['year'] ?? ''), $r['industry'] ?? '', $r['scope'] ?? '', $r['image'] ?? '', $i + 1]);
    }
}

const STATUSES = [
    'new'       => 'جدید',
    'contacted' => 'تماس گرفته شد',
    'quoted'    => 'پیشنهاد ارسال شد',
    'won'       => 'منجر به فروش',
    'closed'    => 'بسته شد',
];

/** Same statuses as the customer sees them in their account (no internal sales wording). */
const CUSTOMER_STATUSES = [
    'new'       => 'دریافت شد',
    'contacted' => 'در حال بررسی',
    'quoted'    => 'پیشنهاد ارسال شد',
    'won'       => 'انجام شد',
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
