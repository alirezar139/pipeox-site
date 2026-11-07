<?php
/**
 * Router for PHP's built-in server — mirrors src/.htaccess so the site runs locally like on Apache.
 *   php -S localhost:8090 -t dist scripts/dev-router.php
 */
$root = $_SERVER['DOCUMENT_ROOT'];
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');

$run = function (string $file, array $get = []) use ($root): bool {
    $_GET += $get;
    $_SERVER['SCRIPT_FILENAME'] = $root . $file;
    chdir(dirname($root . $file));
    require $root . $file;
    return true;
};

// Private folders (Apache denies these via .htaccess)
if (preg_match('#^/api/(lib|pages|seed)/|^/api/config|\.htaccess$|\.user\.ini$#', $path)) {
    http_response_code(403);
    exit('Forbidden');
}
if (preg_match('#^/products/([a-z0-9-]+)/?$#', $path, $m)) {
    return $run('/products/item.php', ['slug' => $m[1]]);
}
if (preg_match('#^/insights/([a-z0-9-]+)/?$#', $path, $m)) {
    return $run('/insights/item.php', ['slug' => $m[1]]);
}
if (preg_match('#^/media/([A-Za-z0-9._-]+)$#', $path, $m)) {
    return $run('/api/media.php', ['f' => $m[1]]);
}
if ($path === '/sitemap.xml') {
    return $run('/sitemap.php');
}
if ($path === '/robots.txt') {
    return $run('/robots.php');
}
if (is_dir($root . $path)) {
    if (!str_ends_with($path, '/')) {
        header('Location: ' . $path . '/', true, 301);
        return true;
    }
    if (is_file($root . $path . 'index.php')) {
        return $run($path . 'index.php');
    }
}
if (is_file($root . $path)) {
    return false; // static file or .php script: let the server handle it
}
http_response_code(404);
return $run('/404.php');
