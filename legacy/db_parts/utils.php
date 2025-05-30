<?php
/**
 * Utility Functions
 * Extracted from db.php for modularization.
 */

/**
 * Strict HTML sanitizer for backend (minimal tag set with no JS/events/attrs).
 * Only use on user-supplied Markdown/HTML fields before DB save.
 * @param string $html
 * @return string sanitized
 */
function sanitize_html_field($html) {
    static $tags = '<b><strong><i><em><code><pre><ul><ol><li><blockquote><a>';
    $clean = strip_tags($html, $tags);
    // Remove any occurrences of on* attributes, style, script/css blocks.
    $clean = preg_replace('/<(script|style)[^>]*?>.*?<\/\\1>/is', '', $clean);
    $clean = preg_replace('/on\w+="[^"]*"/i', '', $clean);
    $clean = preg_replace('/on\w+=\'[^\']*\'/i', '', $clean);
    $clean = preg_replace('/on\w+=\S+/i', '', $clean);
    $clean = preg_replace('/javascript:/i', '', $clean);
    return $clean;
}

/**
 * Strict schema/entity field validator.
 * Checks types, required, max length, truncates or rejects as necessary.
 * Returns [bool valid, array filtered, array errors]
 */
function validate_entity($type, $obj, $SCHEMAS) {
    $schema = $SCHEMAS[$type] ?? null;
    $errs = [];
    if (!$schema) return [false, [], ['No schema for type']];
    $san = [];
    foreach ($schema as $fld => $rule) {
        if (($rule['required']??false) && (!isset($obj[$fld]) || $obj[$fld]==='')) $errs[] = "Missing required: $fld";
        if (!isset($obj[$fld])) continue;
        $v = $obj[$fld];
        switch ($rule['type']) {
            case 'string':
                if (!is_string($v)) { $errs[] = "Invalid type for $fld"; continue 2; }
                $san[$fld] = sanitize_html_field(mb_substr($v,0,$rule['max']??10000));
                break;
            case 'array':
                if (!is_array($v))      $errs[] = "Invalid type for $fld";
                else $san[$fld]= array_map(fn($x)=>sanitize_html_field((string)$x), $v);
                break;
            case 'int':
                if (!is_numeric($v))    $errs[] = "Invalid int for $fld";
                else $san[$fld] = intval($v);
                break;
            default:
                $san[$fld] = $v;
        }
    }
    // Remove/ignore keys not in schema (strict allow-list)
    foreach ($obj as $k=>$v) if (!isset($schema[$k])) {/* skip */}
    return [count($errs)===0, $san, $errs];
}

/**
 * Respond to client in structured JSON, always logs result, always exits.
 * @param bool $ok
 * @param string $msg
 * @param mixed $data
 * @param Logger|null $logger
 * @param string $status
 * @param array $context
 * @param int $http_code
 * @return void
 */
function respond_json(
    bool $ok,
    string $msg,
    $data = null,
    $logger = null,
    string $status = "OK",
    array $context = [],
    int $http_code = 200
): void {
    http_response_code($ok ? $http_code : 400);
    if ($logger instanceof Logger) {
        $logger->endRequest($ok ? $status : "FAIL", [
            'msg'      => $msg,
            'result'   => $ok ? "OK" : "FAIL",
            'response' => Logger::sanitizeAndMask($data),
            'context'  => $context
        ]);
    }
    echo json_encode([
        'ok'      => $ok,
        'msg'     => $msg,
        'data'    => $data,
        'status'  => $status,
        'time'    => date('c')
    ]);
    exit;
}

/**
 * Atomically writes data as JSON to a DB file, with locking, fsync, rename, and perms.
 * @param string $file
 * @param mixed $data
 * @param array $cfg
 * @param Logger $logger
 * @param string $type
 * @return array [ok, msg, bytes]
 */
function atomic_write_json(string $file, $data, array $cfg, Logger $logger, string $type): array
{
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        $msg = 'JSON encode error: ' . json_last_error_msg();
        $logger->error('DB_WRITE', $msg, ['file'=>$file, 'type'=>$type]);
        return ['ok'=>false, 'msg'=>$msg, 'bytes'=>0];
    }
    $tmp = $file . '.tmp.' . bin2hex(random_bytes(4));
    $f = fopen($tmp, 'w');
    if ($f === false) {
        $msg = "Failed to create tmp file for DB: $tmp";
        $logger->error('DB_WRITE', $msg, ['file'=>$file, 'type'=>$type]);
        return ['ok'=>false, 'msg'=>$msg, 'bytes'=>0];
    }
    fwrite($f, $json);
    fflush($f);
    fclose($f);
    if (!@rename($tmp, $file)) {
        @unlink($tmp);
        $msg = "Atomic rename failure for $file";
        $logger->error('DB_WRITE', $msg, ['file'=>$file, 'type'=>$type]);
        return ['ok'=>false, 'msg'=>$msg, 'bytes'=>0];
    }
    if (function_exists('sync')) { @sync(); }
    @chmod($file, $cfg['file_perms'] ?? 0640);
    $bytes = strlen($json);
    $logger->log('INFO', 'DB_WRITE', 'OK', ['file'=>$file, 'bytes'=>$bytes, 'type'=>$type]);
    return ['ok'=>true, 'msg'=>'OK', 'bytes'=>$bytes];
}

/**
 * Reads and parses a JSON DB file; if missing, returns [] and logs.
 * @param string $file
 * @param Logger $logger
 * @param string $type
 * @return array
 */
function atomic_read_json(string $file, Logger $logger, string $type): array
{
    if (!file_exists($file)) {
        $logger->warn('DB_READ', 'Missing JSON file', ['file'=>$file,'type'=>$type]);
        return [];
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        $logger->error('DB_READ', 'Read failed', ['file'=>$file,'type'=>$type]);
        return [];
    }
    $dec = json_decode($raw, true);
    if (!is_array($dec)) {
        $logger->error('DB_READ', 'JSON decode fail', ['file'=>$file,'type'=>$type,'raw'=>$raw]);
        return [];
    }
    return $dec;
}

// Helper: determine if array is associative
if (!function_exists('is_assoc_array')) {
    function is_assoc_array($arr) {
        if (!is_array($arr)) return false;
        return array_keys($arr) !== range(0, count($arr) - 1);
    }
}