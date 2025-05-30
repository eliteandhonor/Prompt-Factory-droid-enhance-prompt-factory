<?php
declare(strict_types=1);
/**
 * db.php
 * Modular, atomic, privacy-hardened PHP JSON DB API – orchestrator file.
 * All business logic is now refactored into db_parts/ modules.
 */

// ---- Modern, strict security headers ----
header('Content-Type: application/json; charset=utf-8');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; form-action 'self'; upgrade-insecure-requests");
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

/**
 * ---- Core modules (modularized) ----
 * All logic extracted for clarity, maintainability, and testability.
 */
require_once __DIR__ . '/db_parts/config.php';
require_once __DIR__ . '/db_parts/attribution.php';
require_once __DIR__ . '/db_parts/utils.php';
require_once __DIR__ . '/db_parts/logger_integration.php';
require_once __DIR__ . '/db_parts/admin_handlers.php';
require_once __DIR__ . '/db_parts/crud_handlers.php';
require_once __DIR__ . '/db_parts/antiabuse.php';

// ---- ENDPOINT Route Dispatching ----
$action = $_GET['action'] ?? $_POST['action'] ?? null;
$type = $_GET['type'] ?? $_POST['type'] ?? 'prompts';
antiabuse_pre_handle($action);

// Health endpoint
if ($action === 'health' || isset($_GET['health'])) {
    handle_health($logger);
}

// Self-test endpoint
if ($action === 'selftest' || isset($_GET['selftest'])) {
    handle_selftest($config, $logger);
}

// Admin log endpoints
if ($action === 'log' || isset($_GET['log']) || isset($_POST['log'])) {
    if (!check_admin_token($config, $logger)) respond_json(false, "Admin denied", null, $logger, "PERM", [], 403);
    $what = $_GET['log'] ?? $_POST['log'] ?? $action;
    $logfile = $config['log_path'];

    if ($what === 'download') {
        if (!file_exists($logfile)) { $logger->error('ADMIN_LOG','Log file not found'); respond_json(false,"Log not found",null,$logger,"NOTFOUND"); }
        header('Content-Type: text/plain');
        header('Content-Disposition: attachment; filename="db.log"');
        readfile($logfile);
        $logger->log('INFO','ADMIN_LOG','DOWNLOAD',[]);
        exit;
    } elseif ($what === 'view') {
        if (!file_exists($logfile)) { $logger->error('ADMIN_LOG','Log file not found'); respond_json(false,"Log not found",null,$logger,"NOTFOUND"); }
        $log_content = @file_get_contents($logfile);
        $logger->log('INFO','ADMIN_LOG','VIEW',[]);
        respond_json(true,'Log retrieved',$log_content,$logger,"OK");
    } elseif ($what === 'reset') {
        file_put_contents($logfile, '');
        $logger->log('INFO','ADMIN_LOG','RESET',[]);
        respond_json(true, 'Log reset', null, $logger, "OK");
    } else {
        $logger->warn('ADMIN_LOG','Unknown log action',['action'=>$what]);
        respond_json(false, 'Unknown log action', null, $logger, 'INVDATA');
    }
}

// Validate requested DB type
$db_files = $config['db_files'];
if (!isset($db_files[$type])) {
    $logger->error('TYPE_CHECK','Invalid type',['type'=>$type]);
    respond_json(false, 'Invalid type', null, $logger, 'INVDATA', ['type'=>$type], 400);
}

// Core DB file loading
$dbFile = $db_files[$type];
$data = atomic_read_json($dbFile, $logger, $type);

// Log incoming request
$logger->startRequest($action ?: 'list', $type, get_request_context());

// Handle CRUD (list/add/edit/delete) actions
$added = handle_crud($action, $type, $data, $config, $SCHEMAS, $logger);

// Persist mutations for add, edit, delete
if (in_array($action, ['add','edit','delete'])) {
    $res = atomic_write_json($dbFile, $data, $config, $logger, $type);
    if (!$res['ok']) {
        respond_json(false, "Failed to write db file: ".$res['msg'], null, $logger, "FAIL", ['file'=>$dbFile], 500);
    } else {
        // For /add, only return just-added prompt(s), not the entire file
        $msg = (is_array($added) && count($added) === 1) ? 'Prompt added' : 'Prompts added';
        respond_json(true, $msg, (is_array($added) && count($added) === 1 ? $added[0] : $added), $logger, 'OK');
    }
}