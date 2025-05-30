<?php
/**
 * Admin, Health, and Self-test Handlers
 * Extracted from db.php for modularization.
 */

/**
 * Checks supplied admin token against config, logs all attempts.
 * Accept admin token only from HTTP header "Authorization: Bearer ..." or POST (never GET).
 * @param array $cfg
 * @param Logger $logger
 * @return bool
 */
function check_admin_token(array $cfg, Logger $logger): bool
{
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (stripos($hdr, 'Bearer ') === 0) {
        $token = trim(substr($hdr, 7));
    } else {
        $token = $_POST['token'] ?? '';
    }
    $ok = !empty($token) && hash_equals((string)$cfg['log_admin_token'], (string)$token);
    if (!$ok) {
        $logger->warn('ADMIN_TOKEN', 'Failed admin token check', ['ip'=>Logger::getClientIp()]);
    }
    return $ok;
}

/**
 * Responds with strict health check status.
 * @param Logger $logger
 * @return void
 */
function handle_health(Logger $logger): void
{
    error_log("[db.php] DEBUG: Entered handle_health()");
    $status = [
        'ok'     => true,
        'version'=> 'v2025.1',
        'php'    => PHP_VERSION,
        'time'   => date('c'),
        'uptime' => @file_exists('/proc/uptime') ? @file_get_contents('/proc/uptime') : '',
    ];
    error_log("[db.php] DEBUG: HEALTH status array = " . var_export($status, true));
    $logger->log('INFO', 'HEALTH_CHECK', 'OK', $status);
    error_log("[db.php] DEBUG: Exiting handle_health, about to respond_json");
    respond_json(true, 'Service healthy', $status, $logger, "OK");
}

/**
 * Modular self-test endpoint; checks logging, file perms, and config.
 * @param array $cfg
 * @param Logger $logger
 * @return void
 */
function handle_selftest(array $cfg, Logger $logger): void
{
    $status = ['log_path'=>$cfg['log_path'], 'log_writable'=>is_writable(dirname($cfg['log_path']))];
    try {
        $logger->log('INFO','SELF_TEST','BEGIN', $status);
        $logger->log('DEBUG','SELF_TEST','END', []);
        $ok = $status['log_writable'];
        respond_json($ok, $ok?'Self-test OK':'Log path is not writable', $status, $logger, $ok?"OK":"FAIL");
    } catch (\Throwable $ex) {
        respond_json(false, 'Self-test error: ' . $ex->getMessage(), $status, $logger, "FAIL");
    }
}