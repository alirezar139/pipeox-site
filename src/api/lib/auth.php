<?php
declare(strict_types=1);

/**
 * Customer accounts: email + password. The session cookie is only created when
 * someone logs in or submits a form, so ordinary visitors get no cookie.
 */

const SESSION_NAME = 'pipeox_sid';

/** Starts the session. With $create = false, only resumes an existing one. */
function session_boot(bool $create = true): bool
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return true;
    }
    if (!$create && empty($_COOKIE[SESSION_NAME])) {
        return false;
    }
    session_name(SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    ini_set('session.use_strict_mode', '1');
    return session_start();
}

function csrf_token(): string
{
    session_boot(true);
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(16));
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . csrf_token() . '">';
}

function csrf_ok(): bool
{
    return session_boot(false) && hash_equals((string)($_SESSION['csrf'] ?? ''), (string)($_POST['csrf'] ?? ''));
}

function current_user(): ?array
{
    static $user = false;
    if ($user === false) {
        $user = null;
        if (session_boot(false) && !empty($_SESSION['uid'])) {
            $q = db()->prepare('SELECT * FROM users WHERE id = ? AND active = 1');
            $q->execute([(int)$_SESSION['uid']]);
            $user = $q->fetch() ?: null;
            if (!$user) {
                unset($_SESSION['uid']);
            }
        }
    }
    return $user;
}

function require_user(): array
{
    $u = current_user();
    if (!$u) {
        redirect('/account/login/?next=' . rawurlencode((string)($_SERVER['REQUEST_URI'] ?? '/account/')));
    }
    return $u;
}

function login_session(int $userId): void
{
    session_boot(true);
    session_regenerate_id(true);
    $_SESSION['uid'] = $userId;
    db()->prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?")->execute([$userId]);
}

function logout_session(): void
{
    if (session_boot(false)) {
        $_SESSION = [];
        session_destroy();
        setcookie(SESSION_NAME, '', ['expires' => 1, 'path' => '/']);
    }
}

/** Only allow local redirect targets after login. */
function safe_next(string $next, string $fallback = '/account/'): string
{
    return preg_match('#^/(?![/\\\\])[^\s]*$#', $next) ? $next : $fallback;
}

/* ───────── Brute-force protection ───────── */

function too_many_attempts(string $kind, int $max, int $minutes): bool
{
    $q = db()->prepare("SELECT COUNT(*) FROM auth_attempts WHERE ip = ? AND kind = ? AND created_at > datetime('now', ?)");
    $q->execute([client_ip(), $kind, "-$minutes minutes"]);
    return (int)$q->fetchColumn() >= $max;
}

function record_attempt(string $kind): void
{
    $pdo = db();
    $pdo->prepare('INSERT INTO auth_attempts (ip, kind) VALUES (?, ?)')->execute([client_ip(), $kind]);
    if (random_int(1, 50) === 1) {
        $pdo->exec("DELETE FROM auth_attempts WHERE created_at < datetime('now', '-1 day')");
    }
}

/* ───────── Password reset ───────── */

function create_reset_token(int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $pdo = db();
    $pdo->prepare('DELETE FROM password_resets WHERE user_id = ? OR expires_at < datetime(\'now\')')->execute([$userId]);
    $pdo->prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))")
        ->execute([hash('sha256', $token), $userId]);
    return $token;
}

/** Returns the user id for a valid, unexpired token. */
function reset_token_user(string $token): ?int
{
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        return null;
    }
    $q = db()->prepare("SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > datetime('now')");
    $q->execute([hash('sha256', $token)]);
    $id = $q->fetchColumn();
    return $id === false ? null : (int)$id;
}

function password_problem(string $pw): ?string
{
    if (mb_strlen($pw) < 8) {
        return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
    }
    if (mb_strlen($pw) > 200) {
        return 'رمز عبور بیش از حد طولانی است.';
    }
    return null;
}
