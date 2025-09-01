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

// Include models
require_once 'models/SKProfile.php';
require_once 'models/SKOfficials.php';
require_once 'models/CBYDP.php';
require_once 'models/CBYDPCenters.php';
require_once 'models/CBYDPProjects.php';

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
    'GET /api/sk/profile' => 'handleGetSKProfile',
    'POST /api/sk/setup' => 'handleSKSetup',
    'GET /api/sk/officials' => 'handleGetSKOfficials',
    'POST /api/sk/officials' => 'handleSaveSKOfficials',
    'GET /api/dashboard/stats' => 'handleDashboardStats',
    'GET /api/projects' => 'handleGetProjects',
    'POST /api/projects' => 'handleCreateProject',
    'GET /api/budget' => 'handleGetBudget',
    'POST /api/budget' => 'handleCreateBudget',
    'POST /api/cbydp' => 'handleSaveCBYDP',
    'GET /api/cbydp' => 'handleGetCBYDP',
    'GET /api/cbydp/:id' => 'handleGetCBYDPById',
];

// Find matching route
$route_key = $method . ' ' . $path;
$handler = $routes[$route_key] ?? null;

// Handle dynamic routes (like /api/cbydp/:id)
if (!$handler) {
    foreach ($routes as $route => $route_handler) {
        $pattern = preg_replace('/:[^\/]+/', '([^/]+)', $route);
        $pattern = str_replace('/', '\/', $pattern);
        if (preg_match('/^' . $pattern . '$/', $method . ' ' . $path, $matches)) {
            $handler = $route_handler;
            $params = array_slice($matches, 1);
            break;
        }
    }
}

if ($handler && function_exists($handler)) {
    try {
        if (isset($params)) {
            $result = $handler($params);
        } else {
            $result = $handler();
        }
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Route not found: ' . $method . ' ' . $path]);
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

function handleGetSKProfile() {
    try {
        $skProfile = new SKProfile();
        $profile = $skProfile->getProfile();
        
        if ($profile) {
            return [
                'success' => true,
                'profile' => [
                    'barangayName' => $profile['barangay_name'],
                    'municipality' => $profile['municipality'],
                    'province' => $profile['province'],
                    'region' => $profile['region'],
                    'barangayLogo' => $profile['barangay_logo'],
                    'skTermStart' => (int)$profile['sk_term_start'],
                    'skTermEnd' => (int)$profile['sk_term_end'],
                    'skFederationPresident' => $profile['sk_federation_president']
                ]
            ];
        } else {
            return [
                'success' => false,
                'message' => 'SK Profile not found'
            ];
        }
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Error retrieving SK profile: ' . $e->getMessage()
        ];
    }
}

function handleSKSetup() {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $skProfile = new SKProfile();
        $skOfficials = new SKOfficials();
        
        // Save SK Profile
        $profileData = [
            'barangayName' => $input['barangayName'],
            'municipality' => $input['municipality'],
            'province' => $input['province'],
            'region' => $input['region'],
            'barangayLogo' => $input['barangayLogo'],
            'skTermStart' => $input['skTermStart'],
            'skTermEnd' => $input['skTermEnd'],
            'skFederationPresident' => $input['skFederationPresident']
        ];
        
        $profileResult = $skProfile->saveOrUpdate($profileData);
        
        // Save SK Officials
        $officialsResult = $skOfficials->saveOfficials($input['officials']);
        
        if ($profileResult && $officialsResult) {
            return [
                'success' => true,
                'message' => 'SK information saved successfully'
            ];
        } else {
            return [
                'success' => false,
                'message' => 'Error saving SK information'
            ];
        }
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Error saving SK setup: ' . $e->getMessage()
        ];
    }
}

function handleGetSKOfficials() {
    try {
        $skOfficials = new SKOfficials();
        $officials = $skOfficials->getAll();
        
        return [
            'success' => true,
            'officials' => $officials
        ];
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Error retrieving SK officials: ' . $e->getMessage()
        ];
    }
}

