<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use Dompdf\Dompdf;

require __DIR__ . '/../vendor/autoload.php';
if (!defined('DOMPDF_ENABLE_AUTOLOAD')) {
    define('DOMPDF_ENABLE_AUTOLOAD', false);
}

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
        $mail->isSMTP();
        $mail->SMTPDebug = 2;
        $mail->Debugoutput = function($str, $level) {
            file_put_contents(__DIR__ . '/smtp-debug.log', $str . PHP_EOL, FILE_APPEND);
        };
        $mail->Host       = 'smtp.hostinger.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'admin@aximake.in';
        $mail->Password   = 'Utka2307Sri';
        $mail->SMTPSecure = 'ssl';
        $mail->Port       = 465;
        $mail->setFrom('admin@aximake.in', 'Aximake 3D Printing');
        $mail->addAddress($to, $name);
        $mail->isHTML(true);

        if ($isGeneric) {
            $mail->Subject = $subject;
            $mail->Body = '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px 24px;border-radius:10px;background:#f7fafc;border:1px solid #e2e8f0;">'
                . '<div style="text-align:center;margin-bottom:24px;">'
                . '<img src="https://aximake.in/logo.png" alt="Aximake Logo" style="height:48px;margin-bottom:8px;" />'
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
                    $isProduct = !empty($item['product_id']);
                    $label = $isProduct ? 'Product' : 'Quote';
                    $name = htmlspecialchars($isProduct ? ($item['name'] ?? '') : ($item['file_name'] ?? $item['name'] ?? 'Custom Quote'));
                    $category = htmlspecialchars($item['category'] ?? '');
                    $material = htmlspecialchars($item['material'] ?? '');
                    $color = $item['color'] ?? '';
                    $colorName = $item['color_name'] ?? '';
                    $infill = isset($item['infill']) ? htmlspecialchars($item['infill']) : '';
                    $productId = htmlspecialchars($item['product_id'] ?? '');
                    $desc = htmlspecialchars($item['description'] ?? '');
                    $qty = htmlspecialchars($item['quantity'] ?? 1);
                    $price = number_format(floatval($item['price'] ?? 0), 2);
                    // Image logic
                    $img = $item['images'] ?? '';
                    if (is_array($img)) $img = $img[0] ?? '';
                    if (is_string($img) && strpos($img, ',') !== false) $img = explode(',', $img)[0];
                    $img = trim($img, "[]'{}\"");
                    if ($img && !preg_match('/^https?:\/\//', $img)) {
                        $img = 'https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/' . ltrim(preg_replace('/^products\//', 'products/', $img), '/');
                    }
                    $imgTag = $img ? '<img src="' . htmlspecialchars($img) . '" alt="' . $name . '" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;margin-top:4px;" />' : '';
                    // Download link for quote
                    $fileUrl = !$isProduct && !empty($item['file_url']) ? htmlspecialchars($item['file_url']) : '';
                    $fileName = !$isProduct && !empty($item['file_name']) ? htmlspecialchars($item['file_name']) : 'File';
                    $download = $fileUrl ? '<div style="margin-top:4px;"><a href="' . $fileUrl . '" download style="color:#2563eb;text-decoration:underline;font-size:13px;">Download STL: ' . $fileName . '</a></div>' : '';
                    $html .= '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px;background:#f9fafb;">
                        <div style="font-weight:bold;margin-bottom:4px;color:' . ($isProduct ? '#4f46e5' : '#eab308') . ';">' . $label . ': ' . $name . '</div>
                        <div style="font-size:13px;color:#444;margin-bottom:4px;">'
                        . ($category ? 'Category: <span style="color:#6366f1;">' . $category . '</span> | ' : '')
                        . ($material ? 'Material: <span style="color:#6366f1;">' . $material . '</span> | ' : '')
                        . ($color ? 'Color: ' . renderColorSwatch($color, $colorName) . ' | ' : '')
                        . ($infill !== '' ? 'Infill: ' . $infill . '% | ' : '')
                        . ($productId ? 'Product ID: ' . $productId : '')
                        . '</div>'
                        . ($desc ? '<div style="font-size:13px;color:#666;margin-bottom:4px;">' . $desc . '</div>' : '')
                        . '<div style="font-size:13px;color:#222;margin-bottom:4px;">Qty: ' . $qty . ' | Price: ₹' . $price . '</div>'
                        . $imgTag
                        . $download
                        . '</div>';
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
            $mail->Subject = $subject;
            $mail->Body = '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px 24px;border-radius:10px;background:#f7fafc;border:1px solid #e2e8f0;">'
                . '<div style="text-align:center;margin-bottom:24px;">'
                . '<img src="https://aximake.in/logo.png" alt="Aximake Logo" style="height:48px;margin-bottom:8px;" />'
                . '<h2 style="color:#2d3748;margin:0;font-size:1.5rem;">' . $subject . '</h2>'
                . '</div>'
                . '<p style="font-size:1.1rem;">Hi ' . htmlspecialchars($name) . ',</p>'
                . '<p>' . $mainMessage . '</p>'
                . $orderDetails
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
        $errorMsg = "Mailer Error: {$mail->ErrorInfo}";
        echo $errorMsg;
        file_put_contents(__DIR__ . '/email-error.log', date('Y-m-d H:i:s') . ' - ' . $mail->ErrorInfo . PHP_EOL, FILE_APPEND);
    }
} else {
    http_response_code(405);
    echo "Method Not Allowed";
}
