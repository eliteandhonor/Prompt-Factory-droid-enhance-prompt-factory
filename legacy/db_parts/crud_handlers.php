<?php
/**
 * CRUD API Handlers (list, add, edit, delete)
 * Extracted from db.php for modularization.
 */

function handle_crud(
    $action, $type, &$data, $config, $SCHEMAS, $logger
) {
    $added = [];
    switch ($action) {
        case 'list':
            $logger->log('INFO','LIST','OK', ['type'=>$type]);
            respond_json(true, 'Data loaded', $data, $logger, 'OK');
            break;
        case 'add':
            $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
            $rawBody = file_get_contents('php://input');
            $parsedEntries = null;
            $parsingErrors = [];

            if (stripos($contentType, 'application/json') !== false) {
                $parsedEntries = @json_decode($rawBody, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $parsingErrors[] = 'JSON parse error: ' . json_last_error_msg();
                }
            } elseif (stripos($contentType, 'application/x-www-form-urlencoded') !== false || stripos($contentType, 'multipart/form-data') !== false) {
                if (isset($_POST['entry'])) {
                    $maybeArray = $_POST['entry'];
                    if (is_string($maybeArray)) {
                        $parsedEntries = @json_decode($maybeArray, true);
                        if ($parsedEntries === null && strtolower($maybeArray) !== 'null') {
                            $parsingErrors[] = 'Failed to parse "entry" as JSON in form data.';
                        }
                    } else {
                        $parsedEntries = $maybeArray;
                    }
                } else {
                    $parsingErrors[] = 'Missing "entry" in form data.';
                }
            } else {
                if (isset($_POST['entry'])) {
                    $maybeArray = $_POST['entry'];
                    if (is_string($maybeArray)) {
                        $parsedEntries = @json_decode($maybeArray, true);
                        if ($parsedEntries === null && strtolower($maybeArray) !== 'null') {
                            $parsingErrors[] = 'Failed to parse "entry" as JSON.';
                        }
                    } else {
                        $parsedEntries = $maybeArray;
                    }
                } else {
                    $parsedEntries = @json_decode($rawBody, true);
                    if ($parsedEntries === null && trim($rawBody) !== '') {
                        $parsingErrors[] = 'Request body is not valid JSON.';
                    }
                }
            }

            if (!empty($parsingErrors) || $parsedEntries === null || $parsedEntries === '') {
                $logger->error('ADD', 'Parsing error', ['errors'=>$parsingErrors, 'raw'=>$rawBody, 'contentType'=>$contentType]);
                error_log('[db.php] Parsing/decoding errors on add: ' . implode('; ', $parsingErrors));
                $logger->auditAtomic('add', $type, ['user'=>getCurrentUserId(), 'errors'=>$parsingErrors], 'FAIL', 'Parsing error');
                respond_json(false, 'Invalid/add entry: parsing error', $parsingErrors, $logger, 'INVDATA', $parsingErrors, 400);
            }

            $entries = [];
            if (is_assoc_array($parsedEntries)) {
                $entries[] = $parsedEntries;
            } elseif (is_array($parsedEntries)) {
                foreach ($parsedEntries as $item) {
                    if (is_assoc_array($item)) $entries[] = $item;
                    else $parsingErrors[] = 'Array contains malformed prompt/item (not an object)';
                }
            } else {
                $parsingErrors[] = 'Entry is not an object or array of objects';
            }
            if (!empty($parsingErrors)) {
                $logger->error('ADD', 'Entry structure error', ['errors'=>$parsingErrors]);
                $logger->auditAtomic('add', $type, ['user'=>getCurrentUserId(), 'entry'=>$parsedEntries], 'FAIL', 'Entry structure error');
                respond_json(false, 'Invalid/add entry structure', $parsingErrors, $logger, 'INVDATA', $parsingErrors, 400);
            }

            $added = [];
            $allErrors = [];
            foreach ($entries as $idx => $obj) {
                $user_id = getCurrentUserId();
                $obj['user_id'] = $user_id;
                if (!isset($obj['author']) || !$obj['author']) {
                    $obj['author'] = $user_id === 'anon' ? 'anonymous' : $user_id;
                }
                $nowIso = date('c');
                if (!isset($obj['created_at']) || !$obj['created_at']) {
                    $obj['created_at'] = $nowIso;
                }
                if (!isset($obj['schemaVersion'])) {
                    $obj['schemaVersion'] = '1.0';
                }
                list($valid, $filtered, $errs) = validate_entity($type, $obj, $SCHEMAS);
                if (!$valid) {
                    $errDetail = [
                        'idx'   => $idx,
                        'error' => $errs,
                        'input' => $obj
                    ];
                    $allErrors[] = $errDetail;
                    $logger->error('ADD', 'Schema validation error', $errDetail);
                    continue;
                }
                $filtered['id'] = $filtered['id'] ?? uniqid('p', true);
                $added[] = $filtered;
                $data[] = $filtered;
                $logger->log('INFO','ADD','OK', ['entry'=>$filtered, 'type'=>$type, 'user_id'=>$user_id]);
            }

            if (!empty($allErrors)) {
                $logger->auditAtomic('add', $type, $allErrors, 'FAIL', 'Validation errors');
                respond_json(false, 'Schema validation error(s)', $allErrors, $logger, 'INVDATA', $allErrors, 400);
            }
            if (empty($added)) {
                $logger->error('ADD', 'No valid entries added', []);
                respond_json(false, 'No valid prompts to add', null, $logger, 'INVDATA', [], 400);
            }
            $logger->auditAtomic('add', $type, $added, 'OK');
            // Actual file write and response handled in db.php after this function
            break;
        case 'edit':
            $id = $_POST['id'] ?? '';
            $entry = $_POST['entry'] ?? file_get_contents('php://input');
            $obj = is_array($entry) ? $entry : @json_decode($entry, true);
            if (!$id || !$obj) {
                $logger->error('EDIT','Invalid id/entry',compact('id', 'entry'));
                error_log('[AUDIT] About to auditAtomic (edit fail: missing id/entry)');
                $logger->auditAtomic('edit', $type, ['id'=>$id, 'user'=>getCurrentUserId(), 'entry'=>$entry], 'FAIL', 'Invalid id/entry');
                respond_json(false, 'Invalid id/entry', null, $logger, 'INVDATA');
            }
            $user_id = getCurrentUserId();
            $obj['user_id'] = $user_id;
            if (!isset($obj['author']) || !$obj['author']) {
                $obj['author'] = $user_id === 'anon' ? 'anonymous' : $user_id;
            }
            list($valid, $filtered, $errs) = validate_entity($type, $obj, $SCHEMAS);
            if (!$valid) {
                $logger->error('EDIT', 'Schema validation error', ['errs'=>$errs]);
                error_log('[AUDIT] About to auditAtomic (edit fail: schema validation)');
                $logger->auditAtomic('edit', $type, $obj, 'FAIL', implode('; ', $errs));
                respond_json(false, 'Schema validation error', $errs, $logger, 'INVDATA', $errs, 400);
            }
            $found = false;
            foreach ($data as $k => $v) {
                if (isset($v['id']) && $v['id'] == $id && canEdit($user_id, $v)) {
                    $data[$k] = array_merge($v, $filtered);
                    $found = true;
                    $logger->log('INFO','EDIT','OK', ['entry'=>$filtered, 'type'=>$type, 'user_id'=>$user_id]);
                    error_log('[AUDIT] About to auditAtomic (edit OK)');
                    $logger->auditAtomic('edit', $type, $filtered, 'OK');
                    break;
                }
            }
            if (!$found) {
                $logger->warn('EDIT','Not found or forbidden', ['id'=>$id,'type'=>$type]);
                error_log('[AUDIT] About to auditAtomic (edit fail: not found or forbidden)');
                $logger->auditAtomic('edit', $type, ['id'=>$id, 'user'=>getCurrentUserId()], 'FAIL', 'Not found or forbidden');
                respond_json(false, 'Not found or forbidden', null, $logger, 'NOTFOUND');
            }
            break;
        case 'delete':
            $id = $_POST['id'] ?? file_get_contents('php://input');
            $id = is_array($id) ? $id['id'] : (is_string($id) ? $id : '');
            if (!$id) {
                $logger->error('DELETE','Invalid id',['id'=>$id]);
                error_log('[AUDIT] About to auditAtomic (delete fail: missing id)');
                $logger->auditAtomic('delete', $type, ['id'=>$id, 'user'=>getCurrentUserId()], 'FAIL', 'Invalid id');
                respond_json(false, 'Invalid id', null, $logger, 'INVDATA');
            }
            $before = count($data);
            $data = array_values(array_filter($data, fn($v) => $v['id'] !== $id));
            $after = count($data);
            if ($before === $after) {
                $logger->warn('DELETE','Not found',['id'=>$id, 'type'=>$type]);
                error_log('[AUDIT] About to auditAtomic (delete fail: not found)');
                $logger->auditAtomic('delete', $type, ['id'=>$id, 'user'=>getCurrentUserId()], 'FAIL', 'Not found');
                respond_json(false, 'Not found', null, $logger, 'NOTFOUND');
            } else {
                $logger->log('INFO','DELETE','OK',['id'=>$id, 'type'=>$type]);
                error_log('[AUDIT] About to auditAtomic (delete OK)');
                $logger->auditAtomic('delete', $type, ['id'=>$id, 'user'=>getCurrentUserId()], 'OK');
            }
            break;
        default:
            $logger->warn('ACTION','Unknown action',['action'=>$action,'type'=>$type]);
            respond_json(false, 'Unknown action', null, $logger, 'INVDATA');
    }
    return $added;
}