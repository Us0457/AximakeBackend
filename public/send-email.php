<?php
/**
 * send-email.php
 * Clean, secure contact form mail handler using PHPMailer + Hostinger SMTP
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/../vendor/autoload.php';

// small .env loader to make sure getenv works when running locally
$envPath = dirname(__DIR__) . '/.env';
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($k, $v) = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v);
        if ((strlen($v) >= 2) && (($v[0] === '"' && $v[strlen($v)-1] === '"') || ($v[0] === "'" && $v[strlen($v)-1] === "'"))) {
            $v = substr($v, 1, -1);
        }
        putenv("$k=$v");
        $_ENV[$k] = $v;
    }
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

// -----------------------------
// 1️⃣ INPUT VALIDATION
// -----------------------------
$name    = trim((string)($_POST['name'] ?? $_POST['home-contact-name'] ?? ''));
$email   = trim((string)($_POST['email'] ?? $_POST['home-contact-email'] ?? ''));
$message = trim((string)($_POST['message'] ?? $_POST['home-contact-message'] ?? ''));

if ($name === '' || $email === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please enter a valid email address.']);
    exit;
}

// Prevent header injection
$name    = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
$message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');

// -----------------------------
// 2️⃣ MAIL SETUP
// -----------------------------
$smtpHost = getenv('SMTP_HOST') ?: 'smtp.hostinger.com';
$smtpUser = getenv('SMTP_USER') ?: 'admin@aximake.in';
$smtpPass = getenv('SMTP_PASS') ?: '';
$smtpPort = getenv('SMTP_PORT') ? intval(getenv('SMTP_PORT')) : 465;

try {
    $mail = new PHPMailer(true);
    // Keep debug off in production by default. Provide a Debugoutput callable
    // so debug lines can be captured when we enable debug on error.
    $mail->SMTPDebug = 0;
    $mail->Debugoutput = function($str, $level) {
        file_put_contents(__DIR__ . '/smtp-debug.log', date('Y-m-d H:i:s') . ' - ' . trim($str) . PHP_EOL, FILE_APPEND);
    };
    // SMTP configuration (Hostinger)
    $mail->isSMTP();
    $mail->Host       = $smtpHost;
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtpUser;          // MUST match mailbox
    $mail->Password   = $smtpPass;          // from .env
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // SSL
    $mail->Port       = $smtpPort;

    // Encoding
    $mail->CharSet = 'UTF-8';

    // Headers (IMPORTANT)
    $mailFromName = getenv('SMTP_FROM_NAME') ?: 'Aximake 3D Printing';
    $mail->setFrom($smtpUser, $mailFromName);
    // Ensure envelope sender matches authenticated mailbox (helps deliverability)
    $mail->Sender = $smtpUser;
    $mail->addReplyTo($email, $name);
    $mail->addAddress(getenv('CONTACT_RECIPIENT') ?: $smtpUser); // Where messages are received

    // Optional: BCC support email
    $support = getenv('SUPPORT_EMAIL');
    if ($support && $support !== getenv('CONTACT_RECIPIENT')) {
        $mail->addBCC($support);
    }

    // -----------------------------
    // 3️⃣ EMAIL CONTENT
    // -----------------------------
    $mail->isHTML(true);
    $mail->Subject = 'New Contact Form Message – Aximake';

    $bodyHtml = "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e2e8f0;border-radius:8px;'>" .
        "<h2 style='color:#2d3748;'>New Contact Form Submission</h2>" .
        "<p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>" .
        "<p><strong>Email:</strong> " . htmlspecialchars($email) . "</p>" .
        "<p><strong>Message:</strong></p>" .
        "<p style='white-space:pre-line;'>" . nl2br(htmlspecialchars($message)) . "</p>" .
        "<hr style='margin-top:24px;'>" .
        "<p style='font-size:13px;color:#718096;'>Sent from aximake.in contact form</p>" .
        "</div>";

    $mail->Body = $bodyHtml;
    $mail->AltBody = "New Contact Form Submission\n\nName: {$name}\nEmail: {$email}\n\nMessage:\n{$message}\n";

    // -----------------------------
    // 4️⃣ SEND MAIL
    // -----------------------------
    $mail->send();

    echo json_encode([
        'success' => true,
        'message' => 'Thank you for contacting us. Your message has been sent successfully.'
    ]);
    exit;

} catch (Exception $e) {
    // Log error
    $errMsg = $mail->ErrorInfo ?? $e->getMessage();
    file_put_contents(__DIR__ . '/email-error.log', date('Y-m-d H:i:s') . ' - ' . $errMsg . PHP_EOL, FILE_APPEND);

    // Attempt a one-time debug connect to capture SMTP transcript for this failure.
    try {
        $mail->SMTPDebug = 2; // verbose
        // Debugoutput callable already set above; smtpConnect will emit debug lines to smtp-debug.log
        $mail->smtpConnect();
        $mail->smtpClose();
    } catch (Exception $dbgEx) {
        file_put_contents(__DIR__ . '/smtp-debug.log', date('Y-m-d H:i:s') . ' - Debug connect failed: ' . $dbgEx->getMessage() . PHP_EOL, FILE_APPEND);
    } finally {
        // Reset debug level back to 0 for safety
        $mail->SMTPDebug = 0;
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Your message could not be sent at this time.',
        'error'   => $errMsg
    ]);
    exit;
}
// Flush any buffered output after headers have been sent
if (ob_get_level()) ob_end_flush();
?>
