<?php
declare(strict_types=1);

/**
 * POST /api/inquiry.php  (multipart/form-data)
 * Fields: name, phone, category?, details?, attachment? (file), page?, website (honeypot)
 * Responds with JSON: { ok: true, id } or { ok: false, error, field? }
 */

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/notify.php';
require __DIR__ . '/lib/auth.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $code, array $body): never
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Method not allowed']);
}

try {
    $cfg = config();
    $pdo = db();
} catch (Throwable $e) {
    error_log('[pipeox] ' . $e->getMessage());
    respond(503, ['ok' => false, 'error' => 'سرویس موقتاً در دسترس نیست.']);
}

// Body larger than post_max_size arrives as an empty $_POST
if (empty($_POST) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    respond(413, ['ok' => false, 'error' => 'حجم فایل بیش از حد مجاز است.', 'field' => 'attachment']);
}

// Honeypot: real users never see or fill this field. Pretend success to bots.
if (!empty($_POST['website'])) {
    respond(200, ['ok' => true, 'id' => 0]);
}

$ip = client_ip();
$stmt = $pdo->prepare("SELECT COUNT(*) FROM inquiries WHERE ip = ? AND created_at > datetime('now', '-1 hour')");
$stmt->execute([$ip]);
if ((int)$stmt->fetchColumn() >= (int)$cfg['rate_limit_per_hour']) {
    respond(429, ['ok' => false, 'error' => 'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید.']);
}

// ---- Validate ----
$name     = clean_text($_POST['name'] ?? '', 100);
$phone    = normalize_digits(clean_text($_POST['phone'] ?? '', 30));
$category = clean_text($_POST['category'] ?? '', 100);
$details  = clean_text($_POST['details'] ?? '', 3000);
$page     = clean_text($_POST['page'] ?? '', 200);

if (mb_strlen($name) < 2) {
    respond(422, ['ok' => false, 'error' => 'لطفاً نام خود را وارد کنید.', 'field' => 'name']);
}
$digits = preg_replace('/\D/', '', $phone);
if (strlen($digits) < 8 || strlen($digits) > 15 || preg_match('/[^\d\s+\-()]/', $phone)) {
    respond(422, ['ok' => false, 'error' => 'شماره تماس معتبر نیست.', 'field' => 'phone']);
}

// ---- Optional attachment ----
$attachmentPath = null;
$attachmentName = null;
$file = $_FILES['attachment'] ?? null;

if ($file && $file['error'] !== UPLOAD_ERR_NO_FILE) {
    $maxBytes = (int)$cfg['max_upload_mb'] * 1024 * 1024;
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE || $file['size'] > $maxBytes) {
        respond(413, ['ok' => false, 'error' => "حداکثر حجم فایل {$cfg['max_upload_mb']} مگابایت است.", 'field' => 'attachment']);
    }
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        respond(400, ['ok' => false, 'error' => 'بارگذاری فایل ناموفق بود.', 'field' => 'attachment']);
    }

    // Extension AND detected content type must both be on the allow-list
    $allowed = [
        'pdf'  => ['application/pdf'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'],
        'xls'  => ['application/vnd.ms-excel', 'application/CDFV2', 'application/x-ole-storage', 'application/octet-stream'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
        'doc'  => ['application/msword', 'application/CDFV2', 'application/x-ole-storage', 'application/octet-stream'],
        'csv'  => ['text/csv', 'text/plain', 'application/csv'],
        'jpg'  => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png'  => ['image/png'],
    ];
    $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: '';
    if (!isset($allowed[$ext]) || !in_array($mime, $allowed[$ext], true)) {
        respond(415, ['ok' => false, 'error' => 'فقط فایل‌های PDF، Excel، Word، CSV یا تصویر پذیرفته می‌شوند.', 'field' => 'attachment']);
    }

    // Stored under a random name; the original name is kept only for display
    $stored = date('Ym') . '/' . bin2hex(random_bytes(16)) . '.' . $ext;
    $target = data_dir('uploads/' . date('Ym')) . '/' . basename($stored);
    if (!move_uploaded_file($file['tmp_name'], $target)) {
        respond(500, ['ok' => false, 'error' => 'ذخیره فایل ناموفق بود.']);
    }
    $attachmentPath = $stored;
    $attachmentName = mb_substr(basename((string)$file['name']), 0, 150);
}

// ---- Save, then notify ----
$stmt = $pdo->prepare(
    'INSERT INTO inquiries (name, phone, category, details, attachment_path, attachment_name, page, ip, user_agent, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    $name, $phone, $category, $details, $attachmentPath, $attachmentName, $page,
    $ip, mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300),
    current_user()['id'] ?? null, // logged-in customers see it in their account
]);
$id = (int)$pdo->lastInsertId();

notify_inquiry(compact('id', 'name', 'phone', 'category', 'details', 'page') + ['attachment_name' => $attachmentName]);

respond(200, ['ok' => true, 'id' => $id]);
