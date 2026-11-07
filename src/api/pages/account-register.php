<?php
/** /account/register/ — create a customer account and sign in. */
if (current_user()) {
    redirect('/account/');
}
$error = '';
$field = '';
$old = ['name' => '', 'email' => '', 'phone' => '', 'company' => ''];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $old = [
        'name'    => clean_text($_POST['name'] ?? '', 100),
        'email'   => strtolower(clean_text($_POST['email'] ?? '', 190)),
        'phone'   => normalize_digits(clean_text($_POST['phone'] ?? '', 30)),
        'company' => clean_text($_POST['company'] ?? '', 150),
    ];
    $password = (string)($_POST['password'] ?? '');
    $digits = preg_replace('/\D/', '', $old['phone']);

    if (!csrf_ok()) {
        $error = 'نشست شما منقضی شده است. دوباره تلاش کنید.';
    } elseif (!empty($_POST['website'])) {
        $error = 'درخواست نامعتبر است.'; // honeypot
    } elseif (too_many_attempts('register', 5, 60)) {
        $error = 'تعداد ثبت‌نام از این شبکه زیاد است. بعداً تلاش کنید.';
    } elseif (mb_strlen($old['name']) < 2) {
        [$error, $field] = ['لطفاً نام خود را وارد کنید.', 'name'];
    } elseif (!filter_var($old['email'], FILTER_VALIDATE_EMAIL)) {
        [$error, $field] = ['ایمیل معتبر نیست.', 'email'];
    } elseif (strlen($digits) < 8 || strlen($digits) > 15) {
        [$error, $field] = ['شماره تماس معتبر نیست.', 'phone'];
    } elseif ($p = password_problem($password)) {
        [$error, $field] = [$p, 'password'];
    } else {
        $q = db()->prepare('SELECT 1 FROM users WHERE email = ?');
        $q->execute([$old['email']]);
        if ($q->fetchColumn()) {
            [$error, $field] = ['با این ایمیل قبلاً حساب ساخته شده است. وارد شوید یا رمز را بازیابی کنید.', 'email'];
        } else {
            db()->prepare('INSERT INTO users (email, password_hash, name, phone, company) VALUES (?, ?, ?, ?, ?)')
                ->execute([$old['email'], password_hash($password, PASSWORD_DEFAULT), $old['name'], $old['phone'], $old['company']]);
            $newId = (int)db()->lastInsertId(); // read before any other INSERT
            record_attempt('register');
            login_session($newId);
            flash('حساب شما ساخته شد. خوش آمدید!');
            redirect('/account/');
        }
    }
}
return ['error' => $error, 'field' => $field, 'old' => $old];
