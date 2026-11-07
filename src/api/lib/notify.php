<?php
declare(strict_types=1);

/**
 * Sends a new-inquiry alert to every enabled channel.
 * Returns [channel => true|error string]. A failing channel never blocks the others,
 * and the inquiry is already saved in the DB before this runs.
 */
function notify_inquiry(array $inq): array
{
    $cfg = config();
    $text = inquiry_text($inq);
    $results = [];

    if (!empty($cfg['email']['enabled'])) {
        $results['email'] = try_channel(fn() => send_email($cfg['email'], 'استعلام جدید از وب‌سایت: ' . $inq['name'], $text));
    }
    if (!empty($cfg['bale']['enabled'])) {
        $results['bale'] = try_channel(fn() => send_bot('https://tapi.bale.ai', $cfg['bale'], $text));
    }
    if (!empty($cfg['telegram']['enabled'])) {
        $results['telegram'] = try_channel(fn() => send_bot('https://api.telegram.org', $cfg['telegram'], $text));
    }
    foreach ($results as $channel => $r) {
        if ($r !== true) {
            error_log("[pipeox] notify via $channel failed: $r");
        }
    }
    return $results;
}

function try_channel(callable $fn): bool|string
{
    try {
        $fn();
        return true;
    } catch (Throwable $e) {
        return $e->getMessage();
    }
}

function inquiry_text(array $i): string
{
    $lines = [
        "📥 استعلام جدید #{$i['id']}",
        "نام: {$i['name']}",
        "تلفن: {$i['phone']}",
        'گروه محصول: ' . ($i['category'] !== '' ? $i['category'] : 'ذکر نشده'),
    ];
    if ($i['details'] !== '') {
        $lines[] = "توضیحات:\n{$i['details']}";
    }
    if (!empty($i['attachment_name'])) {
        $lines[] = "پیوست: {$i['attachment_name']} (در پنل مدیریت)";
    }
    if ($i['page'] !== '') {
        $lines[] = "صفحه: {$i['page']}";
    }
    return implode("\n", $lines);
}

/** Bale and Telegram share the same Bot API shape. */
function send_bot(string $base, array $bot, string $text): void
{
    if (empty($bot['token']) || empty($bot['chat_id'])) {
        throw new RuntimeException('token/chat_id not set');
    }
    $ch = curl_init("$base/bot{$bot['token']}/sendMessage");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query(['chat_id' => $bot['chat_id'], 'text' => $text]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $body = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($body === false) {
        throw new RuntimeException("network: $err");
    }
    $json = json_decode((string)$body, true);
    if ($code !== 200 || empty($json['ok'])) {
        throw new RuntimeException("HTTP $code: " . mb_substr((string)$body, 0, 200));
    }
}

function send_email(array $mail, string $subject, string $body): void
{
    $to = array_filter(array_map('trim', explode(',', (string)$mail['to'])));
    if (!$to || empty($mail['from'])) {
        throw new RuntimeException('email to/from not set');
    }
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = [
        'From'                      => "PIPEOX <{$mail['from']}>",
        'MIME-Version'              => '1.0',
        'Content-Type'              => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => 'base64',
    ];
    $encodedBody = chunk_split(base64_encode($body));

    if (($mail['transport'] ?? 'mail') === 'smtp') {
        require_once __DIR__ . '/smtp.php';
        smtp_send($mail['smtp'], $mail['from'], $to, $encodedSubject, $headers, $encodedBody);
        return;
    }
    $headerLines = implode("\r\n", array_map(fn($k, $v) => "$k: $v", array_keys($headers), $headers));
    if (!mail(implode(', ', $to), $encodedSubject, $encodedBody, $headerLines, '-f' . $mail['from'])) {
        throw new RuntimeException('mail() returned false');
    }
}
