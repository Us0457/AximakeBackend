<?php
// In development we may want to log errors, but do not send deprecation/notice output
// directly to the client (prevents "headers already sent" problems).
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_USER_DEPRECATED);
// Buffer output so headers can still be set even if libraries emit warnings
ob_start();

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use Dompdf\Dompdf;

require __DIR__ . '/../vendor/autoload.php';
if (!defined('DOMPDF_ENABLE_AUTOLOAD')) {
    define('DOMPDF_ENABLE_AUTOLOAD', false);
}

// Load project .env into environment variables if present (simple parser)
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
        if (strlen($v) >= 2 && (($v[0] === '"' && $v[-1] === '"') || ($v[0] === "'" && $v[-1] === "'"))) {
            $v = substr($v, 1, -1);
        }
        putenv("$k=$v");
        $_ENV[$k] = $v;
    }
}

// Simple error handler to capture warnings/notices into log file instead of sending to client
set_error_handler(function($errno, $errstr, $errfile, $errline){
    $msg = date('Y-m-d H:i:s') . " - PHP Notice/Warning: [$errno] $errstr in $errfile:$errline" . PHP_EOL;
    file_put_contents(__DIR__ . '/php-warnings.log', $msg, FILE_APPEND);
    return true; // prevent PHP internal handler from outputting to client
});

// Log script access
file_put_contents(__DIR__ . '/debug-post.log', date('Y-m-d H:i:s') . " - Script hit\n", FILE_APPEND);

