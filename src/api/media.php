<?php
declare(strict_types=1);

/**
 * GET /media/<file> (rewritten here) — serves images uploaded in the admin panel.
 * Files live in the data folder outside the web root, so nothing uploaded can ever execute.
 */

require __DIR__ . '/lib/bootstrap.php';

$name = (string)($_GET['f'] ?? '');
$types = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
$path = data_dir('media') . '/' . basename($name);

if (!preg_match('/^[a-f0-9]{24}\.(jpe?g|png|webp)$/', $name) || !isset($types[$ext]) || !is_file($path)) {
    http_response_code(404);
    exit;
}
$etag = '"' . md5($name . filemtime($path)) . '"';
header('Cache-Control: public, max-age=2592000, immutable');
header('ETag: ' . $etag);
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}
header('Content-Type: ' . $types[$ext]);
header('Content-Length: ' . filesize($path));
header('X-Content-Type-Options: nosniff');
readfile($path);
