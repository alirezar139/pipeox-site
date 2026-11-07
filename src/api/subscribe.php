<?php
declare(strict_types=1);

/**
 * POST /api/subscribe.php — newsletter sign-up.
 * Fields: email, website (honeypot). Responds { ok } or { ok: false, error }.
 * Re-subscribing an existing address is treated as success (no address enumeration).
 */

require __DIR__ . '/lib/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function reply(int $code, array $body): never
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    reply(405, ['ok' => false, 'error' => 'Method not allowed']);
}
if (!empty($_POST['website'])) {
    reply(200, ['ok' => true]);
}

try {
    $pdo = db();
} catch (Throwable $e) {
    error_log('[pipeox] ' . $e->getMessage());
    reply(503, ['ok' => false, 'error' => 'سرویس موقتاً در دسترس نیست.']);
}

$email = strtolower(clean_text($_POST['email'] ?? '', 190));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reply(422, ['ok' => false, 'error' => 'لطفاً یک ایمیل معتبر وارد کنید.']);
}

$ip = client_ip();
$stmt = $pdo->prepare("SELECT COUNT(*) FROM subscribers WHERE ip = ? AND created_at > datetime('now', '-1 hour')");
$stmt->execute([$ip]);
if ((int)$stmt->fetchColumn() >= 5) {
    reply(429, ['ok' => false, 'error' => 'تعداد درخواست‌ها زیاد است. لطفاً بعداً تلاش کنید.']);
}

$pdo->prepare('INSERT OR IGNORE INTO subscribers (email, ip) VALUES (?, ?)')->execute([$email, $ip]);
reply(200, ['ok' => true]);
