<?php
/** /account/ — customer dashboard: inquiries + status, profile, password, logout. */
$me = require_user();
$pdo = db();
$error = '';
$tab = (string)($_POST['action'] ?? '');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) {
        $error = 'نشست شما منقضی شده است. دوباره تلاش کنید.';
    } elseif ($tab === 'logout') {
        logout_session();
        redirect('/');
    } elseif ($tab === 'profile') {
        $name = clean_text($_POST['name'] ?? '', 100);
        $phone = normalize_digits(clean_text($_POST['phone'] ?? '', 30));
        $company = clean_text($_POST['company'] ?? '', 150);
        $digits = preg_replace('/\D/', '', $phone);
        if (mb_strlen($name) < 2) {
            $error = 'لطفاً نام خود را وارد کنید.';
        } elseif (strlen($digits) < 8 || strlen($digits) > 15) {
            $error = 'شماره تماس معتبر نیست.';
        } else {
            $pdo->prepare('UPDATE users SET name = ?, phone = ?, company = ? WHERE id = ?')->execute([$name, $phone, $company, $me['id']]);
            flash('اطلاعات حساب ذخیره شد.');
            redirect('/account/#profile');
        }
    } elseif ($tab === 'password') {
        if (!password_verify((string)($_POST['current'] ?? ''), $me['password_hash'])) {
            $error = 'رمز عبور فعلی درست نیست.';
        } elseif ($p = password_problem((string)($_POST['password'] ?? ''))) {
            $error = $p;
        } else {
            $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                ->execute([password_hash((string)$_POST['password'], PASSWORD_DEFAULT), $me['id']]);
            session_regenerate_id(true);
            flash('رمز عبور تغییر کرد.');
            redirect('/account/#password');
        }
    }
}

$q = $pdo->prepare('SELECT id, created_at, category, details, attachment_name, status FROM inquiries WHERE user_id = ? ORDER BY id DESC');
$q->execute([$me['id']]);

return [
    'me'        => $me,
    'inquiries' => $q->fetchAll(),
    'error'     => $error,
    'tab'       => $tab,
    'flash'     => flash(),
];
