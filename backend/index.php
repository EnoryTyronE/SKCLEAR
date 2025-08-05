<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Simple router
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Remove /backend from path if present
$path = str_replace('/backend', '', $path);

// API Routes
$routes = [
    'POST /api/auth/login' => 'handleLogin',
    'GET /api/user/profile' => 'handleGetProfile',
    'PUT /api/user/profile' => 'handleUpdateProfile',
    'POST /api/sk/setup' => 'handleSKSetup',
    'GET /api/dashboard/stats' => 'handleDashboardStats',
    'GET /api/projects' => 'handleGetProjects',
    'POST /api/projects' => 'handleCreateProject',
    'GET /api/budget' => 'handleGetBudget',
    'POST /api/budget' => 'handleCreateBudget',
];

// Find matching route
$route_key = $method . ' ' . $path;
$handler = $routes[$route_key] ?? null;

if ($handler && function_exists($handler)) {
    try {
        $result = $handler();
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Route not found']);
}

// Handler functions
function handleLogin() {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';

    // Mock user data - replace with database query
    $users = [
        [
            'id' => 1,
            'username' => 'chairperson',
            'password' => 'password123',
            'name' => 'Juan Dela Cruz',
            'role' => 'chairperson',
            'barangay' => 'Barangay 123',
            'municipality' => 'Manila',
            'province' => 'Metro Manila',
            'skTermStart' => 2024,
            'skTermEnd' => 2026,
            'isFirstLogin' => false
        ],
        [
            'id' => 2,
            'username' => 'treasurer',
            'password' => 'password123',
            'name' => 'Maria Santos',
            'role' => 'treasurer',
            'barangay' => 'Barangay 123',
            'municipality' => 'Manila',
            'province' => 'Metro Manila',
            'skTermStart' => 2024,
            'skTermEnd' => 2026,
            'isFirstLogin' => false
        ],
        [
            'id' => 3,
            'username' => 'council',
            'password' => 'password123',
            'name' => 'Pedro Reyes',
            'role' => 'council_member',
            'barangay' => 'Barangay 123',
            'municipality' => 'Manila',
            'province' => 'Metro Manila',
            'skTermStart' => 2024,
            'skTermEnd' => 2026,
            'isFirstLogin' => false
        ]
    ];

    foreach ($users as $user) {
        if ($user['username'] === $username && $user['password'] === $password) {
            unset($user['password']); // Don't send password back
            return [
                'success' => true,
                'user' => $user,
                'token' => 'mock_token_' . $user['id'] // In real app, generate JWT
            ];
        }
    }

    http_response_code(401);
    return ['success' => false, 'message' => 'Invalid credentials'];
}

function handleGetProfile() {
    // Mock profile data
    return [
        'success' => true,
        'profile' => [
            'id' => 1,
            'name' => 'Juan Dela Cruz',
            'role' => 'chairperson',
            'barangay' => 'Barangay 123',
            'municipality' => 'Manila',
            'province' => 'Metro Manila',
            'skTermStart' => 2024,
            'skTermEnd' => 2026
        ]
    ];
}

function handleUpdateProfile() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Mock update - in real app, update database
    return [
        'success' => true,
        'message' => 'Profile updated successfully',
        'profile' => $input
    ];
}

function handleSKSetup() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Mock save - in real app, save to database
    return [
        'success' => true,
        'message' => 'SK information saved successfully',
        'data' => $input
    ];
}

function handleDashboardStats() {
    // Mock dashboard statistics
    return [
        'success' => true,
        'stats' => [
            'totalProjects' => 12,
            'activeProjects' => 8,
            'budgetUsed' => 75000,
            'pendingApprovals' => 3
        ]
    ];
}

function handleGetProjects() {
    // Mock projects data
    return [
        'success' => true,
        'projects' => [
            [
                'id' => 1,
                'title' => 'Youth Sports Tournament',
                'category' => 'Sports',
                'status' => 'ongoing',
                'progress' => 65,
                'budget' => 25000,
                'startDate' => '2024-01-15',
                'endDate' => '2024-06-30'
            ],
            [
                'id' => 2,
                'title' => 'Environmental Clean-up Drive',
                'category' => 'Environment',
                'status' => 'pending',
                'progress' => 0,
                'budget' => 15000,
                'startDate' => '2024-03-01',
                'endDate' => '2024-05-31'
            ]
        ]
    ];
}

function handleCreateProject() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Mock project creation
    return [
        'success' => true,
        'message' => 'Project created successfully',
        'project' => array_merge($input, ['id' => rand(100, 999)])
    ];
}

function handleGetBudget() {
    // Mock budget data
    return [
        'success' => true,
        'budget' => [
            'totalBudget' => 100000,
            'usedBudget' => 75000,
            'remainingBudget' => 25000,
            'emergencyFund' => 10000,
            'capacityDevelopment' => 20000,
            'projectImplementation' => 70000
        ]
    ];
}

function handleCreateBudget() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Mock budget creation
    return [
        'success' => true,
        'message' => 'Budget allocation saved successfully',
        'budget' => $input
    ];
}
?> 