<?php
/**
 * antiabuse.php
 * Simple logging and rate limiting for anti-abuse protection on the backend API.
 * Logs requests by IP and user agent, and performs rate limiting.
 */

define('ANTIA_BUSE_LOG', __DIR__ . '/abuse.log');
define('ANTIA_BUSE_RATE_DIR', __DIR__); // Store rate files alongside module for simplicity.
define('ANTIA_BUSE_RATE_LIMIT', 30); // requests
define('ANTIA_BUSE_RATE_WINDOW', 60); // seconds

/**
 * Call this from your main entrypoint (before any business logic) to log and rate-limit.
 * Aborts request with HTTP 429 if rate limited.
 */
function antiabuse_pre_handle($action_or_endpoint = null)
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    $time = date('Y-m-d H:i:s');
    $endpoint = $action_or_endpoint ?? ($_GET['action'] ?? $_POST['action'] ?? 'unknown');
    $log_entry = json_encode([
        'time' => $time,
        'ip' => $ip,
        'ua' => $userAgent,
        'endpoint' => $endpoint
    ]) . "\n";

    // Log the request
    antiabuse_log($log_entry);

    // Enforce rate limit
    if (!antiabuse_check_rate_limit($ip)) {
        header('Retry-After: 60', true, 429);
        header('Content-Type: application/json; charset=utf-8', true, 429);
        echo json_encode([
            'ok' => false,
            'error' => 'Too many requests',
            'message' => 'You have exceeded the allowed rate limit (max ' . ANTIA_BUSE_RATE_LIMIT . ' requests per minute). Please slow down.'
        ], JSON_UNESCAPED_SLASHES);
        exit; // Hard abort
    }
}

/**
 * Appends a log entry to the anti-abuse log with exclusive lock.
 */
function antiabuse_log($entry)
{
    $logPath = ANTIA_BUSE_LOG;
    $fp = fopen($logPath, 'a');
    if ($fp) {
        flock($fp, LOCK_EX);
        fwrite($fp, $entry);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

/**
 * Checks and updates rate bucketing per IP.
 * Returns true if under limit, false if exceeded.
 */
function antiabuse_check_rate_limit($ip)
{
    $base = preg_replace('/[^a-zA-Z0-9_]/', '_', $ip);
    $rateFile = ANTIA_BUSE_RATE_DIR . "/abuse_rate_{$base}.json";
    $now = time();
    $window = ANTIA_BUSE_RATE_WINDOW;

    // Use a rolling window (array of timestamps for buckets)
    $counts = [];
    $fp = fopen($rateFile, 'c+');
    if ($fp === false) return true; // fail open, don't halt legit traffic
    flock($fp, LOCK_EX);

    $contents = stream_get_contents($fp);
    if ($contents) {
        $counts = json_decode($contents, true);
        if (!is_array($counts)) {
            $counts = [];
        }
    } else {
        $counts = [];
    }

    // Prune old timestamps (keep only within window)
    $counts = array_filter($counts, function($ts) use ($now, $window) {
        return ($ts > $now - $window);
    });

    // Add this request
    $counts[] = $now;

    // Save updated
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($counts));
    fflush($fp);

    flock($fp, LOCK_UN);
    fclose($fp);

    // Enforce limit
    return count($counts) <= ANTIA_BUSE_RATE_LIMIT;
}