<?php
require_once __DIR__ . '/../Logger.php';

// Initialize Logger
$logger = new Logger([
    'log_path' => __DIR__ . '/../db-' . date('Y-m-d') . '.log',
    'log_level' => 'DEBUG',
    'log_perms' => 0640,
    'log_days' => 14
], [
    'api' => 'tags.php',
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

$DATA_FILE = __DIR__ . '/../tags.json';

// Utility: Read all tags with shared lock and logging
function read_tags($file, $logger) {
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

// Utility: Write all tags with atomic write and exclusive lock
function write_tags($file, $data, $logger) {
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

// GET /api/tags - list all tags
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $logger->log('INFO', 'GET_TAGS', null, []);
    $tags = read_tags($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    send_json(['ok' => true, 'tags' => $tags]);
}

// POST /api/tags - create a new tag
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $logger->log('INFO', 'POST_RECEIVED', null, ['input' => $input]);
    if (!is_array($input) || !isset($input['name'])) {
        $logger->warn('POST_ERROR', 'Missing required fields', ['input' => $input]);
        send_json(['ok' => false, 'error' => 'Missing required fields'], 400);
    }
    $tagName = trim($input['name']);
    if (strpos($tagName, ',') !== false) {
        $logger->warn('POST_ERROR', 'Tag names cannot contain commas', ['name' => $tagName]);
        send_json(['ok' => false, 'error' => 'Tag names cannot contain commas.'], 400);
    }
    $tags = read_tags($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $newTag = [
        'id' => uniqid('tag_', true),
        'name' => $tagName,
        'created_at' => date('c'),
        'updated_at' => date('c'),
    ];
    $tags[] = $newTag;
    $result = write_tags($GLOBALS['DATA_FILE'], $tags, $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('POST_ERROR', 'Failed to write new tag', ['tag' => $newTag]);
        send_json(['ok' => false, 'error' => 'Failed to write tag'], 500);
    }
    $logger->log('INFO', 'POST_CREATED', null, ['tag' => $newTag]);
    send_json(['ok' => true, 'tag' => $newTag], 201);
}

// PUT /api/tags?id=... - update a tag
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
    $tags = read_tags($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $found = false;
    foreach ($tags as &$tag) {
        if ($tag['id'] === $id) {
            if (isset($input['name'])) $tag['name'] = trim($input['name']);
            $tag['updated_at'] = date('c');
            $found = true;
            $logger->log('INFO', 'PUT_UPDATED', null, ['tag' => $tag]);
            break;
        }
    }
    if (!$found) {
        $logger->warn('PUT_ERROR', 'Tag not found', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Tag not found'], 404);
    }
    $result = write_tags($GLOBALS['DATA_FILE'], $tags, $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('PUT_ERROR', 'Failed to write updated tag', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Failed to write tag'], 500);
    }
    send_json(['ok' => true]);
}

// DELETE /api/tags?id=... - delete a tag
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    parse_str($_SERVER['QUERY_STRING'] ?? '', $params);
    $id = $params['id'] ?? null;
    $logger->log('INFO', 'DELETE_RECEIVED', null, ['id' => $id]);
    if (!$id) {
        $logger->warn('DELETE_ERROR', 'Missing id', []);
        send_json(['ok' => false, 'error' => 'Missing id'], 400);
    }
    $tags = read_tags($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $newTags = array_filter($tags, function($t) use ($id) { return $t['id'] !== $id; });
    if (count($newTags) === count($tags)) {
        $logger->warn('DELETE_ERROR', 'Tag not found', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Tag not found'], 404);
    }
    $result = write_tags($GLOBALS['DATA_FILE'], array_values($newTags), $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('DELETE_ERROR', 'Failed to write tags after delete', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Failed to write tag'], 500);
    }
    $logger->log('INFO', 'DELETE_SUCCESS', null, ['id' => $id]);
    send_json(['ok' => true]);
}

// Fallback: method not allowed
$logger->warn('METHOD_NOT_ALLOWED', 'Method not allowed', ['method' => $_SERVER['REQUEST_METHOD']]);
send_json(['ok' => false, 'error' => 'Method not allowed'], 405);