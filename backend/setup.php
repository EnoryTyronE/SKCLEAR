<?php
// SK CLEAR Backend Setup Script
echo "=== SK CLEAR Backend Setup ===\n\n";

// Check PHP version
echo "PHP Version: " . phpversion() . "\n";

// Check if PDO MySQL extension is available
if (extension_loaded('pdo_mysql')) {
    echo "✓ PDO MySQL extension is available\n";
} else {
    echo "✗ PDO MySQL extension is NOT available\n";
    echo "Please install the PDO MySQL extension for PHP\n";
    exit(1);
}

// Test database connection
echo "\nTesting database connection...\n";
require_once 'config/database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    if ($conn) {
        echo "✓ Database connection successful\n";
        
        // Check if database exists
        $stmt = $conn->query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'skclear_db'");
        if ($stmt->rowCount() > 0) {
            echo "✓ Database 'skclear_db' exists\n";
        } else {
            echo "✗ Database 'skclear_db' does not exist\n";
            echo "Please create the database first by running the SQL script:\n";
            echo "mysql -u root -p < database/schema.sql\n";
        }
        
    } else {
        echo "✗ Database connection failed\n";
    }
} catch (Exception $e) {
    echo "✗ Database connection error: " . $e->getMessage() . "\n";
    echo "\nPlease check your database configuration in config/database.php\n";
    echo "Make sure MySQL is running and the credentials are correct.\n";
}

echo "\n=== Setup Complete ===\n";
echo "\nTo start the backend server, run:\n";
echo "php -S localhost:8000\n";
echo "\nThe API will be available at: http://localhost:8000\n";
?> 