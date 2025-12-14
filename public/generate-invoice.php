<?php
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', 0);

require __DIR__ . '/../vendor/autoload.php';
use Dompdf\Dompdf;
use GuzzleHttp\Client;

// --- Supabase PHP Client ---

// Supabase config
$supabaseUrl = 'https://wruysjrqadlsljnkmnte.supabase.co';
$supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydXlzanJxYWRsc2xqbmttbnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NzA1NzksImV4cCI6MjA2MzQ0NjU3OX0.E4oUnKQ87s5ZBQfE2cWt7R6SkNbMnRQW2wvj2oD91KM';

// Get order_id from query
$order_id = $_GET['order_id'] ?? null;
if (!$order_id) {
    http_response_code(400);
    exit('Order ID required');
}

function fetchOrderFromSupabase($order_id, $supabaseUrl, $supabaseKey) {
    $client = new Client();
    $response = $client->request('GET', "$supabaseUrl/rest/v1/orders?order_code=eq.$order_id", [
        'headers' => [
            'apikey' => $supabaseKey,
            'Authorization' => 'Bearer ' . $supabaseKey,
            'Accept' => 'application/json',
        ]
    ]);
    $data = json_decode($response->getBody(), true);
    if (!$data || !isset($data[0])) return null;
    return $data[0];
}

$order = fetchOrderFromSupabase($order_id, $supabaseUrl, $supabaseKey);
if (!$order) {
    http_response_code(404);
    exit('Order not found');
}

// --- Prepare invoice data from order ---
$items = $order['items'] ?? [];
$billing_info = isset($order['address']) ? (
    htmlspecialchars($order['address']['name'] ?? '') . '<br>' .
    htmlspecialchars($order['address']['flat_no'] ?? '') . ', ' .
    htmlspecialchars($order['address']['area'] ?? '') . ', ' .
    htmlspecialchars($order['address']['city'] ?? '') . ', ' .
    htmlspecialchars($order['address']['state'] ?? '') . ' - ' .
    htmlspecialchars($order['address']['pincode'] ?? '') . '<br>Phone: ' .
    htmlspecialchars($order['address']['phone'] ?? '')
) : '';
$shipping_info = $billing_info;

// --- Load invoice template ---
$template = file_get_contents(__DIR__ . '/invoice-template.html');

// --- Prepare product rows HTML ---
$productRows = '';
$subtotal = 0;
$idx = 1;
foreach ($items as $item) {
    $qty = intval($item['quantity'] ?? 1);
    $unit = floatval($item['price'] ?? 0);
    $total = $qty * $unit;
    $subtotal += $total;
    $productRows .= "<tr>"
        . "<td>" . $idx++ . "</td>"
        . "<td>" . htmlspecialchars($item['name'] ?? $item['file_name'] ?? 'Item') . "</td>"
        . "<td>" . $qty . "</td>"
        . "<td>₹" . number_format($unit, 2) . "</td>"
        . "<td>₹" . number_format($total, 2) . "</td>"
        . "</tr>";
}
$shipping = 0;
$gst = round($subtotal * 0.18, 2);
$discount = isset($order['discount_amount']) ? floatval($order['discount_amount']) : 0;
$total = $subtotal + $shipping + $gst - $discount;

// --- Replace placeholders in template ---
$search = [
    '{{invoice_number}}',
    '{{invoice_date}}',
    '{{payment_method}}',
    '{{shipping_method}}',
    '{{billing_info}}',
    '{{shipping_info}}',
    '{{product_rows}}',
    '{{subtotal}}',
    '{{shipping}}',
    '{{gst}}',
    '{{discount}}',
    '{{total}}'
];
$replace = [
    htmlspecialchars($order['order_code'] ?? $order_id),
    htmlspecialchars(substr($order['created_at'] ?? '', 0, 10)),
    htmlspecialchars($order['payment_method'] ?? 'Online'),
    htmlspecialchars('Standard'),
    $billing_info,
    $shipping_info,
    $productRows,
    number_format($subtotal, 2),
    number_format($shipping, 2),
    number_format($gst, 2),
    number_format($discount, 2),
    number_format($total, 2)
];
$html = str_replace($search, $replace, $template);

// --- Generate and stream PDF ---
$dompdf = new Dompdf();
$dompdf->loadHtml($html);
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();
$dompdf->stream("Invoice-{$order['order_code']}.pdf", ["Attachment" => true]);
exit;
?>
