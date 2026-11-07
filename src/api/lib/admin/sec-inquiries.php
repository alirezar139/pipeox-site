<?php
/** Inquiries inbox: filter by status/customer, update status + notes, download attachments, CSV export. */
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = (int)($_POST['id'] ?? 0);
    $status = (string)($_POST['status'] ?? '');
    if ($id && isset(STATUSES[$status])) {
        $pdo->prepare('UPDATE inquiries SET status = ?, notes = ? WHERE id = ?')->execute([$status, post_str('notes'), $id]);
        admin_flash("درخواست #$id به‌روزرسانی شد.");
    }
    admin_redirect(http_build_query(array_filter(['s' => 'inquiries', 'status' => $_GET['status'] ?? null, 'user' => $_GET['user'] ?? null])));
}

if (isset($_GET['file'])) {
    $q = $pdo->prepare('SELECT attachment_path, attachment_name FROM inquiries WHERE id = ?');
    $q->execute([(int)$_GET['file']]);
    $row = $q->fetch();
    $path = $row && $row['attachment_path'] ? data_dir('uploads') . '/' . $row['attachment_path'] : '';
    if (!$path || str_contains($row['attachment_path'], '..') || !is_file($path)) {
        http_response_code(404);
        exit('File not found.');
    }
    header('Content-Type: application/octet-stream');
    header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($row['attachment_name']));
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

if (isset($_GET['export'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="pipeox-inquiries-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM so Excel shows Persian correctly
    fputcsv($out, ['شناسه', 'تاریخ', 'نام', 'تلفن', 'ایمیل حساب', 'گروه محصول', 'توضیحات', 'پیوست', 'وضعیت', 'یادداشت', 'صفحه']);
    foreach ($pdo->query('SELECT i.*, u.email FROM inquiries i LEFT JOIN users u ON u.id = i.user_id ORDER BY i.id DESC') as $r) {
        fputcsv($out, [$r['id'], fa_datetime($r['created_at']), $r['name'], $r['phone'], $r['email'], $r['category'], $r['details'],
            $r['attachment_name'], STATUSES[$r['status']] ?? $r['status'], $r['notes'], $r['page']]);
    }
    exit;
}

$filter = (string)($_GET['status'] ?? '');
$userId = (int)($_GET['user'] ?? 0);
$where = [];
$args = [];
if (isset(STATUSES[$filter])) {
    $where[] = 'i.status = ?';
    $args[] = $filter;
}
if ($userId) {
    $where[] = 'i.user_id = ?';
    $args[] = $userId;
}
$q = $pdo->prepare('SELECT i.*, u.email AS user_email FROM inquiries i LEFT JOIN users u ON u.id = i.user_id'
    . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY i.id DESC LIMIT 300');
$q->execute($args);
$rows = $q->fetchAll();
$counts = $pdo->query('SELECT status, COUNT(*) c FROM inquiries GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR);

admin_page('استعلام‌ها', 'inquiries', function () use ($rows, $counts, $filter, $userId) { ?>
  <div class="bar">
    <h1>استعلام‌ها<?= $userId && $rows ? ' — ' . e($rows[0]['user_email'] ?? '') : '' ?></h1>
    <div class="tools"><a class="btn btn-ghost btn-sm" href="?s=inquiries&export=1">خروجی Excel</a></div>
  </div>
  <nav class="chips">
    <a href="?s=inquiries" class="<?= $filter === '' && !$userId ? 'on' : '' ?>">همه (<?= array_sum($counts) ?>)</a>
    <?php foreach (STATUSES as $k => $label): ?>
      <a href="?s=inquiries&status=<?= $k ?>" class="<?= $filter === $k ? 'on' : '' ?>"><?= $label ?> (<?= (int)($counts[$k] ?? 0) ?>)</a>
    <?php endforeach ?>
  </nav>
  <?php if (!$rows): ?><p class="empty">درخواستی وجود ندارد.</p><?php endif ?>
  <?php foreach ($rows as $r): ?>
    <article class="card s-<?= e($r['status']) ?>">
      <div class="meta">#<?= $r['id'] ?> · <?= e(fa_datetime($r['created_at'])) ?><?= $r['page'] ? ' · ' . e($r['page']) : '' ?></div>
      <h2><?= e($r['name']) ?> <a dir="ltr" href="tel:<?= e(tel_href($r['phone'])) ?>"><?= e($r['phone']) ?></a>
        <?php if ($r['user_email']): ?><a class="pill pill-orange" href="?s=inquiries&user=<?= (int)$r['user_id'] ?>" title="همه درخواست‌های این مشتری"><?= e($r['user_email']) ?></a><?php endif ?>
      </h2>
      <?php if ($r['category']): ?><div class="tag"><?= e($r['category']) ?></div><?php endif ?>
      <?php if ($r['details']): ?><p class="details"><?= nl2br(e($r['details'])) ?></p><?php endif ?>
      <?php if ($r['attachment_path']): ?><p><a href="?s=inquiries&file=<?= $r['id'] ?>">📎 <?= e($r['attachment_name']) ?></a></p><?php endif ?>
      <form method="post" class="update">
        <input type="hidden" name="csrf" value="<?= csrf() ?>">
        <input type="hidden" name="id" value="<?= $r['id'] ?>">
        <select name="status">
          <?php foreach (STATUSES as $k => $label): ?>
            <option value="<?= $k ?>" <?= $r['status'] === $k ? 'selected' : '' ?>><?= $label ?></option>
          <?php endforeach ?>
        </select>
        <input name="notes" value="<?= e($r['notes']) ?>" placeholder="یادداشت داخلی (مشتری نمی‌بیند)">
        <button>ذخیره</button>
      </form>
    </article>
  <?php endforeach ?>
<?php });
