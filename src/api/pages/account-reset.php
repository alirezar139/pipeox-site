<?php
/** /account/reset/?token=… — set a new password from an emailed link. */
$token = (string)($_GET['token'] ?? $_POST['token'] ?? '');
$userId = reset_token_user($token);
$error = '';
if ($userId && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string)($_POST['password'] ?? '');
    if (!csrf_ok()) {
        $error = 'نشست شما منقضی شده است. دوباره تلاش کنید.';
    } elseif ($p = password_problem($password)) {
        $error = $p;
    } else {
        $pdo = db();
        $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
        $pdo->prepare('DELETE FROM password_resets WHERE user_id = ?')->execute([$userId]);
        login_session($userId);
        flash('رمز عبور شما تغییر کرد.');
        redirect('/account/');
    }
}
return ['valid' => (bool)$userId, 'token' => $token, 'error' => $error];
