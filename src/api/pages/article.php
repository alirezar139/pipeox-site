<?php
/** /insights/<slug>/ — loads a published article or 404s. */
$article = article((string)($_GET['slug'] ?? ''));
if (!$article) {
    not_found();
}
$url = '/insights/' . $article['slug'] . '/';
return [
    'article'     => $article,
    'url'         => $url,
    'title'       => $article['title'],
    'description' => $article['description'],
    'breadcrumbs' => [
        ['label' => 'خانه', 'url' => '/'],
        ['label' => 'دانش فنی', 'url' => '/insights/'],
        ['label' => $article['title'], 'url' => $url],
    ],
    'jsonld'      => array_filter([
        '@context'      => 'https://schema.org',
        '@type'         => 'Article',
        'headline'      => $article['title'],
        'description'   => $article['description'],
        'datePublished' => $article['published_at'],
        'dateModified'  => substr($article['updated_at'], 0, 10),
        'image'         => $article['image'] ? (abs_url($article['image']) ?: null) : null,
        'publisher'     => ['@type' => 'Organization', 'name' => s('site.name')],
    ]),
];
