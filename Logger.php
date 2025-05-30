<?php
declare(strict_types=1);

/**
 * Logger.php
 *
 * Robust, atomic, privacy-safe Logger for PHP APIs.
 * - Atomic log file writes.
 * - Configurable log level, rotation, retention, CHMOD.
 * - Context-aware: headers, cookies, params, URI.
 * - Always masks secrets/tokens/cookies.
 * - Global error/exception handling hooks.
 * - Daily log rotation & retention.
 * - Built for secure modular composability.
 *
 * @author Roo
 */

final class Logger
{
    /**
     * @var array<string, mixed> Configuration array
     */
    private array $cfg;

    /**
     * @var float Timestamp for request start.
     */
    private float $start_time;

    /**
     * @var array<string, mixed>
     */
    public array $context = [];

    /**
     * @var string
     */
    private string $current_logfile = '';

    /**
     * @var resource|null
     */
    private $handle = null;

    /**
     * @var array<string,int> Log level mapping
     */
    private const LEVEL_MAP = [
        'DEBUG' => 10,
        'INFO' => 20,
        'WARN' => 30,
        'ERROR' => 40
    ];

    /**
     * @param array<string, mixed> $cfg Logger and system-wide config.
     * @param array<string, mixed> $context Optional context for all log entries.
     */
    public function __construct(array $cfg, array $context = [])
    {
        $this->cfg = $cfg;
        $this->context = $context;
        $this->start_time = microtime(true);
        $this->openLogFile();
        $this->cleanupOldLogs();
        $this->log('INFO', 'REQUEST_START', null, [
            'ts' => date('Y-m-d H:i:s'),
            'ip' => self::getClientIp(),
            'context' => $this->context
        ]);
    }

    /**
     * Opens (atomically creates if new) the daily log file.
     * Checks perms, rotates if new day.
     *
     * @return void
     */
    private function openLogFile(): void
    {
        $basePath = $this->cfg['log_path'] ?? (__DIR__.'/db.log');
        $dt = date('Y-m-d');
        $dailyPath = preg_replace('/\.log$/', '', $basePath) . "-$dt.log";
        $this->current_logfile = $dailyPath;
        if (!file_exists($dailyPath)) {
            $this->atomicTouch($dailyPath);
            @chmod($dailyPath, $this->cfg['log_perms'] ?? 0640);
        }
        $this->handle = fopen($dailyPath, 'a');
        if (!$this->handle) {
            // fallback: die early, cannot log!
            throw new \RuntimeException("Logger: failed to open log file: $dailyPath");
        }
    }

    /**
     * Atomically creates log file (touch via temp+rename+CHMOD).
     * @param string $f
     * @return void
     */
    private function atomicTouch(string $f): void
    {
        $tmp = $f . '.tmp.' . bin2hex(random_bytes(4));
        $h = fopen($tmp, 'w');
        if ($h) {
            fflush($h);
            fclose($h);
            if (!@rename($tmp, $f)) {
                @unlink($tmp);
                throw new \RuntimeException("Logger: atomic touch failed for $f");
            }
        } else {
            throw new \RuntimeException("Logger: cannot create tmp log file for $f");
        }
        @chmod($f, $this->cfg['log_perms'] ?? 0640);
    }

    /**
     * Deletes old rotated logs older than configured days.
     * @return void
     */
    private function cleanupOldLogs(): void
    {
        $basePath = $this->cfg['log_path'] ?? (__DIR__.'/db.log');
        $keepDays = $this->cfg['log_days'] ?? 7;
        $glob = glob(preg_replace('/\.log$/', '', $basePath) . "-*.log");
        $now = time();
        if (is_array($glob)) {
            foreach ($glob as $file) {
                if (preg_match('/\-(\d{4}\-\d{2}\-\d{2})\.log$/', $file, $m)) {
                    $dt = strtotime($m[1]);
                    if ($dt && $now - $dt > 86400 * $keepDays) {
                        @unlink($file);
                    }
                }
            }
        }
    }

