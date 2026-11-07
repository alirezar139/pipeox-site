<?php
/** /account/forgot/ — emails a one-hour reset link. The reply never reveals whether an address is registered. */
require_once __DIR__ . '/../lib/notify.php';

$sent = false;
$error = '';
$mailOn = !empty(config()['email']['enabled']);
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(clean_text($_POST['email'] ?? '', 190));
    if (!csrf_ok()) {
        $error = 'نشست شما منقضی شده است. دوباره تلاش کنید.';
    } elseif (too_many_attempts('forgot', 5, 60)) {
        $error = 'درخواست‌های زیادی ثبت شده است. بعداً تلاش کنید.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'ایمیل معتبر نیست.';
    } else {
        record_attempt('forgot');
        $q = db()->prepare('SELECT id, name FROM users WHERE email = ? AND active = 1');
        $q->execute([$email]);
        if (($u = $q->fetch()) && $mailOn) {
            $base = abs_url('') ?: ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST']);
            $link = $base . '/account/reset/?token=' . create_reset_token((int)$u['id']);
            try {
                send_email(['to' => $email] + config()['email'], 'بازیابی رمز عبور PIPEOX',
                    "سلام {$u['name']}،\n\nبرای تعیین رمز عبور جدید روی پیوند زیر بزنید (تا یک ساعت معتبر است):\n$link\n\nاگر این درخواست را شما نداده‌اید، این ایمیل را نادیده بگیرید.");
            } catch (Throwable $e) {
                error_log('[pipeox] reset email: ' . $e->getMessage());
            }
        }
        $sent = true;
    }
}
return ['sent' => $sent, 'error' => $error, 'mailOn' => $mailOn];
