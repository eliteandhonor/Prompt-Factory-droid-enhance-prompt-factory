<?php
declare(strict_types=1);
/**
 * log.php
 * Accepts POSTed JSON logs from the frontend and appends them to a server log file.
 * Always returns a JSON response.
 * Enforces strict schema and size limits.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

$logFile = __DIR__ . '/../frontend-error.log';

// Configurable limits
$ALLOWED_LEVELS = ['info', 'warn', 'error', 'debug'];
$MAX_MESSAGE_LENGTH = 500;
$MAX_CONTEXT_SIZE = 2048; // bytes (2KB)

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    // Strict schema and size validation
    if (!is_array($data) || !isset($data['level'], $data['message'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid log payload']);
        exit;
    }
    if (!in_array(strtolower($data['level']), $ALLOWED_LEVELS, true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid log level']);
        exit;
    }
    if (!is_string($data['message']) || mb_strlen($data['message']) > $MAX_MESSAGE_LENGTH) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Log message too long (max ' . $MAX_MESSAGE_LENGTH . ' chars)']);
        exit;
    }
    if (isset($data['context'])) {
        $contextJson = json_encode($data['context']);
        if ($contextJson === false || strlen($contextJson) > $MAX_CONTEXT_SIZE) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Context too large (max ' . $MAX_CONTEXT_SIZE . ' bytes)']);
            exit;
        }
    }

    $entry = [
        'ts' => date('c'),
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'level' => strtolower($data['level']),
        'message' => $data['message'],
        'context' => $data['context'] ?? null,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
    ];

    // Append as JSON line
    file_put_contents($logFile, json_encode($entry, JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND | LOCK_EX);

    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server error', 'details' => $e->getMessage()]);
}