<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Debug: log all POST data for troubleshooting
file_put_contents(__DIR__ . '/debug-post.log', date('Y-m-d H:i:s') . "\n" . print_r($_POST, true) . "\n", FILE_APPEND);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use Dompdf\Dompdf;

require __DIR__ . '/../vendor/autoload.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST");

if (php_sapi_name() === 'cli-server' || isset($_SERVER['REQUEST_METHOD'])) {
    if ($_SERVER["REQUEST_METHOD"] == "POST") {
        $name = htmlspecialchars($_POST["name"] ?? "");
        $email = htmlspecialchars($_POST["email"] ?? "");
        $message = htmlspecialchars($_POST["message"] ?? "");
        $billing_address = htmlspecialchars($_POST["billing_address"] ?? "");
        $shipping_address = htmlspecialchars($_POST["shipping_address"] ?? "");
        $items = $_POST["items"] ?? "";
        $grand_total = htmlspecialchars($_POST["grand_total"] ?? "");
        $order_id = htmlspecialchars($_POST["order_id"] ?? uniqid("AXI-") );
        $order_date = htmlspecialchars($_POST["order_date"] ?? date('Y-m-d H:i'));

        // Validate recipient
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo "Invalid or missing recipient email address.";
            exit;
        }
        // Validate message
        if (empty($name) || empty($message)) {
            http_response_code(400);
            echo "Missing name or message.";
            exit;
        }

        $mail = new PHPMailer(true);

        try {
            //Server settings
            $mail->isSMTP();
            $mail->SMTPDebug = 2; // Set to 2 for debug output in smtp-debug.log
            $mail->Debugoutput = function($str, $level) {
                file_put_contents(__DIR__ . '/smtp-debug.log', $str . PHP_EOL, FILE_APPEND);
            };
            $mail->Host       = 'smtp.hostinger.com'; // Hostinger SMTP server
            $mail->SMTPAuth   = true;
            $mail->Username   = 'admin@aximake.in'; // Your Hostinger email
            $mail->Password   = '$Utka2307.Sri'; // Your Hostinger email password
            $mail->SMTPSecure = 'ssl'; // Use 'ssl' for port 465
            $mail->Port       = 465;

            // Send confirmation email to customer only
            $mail->setFrom('admin@aximake.in', 'Aximake 3D Printing');
            $mail->addAddress($email); // Send to customer
            $mail->isHTML(true);
            $mail->Subject = 'Thank you for your order!';
            $mail->Body = '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border-radius:8px;background:#f9f9f9;">'
              . '<h2 style="color:#2d3748;">Thank you for ordering with Aximake!</h2>'
              . '<p>Hi ' . htmlspecialchars($name) . ',</p>'
              . '<p>We have received your order and will process it soon. If you have any questions, reply to this email or contact us at <a href="mailto:utkarsh5679077@gmail.com">utkarsh5679077@gmail.com</a>.</p>'
              . '<p style="margin-top:32px;">We appreciate your business!<br>The Aximake Team</p>'
            . '</div>';
            $mail->AltBody = "Thank you for ordering with Aximake!\n\nWe have received your order and will process it soon. If you have any questions, reply to this email.\n\nWe appreciate your business!\nThe Aximake Team";

            // Compose address string from POSTed address fields if present
            $address = '';
            if (!empty($_POST['address'])) {
                // If address is sent as a JSON string (from frontend), decode and format it
                $addr = json_decode($_POST['address'], true);
                if (is_array($addr)) {
                    $address = trim(
                        ($addr['name'] ?? '') . '<br>' .
                        ($addr['flat_no'] ?? '') . ', ' .
                        ($addr['area'] ?? '') . ', ' .
                        ($addr['city'] ?? '') . ', ' .
                        ($addr['state'] ?? '') . ' - ' .
                        ($addr['pincode'] ?? '') . '<br>Phone: ' .
                        ($addr['phone'] ?? '')
                    );
                }
            } elseif (!empty($billing_address)) {
                $address = nl2br($billing_address);
            }

            // Generate invoice HTML from template
            $invoice_template = file_get_contents(__DIR__ . '/invoice-template.html');
            $invoice_html = str_replace([
              '{{order_date}}',
              '{{order_id}}',
              '{{address}}',
              '{{address}}',
              '{{items}}',
              '{{grand_total}}'
            ], [
              $order_date,
              $order_id,
              $address,
              $address,
              $items,
              $grand_total
            ], $invoice_template);
            // Try to attach as PDF (if dompdf is available), else attach as HTML
            $pdf_path = null;
            if (class_exists('Dompdf\\Dompdf')) {
              $dompdf = new Dompdf();
              $dompdf->loadHtml($invoice_html);
              $dompdf->setPaper('A4', 'portrait');
              $dompdf->render();
              $pdf_path = sys_get_temp_dir() . "/invoice-{$order_id}.pdf";
              file_put_contents($pdf_path, $dompdf->output());
              $mail->addAttachment($pdf_path, "Invoice-{$order_id}.pdf");
            } else {
              // Attach as HTML if PDF not available
              $mail->addStringAttachment($invoice_html, "Invoice-{$order_id}.html", 'base64', 'text/html');
            }

            if ($mail->send()) {
                echo "success";
            } else {
                http_response_code(500);
                $errorMsg = "Mailer Error: {$mail->ErrorInfo}";
                echo $errorMsg;
                file_put_contents(__DIR__ . '/email-error.log', date('Y-m-d H:i:s') . ' - ' . $mail->ErrorInfo . PHP_EOL, FILE_APPEND);
                echo "<script>console.error('" . addslashes($errorMsg) . "');</script>";
            }
        } catch (Exception $e) {
            http_response_code(500);
            $errorMsg = "Mailer Error: {$mail->ErrorInfo}";
            echo $errorMsg;
            file_put_contents(__DIR__ . '/email-error.log', date('Y-m-d H:i:s') . ' - ' . $mail->ErrorInfo . PHP_EOL, FILE_APPEND);
            echo "<script>console.error('" . addslashes($errorMsg) . "');</script>";
        }

        // Clean up temp PDF
        if ($pdf_path && file_exists($pdf_path)) unlink($pdf_path);
    } else {
        http_response_code(405);
        echo "Method Not Allowed";
    }
} else {
    // Not running under a PHP server
    echo "Error: This script must be run on a PHP-enabled web server. Please start the PHP server using 'php -S localhost:8000' in the public directory.";
    exit;
}
?>