function handleSaveSKOfficials() {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $skOfficials = new SKOfficials();
        $result = $skOfficials->saveOfficials($input['officials']);
        
        if ($result) {
            return [
                'success' => true,
                'message' => 'SK officials saved successfully'
            ];
        } else {
            return [
                'success' => false,
                'message' => 'Error saving SK officials'
            ];
        }
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Error saving SK officials: ' . $e->getMessage()
        ];
    }
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

function handleSaveCBYDP() {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $cbydp = new CBYDP();
        $cbydpCenters = new CBYDPCenters();
        $cbydpProjects = new CBYDPProjects();
        
        // Create or update CBYDP
        $cbydpData = [
            'year' => $input['year'],
            'created_by' => $input['created_by'] ?? 1 // Default to user ID 1 for now
        ];
        
        $cbydpId = $cbydp->create($cbydpData);
        
        if ($cbydpId) {
            // Save centers and their projects
            foreach ($input['centers'] as $centerIndex => $center) {
                if (!empty($center['centerName']) && !empty($center['agendaStatement'])) {
                    // Create center
                    $centerData = [
                        'cbydp_id' => $cbydpId,
                        'center_name' => $center['centerName'],
                        'agenda_statement' => $center['agendaStatement'],
                        'sort_order' => $centerIndex
                    ];
                    
                    $centerId = $cbydpCenters->create($centerData);
                    
                    if ($centerId && isset($center['projects'])) {
                        // Save projects for this center
                        $cbydpProjects->saveProjects($centerId, $center['projects']);
                    }
                }
            }
            
            return [
                'success' => true,
                'message' => 'CBYDP saved successfully',
                'cbydp_id' => $cbydpId
            ];
        } else {
            return [
                'success' => false,
                'message' => 'Error creating CBYDP'
            ];
        }
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Error saving CBYDP: ' . $e->getMessage()
        ];
    }
}

function handleGetCBYDP() {
    try {
        $cbydp = new CBYDP();
        $cbydpCenters = new CBYDPCenters();
        $cbydpProjects = new CBYDPProjects();
        
        $cbydpList = $cbydp->getAll();
        
        $result = [];
        foreach ($cbydpList as $cbydpItem) {
            $centers = $cbydpCenters->getByCBYDPId($cbydpItem['id']);
            
            $centersWithProjects = [];
            foreach ($centers as $center) {
                $projects = $cbydpProjects->getByCenterId($center['id']);
                $center['projects'] = $projects;
                $centersWithProjects[] = $center;
            }
            
            $cbydpItem['centers'] = $centersWithProjects;
            $result[] = $cbydpItem;
        }
        
        return [
            'success' => true,
            'cbydp_list' => $result
        ];
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Error retrieving CBYDP: ' . $e->getMessage()
        ];
    }
}

function handleGetCBYDPById($params) {
    try {
        $cbydpId = $params[0];
        
        $cbydp = new CBYDP();
        $cbydpCenters = new CBYDPCenters();
        $cbydpProjects = new CBYDPProjects();
        
        $cbydpItem = $cbydp->getById($cbydpId);
        
        if ($cbydpItem) {
            $centers = $cbydpCenters->getByCBYDPId($cbydpId);
            
            $centersWithProjects = [];
            foreach ($centers as $center) {
                $projects = $cbydpProjects->getByCenterId($center['id']);
                $center['projects'] = $projects;
                $centersWithProjects[] = $center;
            }
            
            $cbydpItem['centers'] = $centersWithProjects;
            
            return [
                'success' => true,
                'cbydp' => $cbydpItem
            ];
        } else {
            return [
                'success' => false,
                'message' => 'CBYDP not found'
            ];
        }
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Error retrieving CBYDP: ' . $e->getMessage()
        ];
    }
}
?> 