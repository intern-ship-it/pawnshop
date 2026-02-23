<?php
$file = 'app/Http/Controllers/Api/DotMatrixPrintController.php';
$content = file_get_contents($file);

// Increase company name size
$content = str_replace(
    '.ppp-company-name { font-size: 18px; font-weight: bold; color: #1a4a7a; line-height: 1.1; }',
    '.ppp-company-name { font-size: 26px; font-weight: bold; color: #1a4a7a; line-height: 1.1; }',
    $content
);

// Increase Chinese/Tamil name size
$content = str_replace(
    '.ppp-company-multi { font-size: 14px; font-weight: bold; color: #1a4a7a; margin-top: 1mm; }',
    '.ppp-company-multi { font-size: 18px; font-weight: bold; color: #1a4a7a; margin-top: 1mm; }',
    $content
);

// Increase address size slightly
$content = str_replace(
    '.ppp-company-addr { font-size: 9px; color: #1a4a7a; margin-top: 1mm; }',
    '.ppp-company-addr { font-size: 11px; color: #1a4a7a; margin-top: 1mm; }',
    $content
);

file_put_contents($file, $content);
echo "Done! Heading sizes increased.\n";
