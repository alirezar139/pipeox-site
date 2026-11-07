<?php
declare(strict_types=1);

/** Admin panel helpers: CSRF, form fields, image upload, HTML sanitizer, page shell. */

function csrf(): string
{
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(16));
}

function check_csrf(): void
{
    $sent = (string)($_POST['csrf'] ?? $_SERVER['HTTP_X_CSRF'] ?? '');
    if (!hash_equals(csrf(), $sent)) {
        http_response_code(400);
        exit('Invalid request token — reload the page and try again.');
    }
}

function admin_redirect(string $query = ''): never
{
    $self = strtok((string)$_SERVER['REQUEST_URI'], '?');
    header('Location: ' . $self . ($query !== '' ? '?' . $query : ''), true, 303);
    exit;
}

function admin_flash(?string $msg = null, string $type = 'ok'): ?array
{
    if ($msg !== null) {
        $_SESSION['admin_flash'] = [$msg, $type];
        return null;
    }
    $f = $_SESSION['admin_flash'] ?? null;
    unset($_SESSION['admin_flash']);
    return $f;
}

function post_str(string $key, int $max = 2000): string
{
    return clean_text($_POST[$key] ?? '', $max);
}

/** "a | b" per line → [[a, b], …]  (or a list of single values when $cols = 1). */
function parse_lines(string $text, int $cols = 2): array
{
    $out = [];
    foreach (preg_split('/\R/u', $text) as $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        if ($cols === 1) {
            $out[] = $line;
            continue;
        }
        $parts = array_map('trim', explode('|', $line, 2));
        $out[] = [$parts[0], $parts[1] ?? ''];
    }
    return $out;
}

function slugify(string $s): string
{
    $s = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $s) ?? '', '-'));
    return substr($s, 0, 80);
}

/** Validates an uploaded image and stores it in the data folder; returns its public URL (/media/…). */
function store_image(array $file): string
{
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        throw new RuntimeException('بارگذاری تصویر ناموفق بود.');
    }
    if ($file['size'] > 5 * 1024 * 1024) {
        throw new RuntimeException('حجم تصویر حداکثر ۵ مگابایت است.');
    }
    $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: '';
    $info = @getimagesize($file['tmp_name']);
    if (!isset($types[$mime]) || !$info) {
        throw new RuntimeException('فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود.');
    }
    $name = bin2hex(random_bytes(12)) . '.' . $types[$mime];
    $target = data_dir('media') . '/' . $name;

    // Downscale very large photos when GD is available; otherwise keep the original
    if ($info[0] > 2000 && function_exists('imagecreatefromstring') && ($src = @imagecreatefromstring((string)file_get_contents($file['tmp_name'])))) {
        $w = 2000;
        $h = (int)round($info[1] * $w / $info[0]);
        $dst = imagescale($src, $w, $h, IMG_BICUBIC);
        $ok = match ($types[$mime]) {
            'png'  => imagepng($dst, $target, 8),
            'webp' => imagewebp($dst, $target, 82),
            default => imagejpeg($dst, $target, 84),
        };
        if ($ok) {
            return '/media/' . $name;
        }
    }
    if (!move_uploaded_file($file['tmp_name'], $target)) {
        throw new RuntimeException('ذخیره تصویر ناموفق بود.');
    }
    return '/media/' . $name;
}

/** Image field result: new upload > typed path > previous value. */
function image_input(string $field, string $current): string
{
    if (!empty($_FILES[$field . '_file']) && $_FILES[$field . '_file']['error'] !== UPLOAD_ERR_NO_FILE) {
        return store_image($_FILES[$field . '_file']);
    }
    $path = trim((string)($_POST[$field] ?? $current));
    if ($path !== '' && !preg_match('#^/(assets|media)/[A-Za-z0-9/._-]+$#', $path)) {
        throw new RuntimeException('مسیر تصویر نامعتبر است.');
    }
    return $path;
}

/**
 * Article HTML allow-list. Unknown tags are unwrapped (text kept), attributes dropped,
 * links limited to http(s)/mailto/tel/site paths, images to site or https URLs.
 */
