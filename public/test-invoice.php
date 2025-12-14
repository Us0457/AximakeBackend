<?php
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', 0);

require __DIR__ . '/../vendor/autoload.php';
use Dompdf\Dompdf;

// Mock data for testing
$orderId = 'TEST-ORDER-001';
$itemsArr = [
  [
    'name' => 'Sample Product',
    'quantity' => 2,
    'price' => 499.99,
    'material' => 'PLA',
    'color' => '#FF0000',
    'category' => '3D Print',
    'product_id' => 'P001'
  ]
];
$billingInfo = "Test User<br>123 Test St, Test Area, Test City, Test State - 123456<br>Phone: 9999999999";
$shippingInfo = $billingInfo;

// Load invoice template
$invoiceTemplatePath = __DIR__ . '/invoice-template.html';
$invoiceHtml = file_get_contents($invoiceTemplatePath);

// Decrease font size for the whole invoice
$invoiceHtml = str_replace('<body>', '<body style="font-size:13px;">', $invoiceHtml);

// Build product rows and totals
$productRows = '';
$subtotal = 0;
foreach ($itemsArr as $idx => $item) {
  $qty = intval($item['quantity']);
  $unit = floatval($item['price']);
  $total = $qty * $unit;
  $subtotal += $total;
  $productRows .= "<tr><td>".($idx+1)."</td><td>{$item['name']}</td><td>{$qty}</td><td>₹".number_format($unit,2)."</td><td>₹".number_format($total,2)."</td></tr>";
}
$shipping = 0;
$gst = round($subtotal * 0.18, 2);
$total = $subtotal + $shipping + $gst;

// Replace variables in template
$invoiceVars = [
  '{{invoice_number}}' => $orderId,
  '{{invoice_date}}' => date('d M Y'),
  '{{payment_method}}' => 'Online',
  '{{shipping_method}}' => 'Standard',
  '{{billing_info}}' => $billingInfo,
  '{{shipping_info}}' => $shippingInfo,
  '{{product_rows}}' => $productRows,
  '{{subtotal}}' => number_format($subtotal, 2),
  '{{shipping}}' => number_format($shipping, 2),
  '{{gst}}' => number_format($gst, 2),
  '{{total}}' => number_format($total, 2),
];
$invoiceHtmlFilled = strtr($invoiceHtml, $invoiceVars);

// Generate PDF
$dompdf = new Dompdf();
$dompdf->loadHtml($invoiceHtmlFilled);
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();
$dompdf->stream('Test-Invoice.pdf', ['Attachment' => false]); // Set to true to force download
