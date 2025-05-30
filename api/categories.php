<?php
require_once __DIR__ . '/../Logger.php';

// Initialize Logger
$logger = new Logger([
    'log_path' => __DIR__ . '/../db-' . date('Y-m-d') . '.log',
    'log_level' => 'DEBUG',
    'log_perms' => 0640,
    'log_days' => 14
], [
    'api' => 'categories.php',
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

$DATA_FILE = __DIR__ . '/../categories.json';

// Utility: Read all categories with shared lock and logging
function read_categories($file, $logger) {
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

// Utility: Write all categories with atomic write and exclusive lock
function write_categories($file, $data, $logger) {
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

// GET /api/categories - list all categories
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $logger->log('INFO', 'GET_CATEGORIES', null, []);
    $categories = read_categories($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $logger->log('INFO', 'GET_RETURN', null, ['count' => count($categories)]);
    send_json(['ok' => true, 'categories' => $categories]);
}

// POST /api/categories - create a new category
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $logger->log('INFO', 'POST_RECEIVED', null, ['input' => $input]);
    if (!is_array($input) || !isset($input['name'])) {
        $logger->warn('POST_ERROR', 'Missing required fields', ['input' => $input]);
        send_json(['ok' => false, 'error' => 'Missing required fields'], 400);
    }
    $categories = read_categories($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $newCategory = [
        'id' => uniqid('cat_', true),
        'name' => trim($input['name']),
        'created_at' => date('c'),
        'updated_at' => date('c'),
    ];
    $categories[] = $newCategory;
    $result = write_categories($GLOBALS['DATA_FILE'], $categories, $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('POST_ERROR', 'Failed to write new category', ['category' => $newCategory]);
        send_json(['ok' => false, 'error' => 'Failed to write category'], 500);
    }
    $logger->log('INFO', 'POST_CREATED', null, ['category' => $newCategory]);
    send_json(['ok' => true, 'category' => $newCategory], 201);
}

// PUT /api/categories?id=... - update a category
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
    $categories = read_categories($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $found = false;
    foreach ($categories as &$category) {
        if ($category['id'] === $id) {
            if (isset($input['name'])) $category['name'] = trim($input['name']);
            $category['updated_at'] = date('c');
            $found = true;
            $logger->log('INFO', 'PUT_UPDATED', null, ['category' => $category]);
            break;
        }
    }
    if (!$found) {
        $logger->warn('PUT_ERROR', 'Category not found', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Category not found'], 404);
    }
    $result = write_categories($GLOBALS['DATA_FILE'], $categories, $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('PUT_ERROR', 'Failed to write updated category', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Failed to write category'], 500);
    }
    send_json(['ok' => true]);
}

// DELETE /api/categories?id=... - delete a category
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    parse_str($_SERVER['QUERY_STRING'] ?? '', $params);
    $id = $params['id'] ?? null;
    $logger->log('INFO', 'DELETE_RECEIVED', null, ['id' => $id]);
    if (!$id) {
        $logger->warn('DELETE_ERROR', 'Missing id', []);
        send_json(['ok' => false, 'error' => 'Missing id'], 400);
    }
    $categories = read_categories($GLOBALS['DATA_FILE'], $GLOBALS['logger']);
    $newCategories = array_filter($categories, function($c) use ($id) { return $c['id'] !== $id; });
    if (count($newCategories) === count($categories)) {
        $logger->warn('DELETE_ERROR', 'Category not found', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Category not found'], 404);
    }
    $result = write_categories($GLOBALS['DATA_FILE'], array_values($newCategories), $GLOBALS['logger']);
    if ($result === false) {
        $logger->error('DELETE_ERROR', 'Failed to write categories after delete', ['id' => $id]);
        send_json(['ok' => false, 'error' => 'Failed to write category'], 500);
    }
    $logger->log('INFO', 'DELETE_SUCCESS', null, ['id' => $id]);
    send_json(['ok' => true]);
}

// Fallback: method not allowed
$logger->warn('METHOD_NOT_ALLOWED', 'Method not allowed', ['method' => $_SERVER['REQUEST_METHOD']]);
send_json(['ok' => false, 'error' => 'Method not allowed'], 405);