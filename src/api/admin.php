<?php
declare(strict_types=1);

/**
 * Admin panel — /api/admin.php?s=<section>
 * One admin password (config.php → admin_password_hash). Sections live in lib/admin/sec-*.php:
 * inquiries, products, articles, projects, customers, subscribers, settings.
 */

require __DIR__ . '/lib/site.php'; // db, formatting helpers
require __DIR__ . '/lib/admin/kit.php';

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Strict',
    'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_name('pipeox_admin');
session_start();
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');

// ---- Auth ----
if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    admin_redirect();
}
if (empty($_SESSION['admin'])) {
    $hash = (string)(config()['admin_password_hash'] ?? '');
    $error = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
        if ($hash !== '' && password_verify((string)$_POST['password'], $hash)) {
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            admin_redirect();
        }
        sleep(1); // slow down guessing
        $error = $hash === '' ? 'رمز مدیریت در config.php تنظیم نشده است.' : 'رمز عبور اشتباه است.';
    } ?>
<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>ورود | پنل PIPEOX</title>
<style><?php require __DIR__ . '/lib/admin/admin.css'; ?></style></head>
<body class="login-body">
  <form method="post" class="login">
    <h1>ورود به پنل مدیریت</h1>
    <?php if ($error): ?><p class="err"><?= e($error) ?></p><?php endif ?>
    <input type="password" name="password" placeholder="رمز عبور" autofocus required>
    <button>ورود</button>
  </form>
</body></html>
<?php
    exit;
}

// ---- Route to a section ----
$section = (string)($_GET['s'] ?? 'inquiries');
if ($section === 'upload') {
    // Image upload from the article editor → JSON { url }
    check_csrf();
    header('Content-Type: application/json; charset=utf-8');
    try {
        echo json_encode(['url' => store_image($_FILES['image'] ?? ['error' => UPLOAD_ERR_NO_FILE])]);
    } catch (Throwable $e) {
        http_response_code(422);
        echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
    exit;
}
if (!isset(ADMIN_SECTIONS[$section])) {
    $section = 'inquiries';
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
}
require __DIR__ . '/lib/admin/sec-' . $section . '.php';
