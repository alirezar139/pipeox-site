<?php
declare(strict_types=1);

/**
 * Minimal inquiry inbox: login, list/filter, change status + notes,
 * download attachments, export CSV (opens in Excel).
 */

require __DIR__ . '/lib/bootstrap.php';

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Strict',
    'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_name('pipeox_admin');
session_start();
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$self = strtok((string)$_SERVER['REQUEST_URI'], '?');
$hash = (string)(config()['admin_password_hash'] ?? '');

function csrf(): string
{
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(16));
}
function check_csrf(): void
{
    if (!hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) {
        http_response_code(400);
        exit('Invalid request token.');
    }
}
function redirect(string $to): never
{
    header("Location: $to", true, 303);
    exit;
}

// ---- Auth ----
if (isset($_GET['logout'])) {
    session_destroy();
    redirect($self);
}
$error = '';
if (empty($_SESSION['admin'])) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
        if ($hash !== '' && password_verify((string)$_POST['password'], $hash)) {
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            redirect($self);
        }
        sleep(1); // slow down guessing
        $error = $hash === '' ? 'رمز مدیریت در config.php تنظیم نشده است.' : 'رمز عبور اشتباه است.';
    }
    render_page('ورود', function () use ($error) { ?>
        <form method="post" class="login">
          <h1>ورود به پنل استعلام‌ها</h1>
          <?php if ($error): ?><p class="err"><?= e($error) ?></p><?php endif ?>
          <input type="password" name="password" placeholder="رمز عبور" autofocus required>
          <button>ورود</button>
        </form>
    <?php });
    exit;
}

$pdo = db();

// ---- Actions ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    $id = (int)($_POST['id'] ?? 0);
    $status = (string)($_POST['status'] ?? '');
    if ($id && isset(STATUSES[$status])) {
        $pdo->prepare('UPDATE inquiries SET status = ?, notes = ? WHERE id = ?')
            ->execute([$status, clean_text($_POST['notes'] ?? '', 2000), $id]);
    }
    redirect($self . (isset($_GET['status']) ? '?status=' . urlencode((string)$_GET['status']) : ''));
}

if (isset($_GET['file'])) {
    $stmt = $pdo->prepare('SELECT attachment_path, attachment_name FROM inquiries WHERE id = ?');
    $stmt->execute([(int)$_GET['file']]);
    $row = $stmt->fetch();
    $path = $row && $row['attachment_path'] ? data_dir('uploads') . '/' . $row['attachment_path'] : '';
    if (!$path || !is_file($path) || str_contains($row['attachment_path'], '..')) {
        http_response_code(404);
        exit('File not found.');
    }
    header('Content-Type: application/octet-stream');
    header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($row['attachment_name']));
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