// Add CORS headers at the very top
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// If a PHP_INVOKE_TOKEN is configured, require callers to present it via header
$expectedToken = getenv('PHP_INVOKE_TOKEN') ?: '';
if (!empty($expectedToken)) {
    $incoming = '';
    if (!empty($_SERVER['HTTP_X_PHP_INVOKE_TOKEN'])) {
        $incoming = $_SERVER['HTTP_X_PHP_INVOKE_TOKEN'];
    } elseif (!empty($_SERVER['X_PHP_INVOKE_TOKEN'])) {
        $incoming = $_SERVER['X_PHP_INVOKE_TOKEN'];
    } else {
        // try getallheaders fallback
        if (function_exists('getallheaders')) {
            $h = getallheaders();
            if (!empty($h['x-php-invoke-token'])) $incoming = $h['x-php-invoke-token'];
            if (!empty($h['X-PHP-Invoke-Token'])) $incoming = $incoming ?: $h['X-PHP-Invoke-Token'];
        }
    }
    if (!hash_equals($expectedToken, (string)$incoming)) {
        http_response_code(403);
        echo "Forbidden";
        if (ob_get_level()) ob_end_flush();
        exit;
    }
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $to = htmlspecialchars($_POST["to"] ?? $_POST["email"] ?? "");
    $name = htmlspecialchars($_POST["name"] ?? "Customer");
    $orderId = htmlspecialchars($_POST["order_id"] ?? "");
    $status = htmlspecialchars($_POST["status"] ?? "");
    $subject = htmlspecialchars($_POST["subject"] ?? "");
    $message = htmlspecialchars($_POST["message"] ?? "");

    // Validate recipient
    if (empty($to) || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo "Invalid or missing recipient email address.";
        exit;
    }

    // If subject and message are present, treat as generic admin email
    $isGeneric = !empty($subject) && !empty($message) && empty($orderId) && empty($status);

    $mail = new PHPMailer(true);
    try {
        // Basic sanity check: ensure SMTP host/user look consistent to avoid repeated auth failures
        $smtpHostCheck = getenv('SMTP_HOST') ?: 'smtp.hostinger.com';
        $smtpUserCheck = getenv('SMTP_USER') ?: 'admin@aximake.in';
        if (stripos($smtpHostCheck, 'hostinger') !== false && stripos($smtpUserCheck, '@gmail.com') !== false) {
            $msg = date('Y-m-d H:i:s') . " - SMTP config mismatch: host={$smtpHostCheck} user={$smtpUserCheck}" . PHP_EOL;
            file_put_contents(__DIR__ . '/email-error.log', $msg, FILE_APPEND);
            http_response_code(500);
            echo 'SMTP configuration mismatch: please set SMTP_HOST/SMTP_USER/SMTP_PASS in the project .env or environment variables.';
            if (ob_get_level()) ob_end_flush();
            exit;
        }

        $mail->isSMTP();
        // Log SMTP debug to file instead of stdout
        $mail->SMTPDebug = 0;
        $mail->Debugoutput = function($str, $level) {
            file_put_contents(__DIR__ . '/smtp-debug.log', date('Y-m-d H:i:s') . ' - ' . $str . PHP_EOL, FILE_APPEND);
        };
        // Prefer environment variables for SMTP settings; fall back to hardcoded values
        $mail->Host = getenv('SMTP_HOST') ?: 'smtp.hostinger.com';
        $mail->SMTPAuth = true;
        $mail->Username = getenv('SMTP_USER') ?: 'admin@aximake.in';
        $mail->Password = getenv('SMTP_PASS') ?: 'Utka2307Sri';
        $mail->SMTPSecure = getenv('SMTP_SECURE') ?: 'ssl';
        $mail->Port = getenv('SMTP_PORT') ? intval(getenv('SMTP_PORT')) : 465;
        $mail->setFrom(getenv('SMTP_FROM') ?: 'admin@aximake.in', getenv('SMTP_FROM_NAME') ?: 'Aximake 3D Printing');
        $mail->addAddress($to, $name);
        $mail->isHTML(true);

        // Embed the project BrandLogo.png (preferred) for reliable rendering.
        // Found at public/assets/BrandLogo.png in the workspace.
        $logoPath = __DIR__ . '/assets/BrandLogo.png';
        $logoImgHtml = '<img src="https://aximake.in/assets/BrandLogo.png" alt="Aximake" style="height:48px;margin-bottom:8px;" />';
        if (file_exists($logoPath)) {
            try {
                $mail->addEmbeddedImage($logoPath, 'aximake_logo');
                $logoImgHtml = '<img src="cid:aximake_logo" alt="Aximake" style="height:48px;margin-bottom:8px;" />';
            } catch (Exception $e) {
                // ignore and use public URL
            }
        }

        if ($isGeneric) {
            $mail->Subject = $subject;
            $mail->Body = '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px 24px;border-radius:10px;background:#f7fafc;border:1px solid #e2e8f0;">'
                . '<div style="text-align:center;margin-bottom:24px;">'
                  . $logoImgHtml
                . '<h2 style="color:#2d3748;margin:0;font-size:1.5rem;">' . htmlspecialchars($subject) . '</h2>'
                . '</div>'
                . '<p style="font-size:1.1rem;">Hi ' . htmlspecialchars($name) . ',</p>'
                . '<p>' . nl2br(htmlspecialchars($message)) . '</p>'
                . '<hr style="margin:32px 0 24px 0;border:none;border-top:1px solid #e2e8f0;" />'
                . '<p style="font-size:0.97rem;color:#4a5568;">If you have any questions or need assistance, simply reply to this email or contact us at <a href="mailto:admin@aximake.in" style="color:#3182ce;">admin@aximake.in</a>.</p>'
                . '<p style="margin-top:24px;font-size:0.97rem;color:#718096;">Thank you for choosing Aximake 3D Printing.<br>The Aximake Team</p>'
                . '</div>';
            $mail->AltBody = $message;
        } else {
            // Order status email
            if (empty($orderId) || empty($status)) {
                http_response_code(400);
                echo "Missing order_id or status for order status email.";
                exit;
            }
            $statusSubjects = [
                'confirmation' => 'Order Confirmation',
                'processing' => 'Order Processing',
                'shipping' => 'Order Shipped',
                'cancelled' => 'Order Cancelled',
                'delivered' => 'Order Delivered',
            ];
            $subject = $statusSubjects[strtolower($status)] ?? 'Order Update';
            $statusMessages = [
                'confirmation' => "Thank you for your order! Your order #$orderId has been received.",
                'processing' => "Your order #$orderId is now being processed.",
                'shipping' => "Good news! Your order #$orderId has shipped.",
                'cancelled' => "We're sorry, but your order #$orderId has been cancelled.",
                'delivered' => "Your order #$orderId has been delivered. Thank you for shopping with us!",
            ];
            $mainMessage = $statusMessages[strtolower($status)] ?? "Order update for order #$orderId.";
            $orderDetails = '<p style="margin:16px 0 0 0;"><strong>Order ID:</strong> ' . htmlspecialchars($orderId) . '</p>';
            $itemsJson = $_POST["items"] ?? null;
            $itemsArr = [];
            if ($itemsJson) {
                $decoded = json_decode($itemsJson, true);
                if (is_array($decoded)) $itemsArr = $decoded;
            }
            // Helper to render color swatch
            function renderColorSwatch($color, $colorName) {
                if (is_string($color) && preg_match('/^#([A-Fa-f0-9]{3}){1,2}$/', $color)) {
                    return '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:' . htmlspecialchars($color) . ';border:1px solid #ccc;vertical-align:middle;margin-right:3px;"></span>' . htmlspecialchars($colorName ?: 'Custom');
                }
                return htmlspecialchars($colorName ?: $color);
            }
            // Helper to render product/quote block
            function renderOrderItemsHtml($items) {
                if (!is_array($items) || !count($items)) return '<div style="color:#888;">No items found in this order.</div>';
                $html = '';
                foreach ($items as $idx => $item) {
                    $name = htmlspecialchars($item['name'] ?? $item['file_name'] ?? 'Item');
                    $qty = intval($item['quantity'] ?? 1);

                    // Image logic (first image candidate)
                    $img = $item['images'] ?? ($item['image'] ?? '');
                    if (is_array($img)) $img = $img[0] ?? '';
                    if (is_string($img) && strpos($img, ',') !== false) $img = explode(',', $img)[0];
                    $img = trim($img, "[]'{}\"");
                    if ($img && !preg_match('/^https?:\/\//', $img)) {
                        $supabaseBase = rtrim(getenv('SUPABASE_URL') ?: '', '/');
                        if (!empty($supabaseBase)) {
                            $img = $supabaseBase . '/storage/v1/object/public/product-images/' . ltrim(preg_replace('/^products\//', 'products/', $img), '/');
                        } else {
                            $img = 'https://aximake.in/assets/product-placeholder.png';
                        }
                    }
                    $imgTag = '<img src="' . htmlspecialchars($img) . '" alt="' . $name . '" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;" />';

                    // One-line display: image | product name + quantity
                    $html .= '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:12px;">'
                        . '<tr>'
                        . '<td width="72" valign="top" style="padding-right:8px;">' . $imgTag . '</td>'
                        . '<td valign="top" style="font-size:14px;color:#2d3748;">'
                            . '<div style="font-weight:600;margin-bottom:4px;">' . $name . '</div>'
                            . '<div style="font-size:12px;color:#6b7280;">Quantity: ' . $qty . '</div>'
                        . '</td>'
                        . '</tr>'
                        . '</table>';
                }
                return $html;
            }
            // Add order items HTML if present
            if (count($itemsArr)) {
                $orderDetails .= '<div style="margin-top:18px;margin-bottom:8px;font-weight:bold;color:#6366f1;">Order Items</div>';
                $orderDetails .= renderOrderItemsHtml($itemsArr);
            }
            $statusInstructions = [
                'confirmation' => '<p style="margin:16px 0 0 0;">We are excited to let you know that your order has been received and is now being reviewed by our team. You will receive further updates as your order progresses.</p>',
                'processing' => '<p style="margin:16px 0 0 0;">Our team is currently preparing your order. We will notify you once it has shipped. If you have any questions or need to make changes, please contact us as soon as possible.</p>',
                'shipping' => '<p style="margin:16px 0 0 0;">Your order is on its way! You will receive tracking information (if available) soon. Thank you for your patience.</p>',
                'cancelled' => '<p style="margin:16px 0 0 0;">If you have any questions about this cancellation or would like to place a new order, please contact us.</p>',
                'delivered' => '<p style="margin:16px 0 0 0;">We hope you enjoy your purchase! If you have any feedback or need support, please let us know.</p>',
            ];
            $instructions = $statusInstructions[strtolower($status)] ?? '';
            // Show a centered "View Order" button only for shipped orders
            $viewOrderButton = '';
            $statusNormalized = preg_replace('/[^a-z0-9]+/i', '_', strtolower($status));
            // Prefer an explicit order_code when provided (human-friendly), else fall back to orderId
            $orderCode = htmlspecialchars($_POST['order_code'] ?? '');
            $hasOrderRef = !empty($orderId) || !empty($orderCode);
            $showButton = ($statusNormalized === 'shipped' && $hasOrderRef);
            if ($showButton) {
                $siteBase = rtrim(getenv('SITE_BASE_URL') ?: getenv('APP_URL') ?: 'https://aximake.in', '/');
                if (!empty($orderCode)) {
                    $orderLink = $siteBase . '/orders/' . rawurlencode($orderCode);
                } else {
                    $orderLink = $siteBase . '/orders/' . rawurlencode($orderId);
                }
                $viewOrderButton = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:18px 0 22px 0;">'
                    . '<a href="' . htmlspecialchars($orderLink) . '" style="background:#4f46e5;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">View Order</a>'
                    . '</td></tr></table>';
            }
            $mail->Subject = $subject;
            $mail->Body = '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px 24px;border-radius:10px;background:#f7fafc;border:1px solid #e2e8f0;">'
                . '<div style="text-align:center;margin-bottom:24px;">'
                  . $logoImgHtml
                . '<h2 style="color:#2d3748;margin:0;font-size:1.5rem;">' . $subject . '</h2>'
                . '</div>'
                . '<p style="font-size:1.1rem;">Hi ' . htmlspecialchars($name) . ',</p>'
                . '<p>' . $mainMessage . '</p>'
                . $orderDetails
                . $viewOrderButton
                . $instructions .
                '<hr style="margin:32px 0 24px 0;border:none;border-top:1px solid #e2e8f0;" />'
                . '<p style="font-size:0.97rem;color:#4a5568;">If you have any questions or need assistance, simply reply to this email or contact us at <a href="mailto:admin@aximake.in" style="color:#3182ce;">admin@aximake.in</a>.</p>'
                . '<p style="margin-top:24px;font-size:0.97rem;color:#718096;">Thank you for choosing Aximake 3D Printing.<br>The Aximake Team</p>'
                . '</div>';
            $mail->AltBody = $mainMessage . "\nOrder ID: $orderId\n\nIf you have any questions, contact admin@aximake.in.\nThank you for choosing Aximake 3D Printing.";

            // --- PDF Invoice Generation ---
            $invoiceTemplatePath = __DIR__ . '/invoice-template.html';
            $invoiceHtml = file_get_contents($invoiceTemplatePath);
            // Prepare invoice variables
            // Compose billing/shipping info from address fields if present
            $billingInfo = '';
            $shippingInfo = '';
            if (!empty($_POST['billing_info'])) {
                $billingInfo = nl2br(htmlspecialchars($_POST['billing_info']));
            } elseif (!empty($_POST['address'])) {
                $addr = json_decode($_POST['address'], true);
                if (is_array($addr)) {
                    $billingInfo = trim(
                        ($addr['name'] ?? '') . '<br>' .
                        ($addr['flat_no'] ?? '') . ', ' .
                        ($addr['area'] ?? '') . ', ' .
                        ($addr['city'] ?? '') . ', ' .
                        ($addr['state'] ?? '') . ' - ' .
                        ($addr['pincode'] ?? '') . '<br>Phone: ' .
                        ($addr['phone'] ?? '')
                    );
                }
            }
            if (!empty($_POST['shipping_info'])) {
                $shippingInfo = nl2br(htmlspecialchars($_POST['shipping_info']));
            } elseif (!empty($_POST['address'])) {
                $addr = json_decode($_POST['address'], true);
                if (is_array($addr)) {
                    $shippingInfo = trim(
                        ($addr['name'] ?? '') . '<br>' .
                        ($addr['flat_no'] ?? '') . ', ' .
                        ($addr['area'] ?? '') . ', ' .
                        ($addr['city'] ?? '') . ', ' .
                        ($addr['state'] ?? '') . ' - ' .
                        ($addr['pincode'] ?? '') . '<br>Phone: ' .
                        ($addr['phone'] ?? '')
                    );
                }
            }
            // Format billing/shipping info for better readability
            function formatAddressBlock($info) {
                $info = strip_tags($info, '<br>'); // Remove HTML tags except <br>
                $info = preg_replace('/, ?/', "<br>", $info, 2); // Only first two commas to line breaks
                $info = preg_replace('/, ?/', ", ", $info); // The rest stay as commas
                $info = preg_replace('/Phone: ?/', "<br>Phone: ", $info);
                $info = preg_replace('/\?/', '₹', $info); // Replace any question marks with rupee symbol
                return $info;
            }
            $invoiceVars = [
                '{{invoice_number}}' => htmlspecialchars($orderId),
                '{{invoice_date}}' => date('d M Y'),
                '{{payment_method}}' => 'Online',
                '{{shipping_method}}' => 'Standard',
                '{{billing_info}}' => formatAddressBlock($billingInfo),
                '{{shipping_info}}' => formatAddressBlock($shippingInfo),
            ];
            // Build product rows
            $productRows = '';
            $subtotal = 0;
            if (count($itemsArr)) {
                foreach ($itemsArr as $idx => $item) {
                    $qty = intval($item['quantity'] ?? 1);
                    $unit = floatval($item['price'] ?? 0);
                    $total = $qty * $unit;
                    $subtotal += $total;
                    $unitStr = str_replace('?', '₹', number_format($unit, 2, '.', ','));
                    $totalStr = str_replace('?', '₹', number_format($total, 2, '.', ','));
                    $productRows .= '<tr style="text-align:justify;">'
                        . '<td>' . ($idx + 1) . '</td>'
                        . '<td>' . htmlspecialchars($item['name'] ?? $item['file_name'] ?? 'Item') . '</td>'
                        . '<td>' . $qty . '</td>'
                        . '<td>₹' . $unitStr . '</td>'
                        . '<td>₹' . $totalStr . '</td>'
                        . '</tr>';
                }
            }
            $shipping = 0;
            $gst = round($subtotal * 0.18, 2);
            $total = $subtotal + $shipping + $gst;
            $invoiceVars['{{product_rows}}'] = $productRows;
            $invoiceVars['{{subtotal}}'] = str_replace('?', '₹', number_format($subtotal, 2, '.', ','));
            $invoiceVars['{{shipping}}'] = str_replace('?', '₹', number_format($shipping, 2, '.', ','));
            $invoiceVars['{{gst}}'] = str_replace('?', '₹', number_format($gst, 2, '.', ','));
            $invoiceVars['{{total}}'] = str_replace('?', '₹', number_format($total, 2, '.', ','));
            // Replace variables in template
            $invoiceHtmlFilled = strtr($invoiceHtml, $invoiceVars);
            // Generate PDF
            $dompdf = new Dompdf();
            $dompdf->loadHtml($invoiceHtmlFilled);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            $pdfOutput = $dompdf->output();
            $pdfFileName = 'Invoice-' . $orderId . '.pdf';
            $mail->addStringAttachment($pdfOutput, $pdfFileName, 'base64', 'application/pdf');
        }
        // Save the final HTML body for inspection and optionally return it
        file_put_contents(__DIR__ . '/last_email_body.html', $mail->Body);
        if (!empty($_POST['dump_html'])) {
            header('Content-Type: text/html; charset=utf-8');
            echo $mail->Body;
            if (ob_get_level()) ob_end_flush();
            exit;
        }

        if ($mail->send()) {
            echo "success";
        } else {
            http_response_code(500);
            $errorMsg = "Mailer Error: {$mail->ErrorInfo}";
            echo $errorMsg;
            file_put_contents(__DIR__ . '/email-error.log', date('Y-m-d H:i:s') . ' - ' . $mail->ErrorInfo . PHP_EOL, FILE_APPEND);
        }
    } catch (Exception $e) {
        http_response_code(500);
        $err = $e->getMessage();
        echo 'Mailer Exception: ' . $err;
        file_put_contents(__DIR__ . '/email-error.log', date('Y-m-d H:i:s') . ' - Exception: ' . $err . PHP_EOL, FILE_APPEND);
    }
} else {
    http_response_code(405);
    echo "Method Not Allowed";
}

// Flush any buffered output after headers have been sent
if (ob_get_level()) ob_end_flush();
