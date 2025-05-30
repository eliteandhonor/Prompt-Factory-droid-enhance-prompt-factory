<?php
/**
 * api_utils.php - Shared utilities for API endpoints (error handling, file ops, CORS, validation, auth)
 */

// Always return JSON, even on fatal error
function send_fatal_json_error($msg, $code = 500) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($code);
    }
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

// Standard JSON response
function send_json($data, $code = 200) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }
    http_response_code($code);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// CORS and JSON header setup
function setup_api_headers() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// Read JSON file with logging
function read_json_file_with_log($file, $logger = null, $type = 'data') {
    if (!file_exists($file)) {
        if ($logger) $logger->warn('FILE_READ', "File does not exist", ['file' => $file, 'type' => $type]);
        return [];
    }
    $fp = fopen($file, 'r');
    if (!$fp) {
        if ($logger) $logger->error('FILE_READ', "Failed to open file for reading", ['file' => $file, 'type' => $type]);
        return [];
    }
    $data = [];
    if (flock($fp, LOCK_SH)) {
        $json = stream_get_contents($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        $data = json_decode($json, true);
        if (!is_array($data)) {
            if ($logger) $logger->error('JSON_PARSE', "Failed to parse JSON", ['file' => $file, 'type' => $type, 'snippet' => substr($json, 0, 100)]);
            return [];
        }
        if ($logger) $logger->log('DEBUG', 'FILE_READ', 'OK', ['file' => $file, 'type' => $type, 'count' => count($data)]);
        return $data;
    } else {
        if ($logger) $logger->error('FILE_LOCK', "Failed to acquire shared lock for reading", ['file' => $file, 'type' => $type]);
        fclose($fp);
        return [];
    }
}

// Write JSON file with logging and atomicity
function write_json_file_with_log($file, $data, $logger = null, $type = 'data') {
    $tmpFile = $file . '.tmp';
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $fp = fopen($tmpFile, 'w');
    if (!$fp) {
        if ($logger) $logger->error('FILE_WRITE', "Failed to open temp file for writing", ['file' => $tmpFile, 'type' => $type]);
        return false;
    }
    if (flock($fp, LOCK_EX)) {
        $bytes = fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        if ($bytes === false) {
            if ($logger) $logger->error('FILE_WRITE', "Failed to write data to temp file", ['file' => $tmpFile, 'type' => $type]);
            return false;
        }
        if (!rename($tmpFile, $file)) {
            if ($logger) $logger->error('FILE_WRITE', "Failed to rename temp file to data file", ['tmp' => $tmpFile, 'file' => $file, 'type' => $type]);
            return false;
        }
        if ($logger) $logger->log('DEBUG', 'FILE_WRITE', 'OK', ['file' => $file, 'type' => $type, 'bytes' => $bytes]);
        return $bytes;
    } else {
        if ($logger) $logger->error('FILE_LOCK', "Failed to acquire exclusive lock for writing", ['file' => $tmpFile, 'type' => $type]);
        fclose($fp);
        return false;
    }
}

// Validate array/object against a schema (field => type)
function validate_schema($data, $schema) {
    $errors = [];
    foreach ($schema as $field => $type) {
        if (!array_key_exists($field, $data)) {
            $errors[] = "Missing field: $field";
            continue;
        }
        $value = $data[$field];
        switch ($type) {
            case 'string':
                if (!is_string($value) || trim($value) === '') {
                    $errors[] = "Field '$field' must be a non-empty string";
                }
                break;
            case 'array':
                if (!is_array($value)) {
                    $errors[] = "Field '$field' must be an array";
                }
                break;
            default:
                $errors[] = "Unknown type for field '$field'";
        }
    }
    return $errors;
}

// Stub for authentication/authorization (expand as needed)
function require_auth($role = null) {
    // Example: check session/cookie/token, or always allow for now
    // If not authorized, call send_fatal_json_error('Unauthorized', 401);
    return true;
}