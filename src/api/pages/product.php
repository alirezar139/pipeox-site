<?php
/** /products/<slug>/ — loads the product or 404s. Receives $P (front matter). */
$product = product((string)($_GET['slug'] ?? ''));
if (!$product) {
    not_found();
}
$url = '/products/' . $product['slug'] . '/';
return [
    'product'         => $product,
    'url'             => $url,
    'title'           => $product['title'],
    'description'     => excerpt($product['intro'] ?: $product['summary'], 155),
    'eyebrow'         => $product['code'],
    'lead'            => $product['summary'],
    'selectedProduct' => $product['title'],
    'formTitle'       => 'استعلام ' . $product['title'],
    'breadcrumbs'     => [
        ['label' => 'خانه', 'url' => '/'],
        ['label' => 'محصولات', 'url' => '/products/'],
        ['label' => $product['title'], 'url' => $url],
    ],
];