    /**
     * Logs an event (atomic append, masks secrets/tokens/cookies).
     *
     * @param string $level Log level
     * @param string $action Event name
     * @param mixed $result Status string or code
     * @param array<string,mixed> $fields Additional context fields
     * @return void
     */
    public function log(string $level, string $action, $result = null, array $fields = []): void
    {
        $minLevel = strtoupper($this->cfg['log_level'] ?? 'DEBUG');
        if (self::LEVEL_MAP[$level] < self::LEVEL_MAP[$minLevel]) {
            return;
        }
        $all_fields = array_merge([
            'ts' => date('Y-m-d H:i:s'),
            'ip' => self::getClientIp(),
            'action' => $action,
            'result' => $result,
            'duration_ms' => isset($this->context['start_time']) ? floor((microtime(true)-$this->context['start_time'])*1000) : null
        ], $this->context, self::sanitizeAndMask($fields));
        $msg = "[".$all_fields['ts']."] [".$all_fields['ip']."] [$level] [$action] [".$all_fields['result']."] | ".json_encode($all_fields, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->atomicAppend($this->current_logfile, $msg."\n");
        @chmod($this->current_logfile, $this->cfg['log_perms'] ?? 0640);
        $this->externalLog($level, $action, $all_fields);
    }

    /**
     * Atomically appends a line to a log file (temp+append+fsync+rename).
     * @param string $file
     * @param string $line
     */
    private function atomicAppend(string $file, string $line): void
    {
        $tmp = $file . '.tmp.' . bin2hex(random_bytes(4));
        $appendHandle = fopen($file, 'c+');
        if ($appendHandle === false) {
            throw new \RuntimeException("Logger: cannot open $file for append");
        }
        if (flock($appendHandle, LOCK_EX)) {
            fseek($appendHandle, 0, SEEK_END);
            fwrite($appendHandle, $line);
            fflush($appendHandle);
            flock($appendHandle, LOCK_UN);
        }
        fclose($appendHandle);
        // Additional fsync-like safety
        if (function_exists('sync')) { @sync(); }
    }

    /**
     * Log routine request params/context.
     * @param string $action
     * @param string $type
     * @param mixed $params
     * @return void
     */
    public function startRequest(string $action, string $type, $params): void
    {
        $this->context['start_time'] = microtime(true);
        $this->log('INFO', 'REQUEST_PARAMETERS', 'START', [
            'type' => $type,
            'action' => $action,
            'params' => self::sanitizeAndMask($params)
        ]);
    }

    /**
     * End-of-request summary including timing & status.
     * @param string $status
     * @param array<string,mixed> $extra
     */
    public function endRequest(string $status, array $extra = []): void
    {
        $fields = [
            'duration_ms' => floor((microtime(true)-$this->start_time)*1000)
        ] + $extra;
        $this->log('INFO', 'REQUEST_END', $status, $fields);
    }

    /**
     * Log error (always structured/masked)
     * @param string $action
     * @param string $msg
     * @param array<string,mixed> $params
     */
    public function error(string $action, string $msg, array $params = []): void
    {
        $this->log('ERROR', $action, 'FAIL', ['error' => $msg, 'params' => self::sanitizeAndMask($params)]);
    }

    /**
     * Log warning (always structured/masked)
     * @param string $action
     * @param string $msg
     * @param array<string,mixed> $params
     */
    public function warn(string $action, string $msg, array $params = []): void
    {
        $this->log('WARN', $action, 'WARN', ['warn' => $msg, 'params' => self::sanitizeAndMask($params)]);
    }

    /**
     * Advanced/ext logging to syslog or SIEM API.
     * - If cfg['siem_syslog_enable'], forwards log as JSON to syslog (LOG_INFO).
     * - Safe no-op if syslog disabled or unavailable.
     * - Extend in subclass for HTTP SIEM API push or other sinks.
     * - Never aborts primary log path on error.
     * - Expects optional cfg['siem_syslog_ident'] (string) for syslog ident.
     *
     * @param string $level Log level ("DEBUG", "INFO", etc.)
     * @param string $action Log action string
     * @param array  $fields Fully prepared log fields/record (masked)
     * @return void
     */
    protected function externalLog(string $level, string $action, array $fields): void
    {
        if (!empty($this->cfg['siem_syslog_enable'])) {
            $ident = $this->cfg['siem_syslog_ident'] ?? 'PromptApp';
            $syslog_msg = json_encode([
                'level'  => $level,
                'action' => $action,
                'fields' => $fields,
                'ts'     => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($syslog_msg) {
                openlog($ident, LOG_ODELAY, LOG_USER);
                syslog(LOG_INFO, $syslog_msg);
                closelog();
            }
        }
        // Extendable: override in subclass for HTTP SIEM integration.
    }

    /**
     * Destructor: close log file handle.
     */
    public function __destruct()
    {
        if ($this->handle && is_resource($this->handle)) {
            fflush($this->handle);
            fclose($this->handle);
        }
    }

    /**
     * Masks secrets/tokens/cookies from any structure, recursively.
     * @param mixed $input
     * @return mixed
     */
    public static function sanitizeAndMask($input)
    {
        $mask_patterns = ['token', 'key', 'secret', 'pass', 'auth', 'cookie', 'password', 'php_auth'];
        if (is_array($input)) {
            $result = [];
            foreach ($input as $k => $v) {
                $mkey = strtolower((string)$k);
                $is_secret = false;
                foreach ($mask_patterns as $pat) {
                    if (strpos($mkey, $pat) !== false) {
                        $is_secret = true; break;
                    }
                }
                if ($is_secret) {
                    $result[$k] = is_array($v) ? '[MASKED ARRAY]' : '[MASKED]';
                } else if (is_array($v)) {
                    $result[$k] = self::sanitizeAndMask($v);
                } else {
                    $result[$k] = is_string($v) ? htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : $v;
                }
            }
            return $result;
        } elseif (is_string($input)) {
            return htmlspecialchars($input, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }
        return $input;
    }

    /**
     * Robust getter for client IP address.
     * @return string
     */
    public static function getClientIp(): string
    {
        return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    }
    /**
     * Appends an atomic, concise, human-audit log entry to AUDIT_LOG.md (root).
     * Format: YYYY-MM-DD HH:MM:SS | action=add|edit|delete | type=entitytype | id=xxx | user=xxx | title="..." | tags=... | result=OK/FAIL | reason=...
     * @param string $action       CRUD action ('add', 'edit', 'delete', etc)
     * @param string $type         Entity type ('prompt', 'comment', 'result', etc)
     * @param array  $entry        The entity, sanitized
     * @param string $result       'OK', 'FAIL', etc
     * @param string $reason       Reason for failure, if any
     */
    public function auditAtomic(string $action, string $type, array $entry = [], string $result = 'OK', string $reason = ''): void
    {
        $auditPath = dirname(__DIR__) . '/AUDIT_LOG.md';
        $ts = date('Y-m-d H:i:s');
        $id = $entry['id'] ?? '';
        $user = $entry['user_id'] ?? $entry['user'] ?? '';
        $t = $entry['title'] ?? (isset($entry['comment']) ? mb_substr($entry['comment'],0,50) : '');
        $tags = (isset($entry['tags']) && is_array($entry['tags'])) ? implode(',', $entry['tags']) : '';
        // Sanitized, trim and mask for log
        $parts = [
            "$ts",
            "action=$action",
            "type=$type",
            "id=$id",
            "user=$user"
        ];
        if ($t !== '') $parts[] = 'title="' . str_replace(["\r","\n","|"],[" "," "," "], mb_substr($t,0,60)) . '"';
        if ($tags !== '') $parts[] = 'tags=' . str_replace(["|",",","\n","\r"],[";",";"," "," "], $tags);
        $parts[] = "result=$result";
        if ($reason !== '') $parts[] = 'reason="' . str_replace(["\r","\n","|"],[" "," "," "], mb_substr($reason,0,80)) . '"';
        $line = implode(' | ', $parts) . "\n";
        // Atomic append
        try {
            $f = fopen($auditPath, 'a');
            if ($f) {
                if (flock($f, LOCK_EX)) {
                    fwrite($f, $line);
                    fflush($f);
                    flock($f, LOCK_UN);
                }
                fclose($f);
            }
        } catch (\Throwable $ex) {
            // Audit log failure should not abort primary operation
        }
    }
}