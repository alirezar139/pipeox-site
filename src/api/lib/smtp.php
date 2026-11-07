<?php
declare(strict_types=1);

/**
 * Minimal SMTP client (AUTH LOGIN over SSL or STARTTLS) — enough for sending
 * plain-text notifications without pulling in a Composer dependency.
 */
function smtp_send(array $s, string $from, array $to, string $subject, array $headers, string $body): void
{
    $enc = $s['encryption'] ?? 'ssl';
    $host = ($enc === 'ssl' ? 'ssl://' : '') . $s['host'];
    $fp = @stream_socket_client("$host:{$s['port']}", $errno, $errstr, 10);
    if (!$fp) {
        throw new RuntimeException("SMTP connect failed: $errstr ($errno)");
    }
    stream_set_timeout($fp, 10);

    $read = function () use ($fp): string {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };
    $cmd = function (?string $line, int $expect) use ($fp, $read): string {
        if ($line !== null) {
            fwrite($fp, $line . "\r\n");
        }
        $resp = $read();
        if ((int)substr($resp, 0, 3) !== $expect) {
            throw new RuntimeException('SMTP error: ' . trim($resp));
        }
        return $resp;
    };

    try {
        $cmd(null, 220);
        $ehlo = 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost');
        $cmd($ehlo, 250);
        if ($enc === 'tls') {
            $cmd('STARTTLS', 220);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('STARTTLS negotiation failed');
            }
            $cmd($ehlo, 250);
        }
        if (!empty($s['username'])) {
            $cmd('AUTH LOGIN', 334);
            $cmd(base64_encode($s['username']), 334);
            $cmd(base64_encode((string)$s['password']), 235);
        }
        $cmd("MAIL FROM:<$from>", 250);
        foreach ($to as $rcpt) {
            $cmd("RCPT TO:<$rcpt>", 250);
        }
        $cmd('DATA', 354);

        $headers += [
            'To'         => implode(', ', $to),
            'Subject'    => $subject,
            'Date'       => date('r'),
            'Message-ID' => '<' . bin2hex(random_bytes(12)) . '@' . substr(strrchr($from, '@') ?: '@localhost', 1) . '>',
        ];
        $msg = '';
        foreach ($headers as $k => $v) {
            $msg .= "$k: $v\r\n";
        }
        $msg .= "\r\n" . str_replace("\n.", "\n..", $body);
        $cmd($msg . "\r\n.", 250);
        $cmd('QUIT', 221);
    } finally {
        fclose($fp);
    }
}
