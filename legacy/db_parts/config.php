<?php
/**
 * Configuration and Schema Definitions
 * Extracted from db.php for modularization.
 */

// Entity schemas
$SCHEMAS = [
    'prompts' => [
        'schemaVersion' => ['type'=>'string','max'=>10,'required'=>true],
        'id'            => ['type'=>'string','max'=>40,'required'=>true],
        'title'         => ['type'=>'string','max'=>200,'required'=>true],
        'description'   => ['type'=>'string','max'=>2000,'required'=>true],
        'prompt'        => ['type'=>'string','max'=>4000,'required'=>true],
        'tags'          => ['type'=>'array','required'=>true],
        'user_id'       => ['type'=>'string','max'=>60,'required'=>true],
        'author'        => ['type'=>'string','max'=>60,'required'=>false],
        'created_at'    => ['type'=>'string','max'=>40,'required'=>true],
        'updated_at'    => ['type'=>'string','max'=>40,'required'=>false],
    ],
    'comments' => [
        'id'        => ['type'=>'string','max'=>40,'required'=>true],
        'comment'   => ['type'=>'string','max'=>2000,'required'=>true],
        'user_id'   => ['type'=>'string','max'=>60,'required'=>true],
        'author'    => ['type'=>'string','max'=>60,'required'=>false],
        'created_at'=> ['type'=>'string','max'=>40,'required'=>true]
    ],
    'results' => [
        'id'        => ['type'=>'string','max'=>40,'required'=>true],
        'output'    => ['type'=>'string','max'=>4000,'required'=>true],
        'score'     => ['type'=>'int','required'=>false],
        'user_id'   => ['type'=>'string','max'=>60,'required'=>true],
    ]
];

// Admin token setup
$adminToken = getenv('LOG_ADMIN_TOKEN');
if (!$adminToken || $adminToken === 'REPLACE_WITH_SECRET_TOKEN') {
    if ($_SERVER['SERVER_NAME'] === 'localhost' || $_SERVER['REMOTE_ADDR'] === '127.0.0.1') {
        $adminToken = 'DEV_LOCAL_TOKEN';
        error_log("[db.php] WARNING: LOG_ADMIN_TOKEN missing, using DEV_LOCAL_TOKEN for local development only!");
    } else {
        error_log("[db.php] ERROR: LOG_ADMIN_TOKEN missing or invalid at start of script.");
        http_response_code(500);
        echo json_encode(["ok"=>false,"msg"=>"Missing or invalid LOG_ADMIN_TOKEN environment variable; admin actions disabled."]);
        exit;
    }
}

$config = [
    'log_path'       => __DIR__ . '/../db.log',
    'log_max_bytes'  => 1024 * 1024,
    'log_perms'      => 0640,
    'log_admin_token'=> $adminToken,
    'file_perms'     => 0640,
    'log_level'      => 'DEBUG',
    'log_days'       => 7,
    'db_dir'         => __DIR__ . '/../data',
    'db_files'       => [
        'prompts'    => __DIR__ . '/../prompts.json',
        'comments'   => __DIR__ . '/../comments.json',
        'results'    => __DIR__ . '/../results.json'
    ]
];