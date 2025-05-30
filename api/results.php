<?php
require_once __DIR__ . '/../Logger.php';

// Initialize Logger
$logger = new Logger([
    'log_path' => __DIR__ . '/../db-' . date('Y-m-d') . '.log',
    'log_level' => 'DEBUG',
    'log_perms' => 0640,
    'log_days' => 14
], [
    'api' => 'results.php',
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

$DATA_FILE = __DIR__ . '/../results.json';

// Utility: Read all results with shared lock and logging
function read_results($file, $logger) {
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

// Utility: Write all results with atomic write and exclusive lock
function write_results($file, $data, $logger) {
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

// GET /api/results[?prompt_id=...] - list all results, optionally filtered by prompt_id
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $logger->log('INFO', 'GET_RESULTS', null, []);
    $results = read_results($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    if (isset($_GET['prompt_id'])) {
        $pid = $_GET['prompt_id'];
        $logger->log('INFO', 'GET_FILTER_PROMPT_ID', null, ['prompt_id' => $pid]);
        $results = array_values(array_filter($results, function($r) use ($pid) {
            return isset($r['prompt_id']) && $r['prompt_id'] === $pid;
        }));
    }
    send_json(['ok' => true, 'results' => $results]);
}

// POST /api/results - create a new result
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $logger->log('INFO', 'POST_RECEIVED', null, ['input' => $input]);
    if (!is_array($input) || !isset($input['prompt_id']) || !isset($input['content'])) {
        $logger->warn('POST_ERROR', 'Missing required fields', ['input' => $input]);
        send_json(['ok' => false, 'error' => 'Missing required fields'], 400);
    }
    // Defense-in-depth: strip HTML tags from result content and author
    $content = trim($input['content']);
    $content = strip_tags($content);
    $author = isset($input['author']) ? trim($input['author']) : null;
    if ($author) {
        $author = strip_tags($author);
    }
    $results = read_results($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $newResult = [
        'id' => uniqid('result_', true),
        'prompt_id' => $input['prompt_id'],
        'content' => $content,
        'author' => $author,
        'created_at' => date('c'),
        'updated_at' => date('c'),
    ];
    $results[] = $newResult;
    $result = write_results($GLOBALS['DATA_FILE'], $results, $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('POST_ERROR', 'Failed to write new result', ['result' => $newResult]);
        send_json(['ok' => false, 'error' => 'Failed to write result'], 500);
    }
    $logger->log('INFO', 'POST_CREATED', null, ['result' => $newResult]);
    send_json(['ok' => true, 'result' => $newResult], 201);
}

// PUT /api/results?id=... - update a result
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
    $results = read_results($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $found = false;
    foreach ($results as &$result) {
        if ($result['id'] === $id) {
            if (isset($input['content'])) $result['content'] = trim($input['content']);
            if (isset($input['author'])) $result['author'] = trim($input['author']);
            $result['updated_at'] = date('c');
            $found = true;
            $logger->log('INFO', 'PUT_UPDATED', null, ['result' => $result]);
            break;
        }
    }
    if (!$found) {
        $logger->warn('PUT_ERROR', 'Result not found', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Result not found'], 404);
    }
    $result = write_results($GLOBALS['DATA_FILE'], $results, $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('PUT_ERROR', 'Failed to write updated result', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Failed to write result'], 500);
    }
    send_json(['ok' => true]);
}

// DELETE /api/results?id=... - delete a result
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    parse_str($_SERVER['QUERY_STRING'] ?? '', $params);
    $id = $params['id'] ?? null;
    $logger->log('INFO', 'DELETE_RECEIVED', null, ['id' => $id]);
    if (!$id) {
        $logger->warn('DELETE_ERROR', 'Missing id', []);
        send_json(['ok' => false, 'error' => 'Missing id'], 400);
    }
    $results = read_results($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $newResults = array_filter($results, function($r) use ($id) { return $r['id'] !== $id; });
    if (count($newResults) === count($results)) {
        $logger->warn('DELETE_ERROR', 'Result not found', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Result not found'], 404);
    }
    $result = write_results($GLOBALS['DATA_FILE'], array_values($newResults), $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('DELETE_ERROR', 'Failed to write results after delete', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Failed to write result'], 500);
    }
    $logger->log('INFO', 'DELETE_SUCCESS', null, ['id' => $id]);
    send_json(['ok' => true]);
}

// Fallback: method not allowed
$logger->warn('METHOD_NOT_ALLOWED', 'Method not allowed', ['method' => $_SERVER['REQUEST_METHOD']]);
send_json(['ok' => false, 'error' => 'Method not allowed'], 405);