function sanitize_html(string $html): string
{
    $allowed = [
        'p' => [], 'br' => [], 'hr' => [], 'h2' => [], 'h3' => [], 'h4' => [], 'strong' => [], 'b' => [], 'em' => [], 'i' => [],
        'ul' => [], 'ol' => [], 'li' => [], 'blockquote' => [], 'code' => [], 'pre' => [], 'figure' => [], 'figcaption' => [],
        'table' => [], 'thead' => [], 'tbody' => [], 'tr' => [], 'th' => [], 'td' => [],
        'a' => ['href'], 'img' => ['src', 'alt'],
    ];
    $doc = new DOMDocument();
    libxml_use_internal_errors(true);
    $doc->loadHTML('<?xml encoding="utf-8"?><div id="root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
    libxml_clear_errors();
    $root = $doc->getElementById('root') ?? $doc->documentElement;

    $walk = function (DOMNode $node) use (&$walk, $allowed, $doc): void {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof DOMComment || $child instanceof DOMProcessingInstruction) {
                $node->removeChild($child);
                continue;
            }
            if (!$child instanceof DOMElement) {
                continue;
            }
            $tag = strtolower($child->tagName);
            if (in_array($tag, ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math', 'template'], true)) {
                $node->removeChild($child);
                continue;
            }
            $walk($child);
            if (!isset($allowed[$tag])) {
                while ($child->firstChild) {
                    $node->insertBefore($child->firstChild, $child);
                }
                $node->removeChild($child);
                continue;
            }
            foreach (iterator_to_array($child->attributes) as $attr) {
                $name = strtolower($attr->name);
                $val = trim($attr->value);
                $ok = in_array($name, $allowed[$tag], true) && match ($name) {
                    'href' => (bool)preg_match('#^(https?://|mailto:|tel:|/(?!/)|\#)#i', $val),
                    'src'  => (bool)preg_match('#^(/(assets|media)/|https://)#i', $val),
                    default => true,
                };
                if (!$ok) {
                    $child->removeAttribute($attr->name);
                }
            }
            if ($tag === 'a' && preg_match('#^https?://#i', $child->getAttribute('href'))) {
                $child->setAttribute('rel', 'noopener nofollow');
                $child->setAttribute('target', '_blank');
            }
            if ($tag === 'img') {
                if (!$child->hasAttribute('src')) {
                    $node->removeChild($child);
                    continue;
                }
                $child->setAttribute('loading', 'lazy');
            }
        }
    };
    $walk($root);
    $out = '';
    foreach ($root->childNodes as $c) {
        $out .= $doc->saveHTML($c);
    }
    return trim($out);
}

function field(string $label, string $name, string $value = '', array $o = []): string
{
    $type = $o['type'] ?? 'text';
    $attrs = ($o['required'] ?? false ? ' required' : '') . (isset($o['dir']) ? ' dir="' . $o['dir'] . '"' : '')
        . (isset($o['pattern']) ? ' pattern="' . e($o['pattern']) . '"' : '') . (isset($o['placeholder']) ? ' placeholder="' . e($o['placeholder']) . '"' : '');
    $hint = isset($o['hint']) ? '<small>' . $o['hint'] . '</small>' : '';
    $wide = ($o['wide'] ?? false) ? ' wide' : '';
    if ($type === 'textarea') {
        $input = '<textarea name="' . $name . '" rows="' . ($o['rows'] ?? 4) . '"' . $attrs . '>' . e($value) . '</textarea>';
    } else {
        $input = '<input type="' . $type . '" name="' . $name . '" value="' . e($value) . '"' . $attrs . '>';
    }
    return '<label class="f' . $wide . '"><span>' . $label . '</span>' . $input . $hint . '</label>';
}

function image_field(string $label, string $name, string $value): string
{
    $preview = $value ? '<img src="' . e($value) . '" alt="">' : '<i>بدون تصویر</i>';
    return '<div class="f wide img-field"><span>' . $label . '</span><div class="img-row">' . $preview
        . '<div><input type="file" name="' . $name . '_file" accept="image/jpeg,image/png,image/webp">'
        . '<input name="' . $name . '" value="' . e($value) . '" dir="ltr" placeholder="/media/… یا /assets/img/…">'
        . '<small>فایل جدید انتخاب کنید یا مسیر را دستی بنویسید. JPG، PNG یا WebP تا ۵ مگابایت.</small></div></div></div>';
}

function checkbox(string $label, string $name, bool $on): string
{
    return '<label class="chk"><input type="checkbox" name="' . $name . '" value="1"' . ($on ? ' checked' : '') . '> ' . $label . '</label>';
}

const ADMIN_SECTIONS = [
    'inquiries'   => 'استعلام‌ها',
    'products'    => 'محصولات',
    'articles'    => 'مقالات و اخبار',
    'projects'    => 'پروژه‌ها',
    'customers'   => 'مشتریان',
    'subscribers' => 'خبرنامه',
    'settings'    => 'تنظیمات سایت',
];

/** Page shell with sidebar navigation. */
function admin_page(string $title, string $section, callable $body): void
{
    $flash = admin_flash();
    $newCount = (int)db()->query("SELECT COUNT(*) FROM inquiries WHERE status = 'new'")->fetchColumn();
    ?>
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title) ?> | پنل PIPEOX</title>
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<style><?php require __DIR__ . '/admin.css'; ?></style>
</head>
<body>
<aside class="side">
  <a class="brand" href="?s=inquiries"><b>PIPEOX</b><small>پنل مدیریت</small></a>
  <nav>
    <?php foreach (ADMIN_SECTIONS as $k => $label): ?>
      <a href="?s=<?= $k ?>" class="<?= $section === $k ? 'on' : '' ?>"><?= $label ?><?php if ($k === 'inquiries' && $newCount): ?> <em><?= $newCount ?></em><?php endif ?></a>
    <?php endforeach ?>
  </nav>
  <div class="side-foot"><a href="/" target="_blank">مشاهده سایت ↗</a><a href="?logout=1">خروج</a></div>
</aside>
<main class="main">
  <?php if ($flash): ?><p class="flash flash-<?= e($flash[1]) ?>"><?= e($flash[0]) ?></p><?php endif ?>
  <?php $body(); ?>
</main>
<script>
  // Confirm destructive actions
  document.addEventListener("submit", (e) => {
    const msg = e.target.dataset.confirm;
    if (msg && !confirm(msg)) e.preventDefault();
  });
</script>
</body>
</html>
<?php }
