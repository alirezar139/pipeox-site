<?php
/** /account/login/ — email + password sign-in. */
$next = safe_next((string)($_GET['next'] ?? $_POST['next'] ?? ''));
if (current_user()) {
    redirect($next);
}
$error = '';
$email = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(clean_text($_POST['email'] ?? '', 190));
    $password = (string)($_POST['password'] ?? '');
    if (!csrf_ok()) {
        $error = 'نشست شما منقضی شده است. دوباره تلاش کنید.';
    } elseif (too_many_attempts('login', 10, 15)) {
        $error = 'تلاش‌های ناموفق زیادی ثبت شده است. ۱۵ دقیقه دیگر دوباره تلاش کنید.';
    } else {
        $q = db()->prepare('SELECT id, password_hash, active FROM users WHERE email = ?');
        $q->execute([$email]);
        $u = $q->fetch();
        if ($u && $u['active'] && password_verify($password, $u['password_hash'])) {
            if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
                db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
            }
            login_session((int)$u['id']);
            redirect($next);
        }
        record_attempt('login');
        $error = $u && !$u['active'] ? 'این حساب غیرفعال شده است. با پشتیبانی تماس بگیرید.' : 'ایمیل یا رمز عبور اشتباه است.';
    }
}
return ['error' => $error, 'old' => ['email' => $email], 'next' => $next, 'flash' => flash()];
