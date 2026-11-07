<?php
/** Customer accounts: list, enable/disable, set a new password, delete. */
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $uid = (int)($_POST['id'] ?? 0);
    $action = (string)($_POST['action'] ?? '');
    if ($action === 'toggle') {
        $pdo->prepare('UPDATE users SET active = 1 - active WHERE id = ?')->execute([$uid]);
        admin_flash('وضعیت حساب تغییر کرد.');
    } elseif ($action === 'password') {
        $pw = (string)($_POST['password'] ?? '');
        if ($p = password_problem($pw)) {
            admin_flash($p, 'error');
        } else {
            $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($pw, PASSWORD_DEFAULT), $uid]);
            admin_flash('رمز جدید ثبت شد. آن را از راه امن به مشتری اعلام کنید.');
        }
    } elseif ($action === 'delete') {
        // Inquiries stay in the inbox, just detached from the account
        $pdo->prepare('UPDATE inquiries SET user_id = NULL WHERE user_id = ?')->execute([$uid]);
        $pdo->prepare('DELETE FROM password_resets WHERE user_id = ?')->execute([$uid]);
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);
        admin_flash('حساب حذف شد. استعلام‌های این مشتری در صندوق باقی ماندند.');
    }
    admin_redirect('s=customers');
}

if (isset($_GET['export'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="pipeox-customers-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['نام', 'ایمیل', 'تلفن', 'شرکت', 'تاریخ ثبت‌نام', 'تعداد استعلام']);
    foreach ($pdo->query('SELECT u.*, (SELECT COUNT(*) FROM inquiries i WHERE i.user_id = u.id) n FROM users u ORDER BY u.id DESC') as $r) {
        fputcsv($out, [$r['name'], $r['email'], $r['phone'], $r['company'], fa_date($r['created_at']), $r['n']]);
    }
    exit;
}

$rows = $pdo->query('SELECT u.*, (SELECT COUNT(*) FROM inquiries i WHERE i.user_id = u.id) AS n FROM users u ORDER BY u.id DESC')->fetchAll();

admin_page('مشتریان', 'customers', function () use ($rows) { ?>
  <div class="bar">
    <h1>مشتریان (<?= fa_digits(count($rows)) ?>)</h1>
    <div class="tools"><a class="btn btn-ghost btn-sm" href="?s=customers&export=1">خروجی Excel</a></div>
  </div>
  <?php if (!$rows): ?><p class="empty">هنوز کسی در سایت ثبت‌نام نکرده است. مشتری‌ها از دکمه «ورود / ثبت‌نام» بالای سایت حساب می‌سازند.</p><?php else: ?>
  <table class="table">
    <tr><th>نام</th><th>ایمیل</th><th>تلفن</th><th>شرکت</th><th>ثبت‌نام</th><th>آخرین ورود</th><th>استعلام</th><th>وضعیت</th><th></th></tr>
    <?php foreach ($rows as $r): ?>
    <tr>
      <td><b><?= e($r['name']) ?></b></td>
      <td dir="ltr"><a href="mailto:<?= e($r['email']) ?>"><?= e($r['email']) ?></a></td>
      <td dir="ltr"><?= e($r['phone']) ?></td>
      <td><?= e($r['company']) ?></td>
      <td><?= fa_date($r['created_at']) ?></td>
      <td><?= $r['last_login'] ? fa_date($r['last_login']) : '—' ?></td>
      <td><?= $r['n'] ? '<a href="?s=inquiries&user=' . $r['id'] . '">' . fa_digits($r['n']) . '</a>' : '۰' ?></td>
      <td><?= $r['active'] ? '<span class="pill pill-on">فعال</span>' : '<span class="pill pill-off">غیرفعال</span>' ?></td>
      <td class="actions">
        <form method="post"><input type="hidden" name="csrf" value="<?= csrf() ?>"><input type="hidden" name="id" value="<?= $r['id'] ?>"><input type="hidden" name="action" value="toggle"><button class="btn-ghost btn-sm"><?= $r['active'] ? 'غیرفعال‌سازی' : 'فعال‌سازی' ?></button></form>
        <form method="post" data-confirm="رمز جدید برای این مشتری ثبت شود؟" style="display:flex;gap:4px">
          <input type="hidden" name="csrf" value="<?= csrf() ?>"><input type="hidden" name="id" value="<?= $r['id'] ?>"><input type="hidden" name="action" value="password">
          <input name="password" placeholder="رمز جدید" style="width:110px;padding:4px 8px" minlength="8" required><button class="btn-ghost btn-sm">ثبت</button>
        </form>
        <form method="post" data-confirm="حساب این مشتری حذف شود؟ استعلام‌هایش در صندوق باقی می‌مانند."><input type="hidden" name="csrf" value="<?= csrf() ?>"><input type="hidden" name="id" value="<?= $r['id'] ?>"><input type="hidden" name="action" value="delete"><button class="btn-danger btn-sm">حذف</button></form>
      </td>
    </tr>
    <?php endforeach ?>
  </table>
  <?php endif ?>
<?php });