if (isset($_GET['subscribers'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="pipeox-subscribers-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "ï»¿");
    fputcsv($out, ['ایمیل', 'تاریخ عضویت']);
    foreach ($pdo->query('SELECT email, created_at FROM subscribers ORDER BY id DESC') as $r) {
        fputcsv($out, [$r['email'], $r['created_at']]);
    }
    exit;
}

if (isset($_GET['export'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="pipeox-inquiries-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM so Excel shows Persian correctly
    fputcsv($out, ['شناسه', 'تاریخ', 'نام', 'تلفن', 'گروه محصول', 'توضیحات', 'پیوست', 'وضعیت', 'یادداشت', 'صفحه']);
    foreach ($pdo->query('SELECT * FROM inquiries ORDER BY id DESC') as $r) {
        fputcsv($out, [$r['id'], $r['created_at'], $r['name'], $r['phone'], $r['category'], $r['details'],
            $r['attachment_name'], STATUSES[$r['status']] ?? $r['status'], $r['notes'], $r['page']]);
    }
    exit;
}

// ---- List ----
$filter = (string)($_GET['status'] ?? '');
$counts = $pdo->query('SELECT status, COUNT(*) c FROM inquiries GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR);
$stmt = isset(STATUSES[$filter])
    ? $pdo->prepare('SELECT * FROM inquiries WHERE status = ? ORDER BY id DESC LIMIT 300')
    : $pdo->prepare('SELECT * FROM inquiries ORDER BY id DESC LIMIT 300');
$stmt->execute(isset(STATUSES[$filter]) ? [$filter] : []);
$rows = $stmt->fetchAll();
$subscriberCount = (int)$pdo->query('SELECT COUNT(*) FROM subscribers')->fetchColumn();
$fmt = class_exists('IntlDateFormatter')
    ? new IntlDateFormatter('fa_IR@calendar=persian', IntlDateFormatter::MEDIUM, IntlDateFormatter::SHORT, 'Asia/Tehran', IntlDateFormatter::TRADITIONAL)
    : null;
$date = fn(string $utc) => $fmt ? $fmt->format(new DateTime($utc . ' UTC')) : $utc . ' UTC';

render_page('استعلام‌ها', function () use ($rows, $counts, $filter, $self, $date, $subscriberCount) { ?>
    <header class="bar">
      <h1>استعلام‌ها</h1>
      <nav>
        <a href="<?= e($self) ?>" class="<?= $filter === '' ? 'on' : '' ?>">همه (<?= array_sum($counts) ?>)</a>
        <?php foreach (STATUSES as $k => $label): ?>
          <a href="?status=<?= $k ?>" class="<?= $filter === $k ? 'on' : '' ?>"><?= $label ?> (<?= (int)($counts[$k] ?? 0) ?>)</a>
        <?php endforeach ?>
      </nav>
      <div><a href="?export=1">خروجی Excel</a> · <a href="?subscribers=1">مشترکین خبرنامه (<?= $subscriberCount ?>)</a> · <a href="?logout=1">خروج</a></div>
    </header>
    <?php if (!$rows): ?><p class="empty">درخواستی وجود ندارد.</p><?php endif ?>
    <?php foreach ($rows as $r): ?>
      <article class="card s-<?= e($r['status']) ?>">
        <div class="meta">#<?= $r['id'] ?> · <?= e($date($r['created_at'])) ?><?= $r['page'] ? ' · ' . e($r['page']) : '' ?></div>
        <h2><?= e($r['name']) ?> <a dir="ltr" href="tel:<?= e(preg_replace('/[^\d+]/', '', $r['phone'])) ?>"><?= e($r['phone']) ?></a></h2>
        <?php if ($r['category']): ?><div class="tag"><?= e($r['category']) ?></div><?php endif ?>
        <?php if ($r['details']): ?><p class="details"><?= nl2br(e($r['details'])) ?></p><?php endif ?>
        <?php if ($r['attachment_path']): ?><p><a href="?file=<?= $r['id'] ?>">📎 <?= e($r['attachment_name']) ?></a></p><?php endif ?>
        <form method="post" class="update">
          <input type="hidden" name="csrf" value="<?= csrf() ?>">
          <input type="hidden" name="id" value="<?= $r['id'] ?>">
          <select name="status">
            <?php foreach (STATUSES as $k => $label): ?>
              <option value="<?= $k ?>" <?= $r['status'] === $k ? 'selected' : '' ?>><?= $label ?></option>
            <?php endforeach ?>
          </select>
          <input name="notes" value="<?= e($r['notes']) ?>" placeholder="یادداشت داخلی">
          <button>ذخیره</button>
        </form>
      </article>
    <?php endforeach ?>
<?php });

function render_page(string $title, callable $body): void
{ ?>
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title) ?> | PIPEOX</title>
<style>
  @font-face { font-family: Vazirmatn; src: url("../assets/fonts/vazirmatn-arabic-wght-normal.woff2") format("woff2"); font-weight: 100 900; }
  :root { --bg:#101513; --panel:#171e1a; --line:#ffffff22; --ink:#f3f4ef; --muted:#a5aea6; --orange:#f47b20; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.8 Vazirmatn, Tahoma, sans-serif; padding:20px; }
  a { color:var(--orange); }
  input, select, button { font:inherit; padding:8px 10px; background:#0d120f; color:var(--ink); border:1px solid var(--line); border-radius:3px; }
  button { background:var(--orange); color:#17120e; border-color:var(--orange); font-weight:700; cursor:pointer; }
  .login { max-width:340px; margin:12vh auto; display:grid; gap:12px; background:var(--panel); padding:28px; border:1px solid var(--line); }
  .login h1 { font-size:19px; margin:0; }
  .err { color:#ffb16c; margin:0; }
  .bar { display:flex; flex-wrap:wrap; gap:14px; align-items:center; justify-content:space-between; margin-bottom:18px; }
  .bar h1 { margin:0; font-size:22px; }
  .bar nav { display:flex; flex-wrap:wrap; gap:6px; }
  .bar nav a { color:var(--muted); text-decoration:none; padding:4px 10px; border:1px solid var(--line); border-radius:20px; font-size:13px; }
  .bar nav a.on { color:var(--ink); border-color:var(--orange); }
  .card { background:var(--panel); border:1px solid var(--line); border-inline-start:4px solid var(--muted); padding:14px 18px; margin-bottom:12px; }
  .card.s-new { border-inline-start-color:var(--orange); }
  .card.s-won { border-inline-start-color:#6fcf8f; }
  .card.s-closed { opacity:.65; }
  .card h2 { font-size:17px; margin:2px 0 6px; display:flex; gap:14px; flex-wrap:wrap; }
  .card h2 a { font-weight:400; text-decoration:none; }
  .meta { color:var(--muted); font-size:12px; }
  .tag { display:inline-block; font-size:12px; padding:1px 9px; background:#f47b2022; color:var(--orange); border-radius:10px; }
  .details { white-space:normal; color:#d5dad4; margin:8px 0; }
  .update { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
  .update input[name=notes] { flex:1; min-width:180px; }
  .empty { color:var(--muted); }
</style>
</head>
<body><?php $body() ?></body>
</html>
<?php }
