<?php
/**
 * PIPEOX backend settings.
 * Copy this file to config.php (same folder) and fill in real values.
 * config.php is git-ignored — never commit real passwords or tokens.
 */
return [
    // Where the SQLite DB and uploaded files live. Keep it OUTSIDE public_html:
    // on a typical cPanel host api/ is public_html/api, so ../../ is your home folder.
    'data_dir' => __DIR__ . '/../../pipeox-data',

    // Admin panel (/api/admin.php). Generate a hash with:
    //   php -r "echo password_hash('your-password', PASSWORD_DEFAULT);"
    'admin_password_hash' => '',

    // Abuse limits
    'rate_limit_per_hour' => 5,          // submissions per IP per hour
    'max_upload_mb'       => 8,

    // ---- Notifications: enable any combination ----
    'email' => [
        'enabled' => false,
        'to'      => 'sales@example.com',            // one address, or comma-separated
        'from'    => 'no-reply@example.com',         // must belong to your domain
        // 'mail' uses PHP mail() (works on most cPanel hosts).
        // 'smtp' is more reliable — use your host's or provider's SMTP account.
        'transport' => 'mail',
        'smtp' => [
            'host'       => 'mail.example.com',
            'port'       => 465,                     // 465 = SSL, 587 = STARTTLS
            'encryption' => 'ssl',                   // 'ssl' | 'tls' | ''
            'username'   => 'no-reply@example.com',
            'password'   => '',
        ],
    ],

    // Bale (bale.ai) — reachable from Iranian servers. Create a bot with @botfather in Bale.
    'bale' => [
        'enabled' => false,
        'token'   => '',
        'chat_id' => '',
    ],

    // Telegram — usually blocked from servers inside Iran; use only on a foreign host.
    'telegram' => [
        'enabled' => false,
        'token'   => '',
        'chat_id' => '',
    ],
];
