<?php
/**
 * Logger Integration and Global Error/Exception Handlers
 * Extracted from db.php for modularization.
 */

// Ensure Logger class is loaded
require_once __DIR__ . '/../Logger.php';

// Helper to gather request context for Logger
function get_request_context(): array
{
    $headers = [];
    foreach ($_SERVER as $k => $v) {
        if (strpos($k, 'HTTP_') === 0) {
            $hn = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($k,5)))));
            $headers[$hn] = $v;
        }
    }
    $headers = Logger::sanitizeAndMask($headers);
    $cookies = Logger::sanitizeAndMask($_COOKIE);
    $request_method = $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN';
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $ref = $_SERVER['HTTP_REFERER'] ?? '';
    $fp = hash('sha256', (Logger::getClientIp() ?? '') . ($ua ?? '') . ($_SERVER['HTTP_ACCEPT'] ?? ''));
    $session_id = session_id() ?: ($_COOKIE['PHPSESSID'] ?? null);
    $get_params = Logger::sanitizeAndMask($_GET);
    $post_params = Logger::sanitizeAndMask($_POST);
    $raw_body = file_get_contents('php://input');
    $body_excerpt = mb_strlen($raw_body) > 256 ? mb_substr($raw_body, 0, 256) . '...[truncated]' : $raw_body;

    return [
        'method'    => $request_method,
        'uri'       => $uri,
        'headers'   => $headers,
        'cookies'   => $cookies,
        'user_agent'=> $ua,
        'referer'   => $ref,
        'session_id'=> $session_id,
        'visitor_fp'=> $fp,
        'get'       => $get_params,
        'post'      => $post_params,
        'body'      => $body_excerpt
    ];
}

// Initialize Logger
$logger = new Logger($config, get_request_context());

// Global error handling
set_error_handler(function ($errno, $errstr, $errfile, $errline) use ($logger) {
    if (!(error_reporting() & $errno)) return false;
    $levels = [
        E_ERROR => 'ERROR', E_WARNING => 'WARN', E_PARSE => 'ERROR', E_NOTICE => 'WARN',
        E_CORE_ERROR => 'ERROR', E_CORE_WARNING => 'WARN', E_COMPILE_ERROR => 'ERROR', E_COMPILE_WARNING => 'WARN',
        E_USER_ERROR => 'ERROR', E_USER_WARNING => 'WARN', E_USER_NOTICE => 'WARN',
        E_STRICT => 'DEBUG', E_RECOVERABLE_ERROR => 'ERROR', E_DEPRECATED => 'WARN', E_USER_DEPRECATED => 'WARN'
    ];
    $level = $levels[$errno] ?? 'ERROR';
    $logger->log($level, 'PHP_ERROR', 'FAIL', [
        'errno'=>$errno, 'errfile'=>$errfile, 'errline'=>$errline, 'message'=>$errstr
    ]);
    respond_json(false, 'PHP error', ['err'=>$errstr, 'loc'=>"$errfile:$errline"], $logger, "FAIL", [], 500);
    return true;
});
set_exception_handler(function ($ex) use ($logger) {
    $logger->log('ERROR', 'PHP_EXCEPTION', 'FAIL', [
        'type'=>get_class($ex), 'message'=>$ex->getMessage(), 'code'=>$ex->getCode(),
        'file'=>$ex->getFile(), 'line'=>$ex->getLine(), 'trace'=>$ex->getTraceAsString()
    ]);
    respond_json(false, 'Internal exception', ['err'=>$ex->getMessage()], $logger, "FAIL", [], 500);
});
register_shutdown_function(function () use ($logger) {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        $logger->log('ERROR','PHP_FATAL','FAIL', [
            'errno'=>$err['type'],'errfile'=>$err['file'],'errline'=>$err['line'],'message'=>$err['message']
        ]);
        respond_json(false, 'Fatal error', ['err'=>$err['message'], 'loc'=>($err['file'].':'.$err['line'])], $logger, "FAIL", [], 500);
    }
});