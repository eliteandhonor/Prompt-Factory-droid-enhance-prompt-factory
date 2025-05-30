<?php
require_once __DIR__ . '/../Logger.php';

// Initialize Logger
$logger = new Logger([
    'log_path' => __DIR__ . '/../db-' . date('Y-m-d') . '.log',
    'log_level' => 'DEBUG',
    'log_perms' => 0640,
    'log_days' => 14
], [
    'api' => 'comments.php',
    'request_method' => $_SERVER['REQUEST_METHOD'] ?? '',
    'uri' => $_SERVER['REQUEST_URI'] ?? '',
    'query' => $_SERVER['QUERY_STRING'] ?? '',
    'ip' => $_SERVER['REMOTE_ADDR'] ?? ''
]);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    $logger->log('INFO', 'OPTIONS_PREFLIGHT', null, []);
    exit;
}

$DATA_FILE = __DIR__ . '/../comments.json';

// Utility: Read all comments with shared lock and logging
function read_comments($file, $logger) {
    if (!file_exists($file)) {
        $logger->warn('FILE_READ', "File does not exist", ['file' => $file]);
        return [];
    }
    $fp = fopen($file, 'r');
    if (!$fp) {
        $logger->error('FILE_READ', "Failed to open file for reading", ['file' => $file]);
        return [];
    }
    $data = [];
    if (flock($fp, LOCK_SH)) {
        $json = stream_get_contents($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        $data = json_decode($json, true);
        if (!is_array($data)) {
            $logger->error('JSON_PARSE', "Failed to parse JSON", ['file' => $file, 'snippet' => substr($json, 0, 100)]);
            return [];
        }
        $logger->log('DEBUG', 'FILE_READ', 'OK', ['file' => $file, 'count' => count($data)]);
        return $data;
    } else {
        $logger->error('FILE_LOCK', "Failed to acquire shared lock for reading", ['file' => $file]);
        fclose($fp);
        return [];
    }
}

// Utility: Write all comments with atomic write and exclusive lock
function write_comments($file, $data, $logger) {
    $tmpFile = $file . '.tmp';
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $fp = fopen($tmpFile, 'w');
    if (!$fp) {
        $logger->error('FILE_WRITE', "Failed to open temp file for writing", ['file' => $tmpFile]);
        return false;
    }
    if (flock($fp, LOCK_EX)) {
        $bytes = fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        if ($bytes === false) {
            $logger->error('FILE_WRITE', "Failed to write data to temp file", ['file' => $tmpFile]);
            return false;
        }
        if (!rename($tmpFile, $file)) {
            $logger->error('FILE_WRITE', "Failed to rename temp file to data file", ['tmp' => $tmpFile, 'file' => $file]);
            return false;
        }
        $logger->log('DEBUG', 'FILE_WRITE', 'OK', ['file' => $file, 'bytes' => $bytes]);
        return $bytes;
    } else {
        $logger->error('FILE_LOCK', "Failed to acquire exclusive lock for writing", ['file' => $tmpFile]);
        fclose($fp);
        return false;
    }
}

// Utility: Send JSON response
function send_json($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// GET /api/comments[?prompt_id=...] - list all comments, optionally filtered by prompt_id
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $logger->log('INFO', 'GET_COMMENTS', null, []);
    $comments = read_comments($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    if (isset($_GET['prompt_id'])) {
        $pid = $_GET['prompt_id'];
        $logger->log('INFO', 'GET_FILTER_PROMPT_ID', null, ['prompt_id' => $pid]);
        $comments = array_values(array_filter($comments, function($c) use ($pid) {
            return isset($c['prompt_id']) && $c['prompt_id'] === $pid;
        }));
    }
    send_json(['ok' => true, 'comments' => $comments]);
}

// POST /api/comments - create a new comment
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $logger->log('INFO', 'POST_RECEIVED', null, ['input' => $input]);
    if (!is_array($input) || !isset($input['prompt_id']) || !isset($input['content'])) {
        $logger->warn('POST_ERROR', 'Missing required fields', ['input' => $input]);
        send_json(['ok' => false, 'error' => 'Missing required fields'], 400);
    }
    $comments = read_comments($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $newComment = [
        'id' => uniqid('comment_', true),
        'prompt_id' => $input['prompt_id'],
        'content' => trim($input['content']),
        'author' => isset($input['author']) ? trim($input['author']) : null,
        'created_at' => date('c'),
        'updated_at' => date('c'),
    ];
    $comments[] = $newComment;
    $result = write_comments($GLOBALS['DATA_FILE'], $comments, $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('POST_ERROR', 'Failed to write new comment', ['comment' => $newComment]);
        send_json(['ok' => false, 'error' => 'Failed to write comment'], 500);
    }
    $logger->log('INFO', 'POST_CREATED', null, ['comment' => $newComment]);
    send_json(['ok' => true, 'comment' => $newComment], 201);
}

// PUT /api/comments?id=... - update a comment
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    parse_str($_SERVER['QUERY_STRING'] ?? '', $params);
    $id = $params['id'] ?? null;
    $logger->log('INFO', 'PUT_RECEIVED', null, ['id' => $id]);
    if (!$id) {
        $logger->warn('PUT_ERROR', 'Missing id', []);
        send_json(['ok' => false, 'error' => 'Missing id'], 400);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $logger->log('DEBUG', 'PUT_INPUT', null, ['input' => $input]);
    if (!is_array($input)) {
        $logger->warn('PUT_ERROR', 'Invalid input', []);
        send_json(['ok' => false, 'error' => 'Invalid input'], 400);
    }
    $comments = read_comments($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $found = false;
    foreach ($comments as &$comment) {
        if ($comment['id'] === $id) {
            if (isset($input['content'])) $comment['content'] = trim($input['content']);
            if (isset($input['author'])) $comment['author'] = trim($input['author']);
            $comment['updated_at'] = date('c');
            $found = true;
            $logger->log('INFO', 'PUT_UPDATED', null, ['comment' => $comment]);
            break;
        }
    }
    if (!$found) {
        $logger->warn('PUT_ERROR', 'Comment not found', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Comment not found'], 404);
    }
    $result = write_comments($GLOBALS['DATA_FILE'], $comments, $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('PUT_ERROR', 'Failed to write updated comment', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Failed to write comment'], 500);
    }
    send_json(['ok' => true]);
}

// DELETE /api/comments?id=... - delete a comment
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    parse_str($_SERVER['QUERY_STRING'] ?? '', $params);
    $id = $params['id'] ?? null;
    $logger->log('INFO', 'DELETE_RECEIVED', null, ['id' => $id]);
    if (!$id) {
        $logger->warn('DELETE_ERROR', 'Missing id', []);
        send_json(['ok' => false, 'error' => 'Missing id'], 400);
    }
    $comments = read_comments($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $newComments = array_filter($comments, function($c) use ($id) { return $c['id'] !== $id; });
    if (count($newComments) === count($comments)) {
        $logger->warn('DELETE_ERROR', 'Comment not found', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Comment not found'], 404);
    }
    $result = write_comments($GLOBALS['DATA_FILE'], array_values($newComments), $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('DELETE_ERROR', 'Failed to write comments after delete', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Failed to write comment'], 500);
    }
    $logger->log('INFO', 'DELETE_SUCCESS', null, ['id' => $id]);
    send_json(['ok' => true]);
}

// Fallback: method not allowed
$logger->warn('METHOD_NOT_ALLOWED', 'Method not allowed', ['method' => $_SERVER['REQUEST_METHOD']]);
send_json(['ok' => false, 'error' => 'Method not allowed'], 405);