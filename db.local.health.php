<?php
declare(strict_types=1);

// Minimal local test: simulate ?action=health endpoint
header('Content-Type: application/json; charset=utf-8');

// Local log file for debug
$logfile = __DIR__ . '/db.local.health.log';
file_put_contents($logfile, "[".date('c')."] Requested: " . ($_SERVER['REQUEST_URI'] ?? '') . PHP_EOL, FILE_APPEND);

$action = $_GET['action'] ?? $_POST['action'] ?? null;
if ($action === 'health') {
    $result = [
        'ok'      => true,
        'msg'     => 'Health check OK (local test)',
        'php'     => PHP_VERSION,
        'time'    => date('c')
    ];
    file_put_contents($logfile, "[".date('c')."] Responded: " . json_encode($result) . PHP_EOL, FILE_APPEND);
    echo json_encode($result);
    exit;
}

echo json_encode(['ok' => false, 'msg' => 'Invalid or missing action']);