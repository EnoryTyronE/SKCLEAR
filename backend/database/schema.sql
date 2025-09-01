-- SK CLEAR Database Schema
-- Create database
CREATE DATABASE IF NOT EXISTS skclear_db;
USE skclear_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('chairperson', 'treasurer', 'secretary', 'council_member') NOT NULL,
    email VARCHAR(100),
    contact_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- SK Profile table (single barangay setup)
CREATE TABLE IF NOT EXISTS sk_profile (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barangay_name VARCHAR(100) NOT NULL,
    municipality VARCHAR(100) NOT NULL,
    province VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    barangay_logo LONGTEXT, -- Base64 encoded image
    sk_term_start INT NOT NULL,
    sk_term_end INT NOT NULL,
    sk_federation_president VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- SK Officials table
CREATE TABLE IF NOT EXISTS sk_officials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(50) NOT NULL,
    contact_number VARCHAR(20),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- CBYDP (Comprehensive Barangay Youth Development Plan) table
CREATE TABLE IF NOT EXISTS cbydp (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- CBYDP Centers of Participation
CREATE TABLE IF NOT EXISTS cbydp_centers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cbydp_id INT NOT NULL,
    center_name VARCHAR(100) NOT NULL,
    agenda_statement TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cbydp_id) REFERENCES cbydp(id) ON DELETE CASCADE
);

-- CBYDP Projects
CREATE TABLE IF NOT EXISTS cbydp_projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    center_id INT NOT NULL,
    project_name VARCHAR(200) NOT NULL,
    objectives TEXT NOT NULL,
    activities TEXT NOT NULL,
    target_beneficiaries VARCHAR(200) NOT NULL,
    timeline VARCHAR(100) NOT NULL,
    budget_requirement DECIMAL(10,2) NOT NULL,
    funding_source VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (center_id) REFERENCES cbydp_centers(id) ON DELETE CASCADE
);

-- ABYIP (Annual Barangay Youth Investment Plan) table
CREATE TABLE IF NOT EXISTS abyip (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    total_budget DECIMAL(12,2) NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ABYIP Budget Categories
CREATE TABLE IF NOT EXISTS abyip_budget_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    abyip_id INT NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    allocated_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (abyip_id) REFERENCES abyip(id) ON DELETE CASCADE
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    status ENUM('pending', 'ongoing', 'completed', 'cancelled') DEFAULT 'pending',
    progress INT DEFAULT 0,
    budget DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Budget table
CREATE TABLE IF NOT EXISTS budget (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    total_budget DECIMAL(12,2) NOT NULL,
    emergency_fund DECIMAL(10,2) DEFAULT 0,
    capacity_development DECIMAL(10,2) DEFAULT 0,
    project_implementation DECIMAL(10,2) DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Budget Transactions
CREATE TABLE IF NOT EXISTS budget_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    budget_id INT NOT NULL,
    description VARCHAR(200) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    transaction_type ENUM('income', 'expense') NOT NULL,
    category VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budget(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Insert default users
INSERT INTO users (username, password, name, role) VALUES
('chairperson', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Juan Dela Cruz', 'chairperson'),
('treasurer', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Maria Santos', 'treasurer'),
('secretary', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Pedro Reyes', 'secretary'),
('council1', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ana Garcia', 'council_member'),
('council2', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Luis Martinez', 'council_member'),
('council3', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Carmen Lopez', 'council_member'),
('council4', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Roberto Torres', 'council_member');

-- Insert default SK officials
INSERT INTO sk_officials (name, position) VALUES
('Juan Dela Cruz', 'SK Chairperson'),
('Maria Santos', 'SK Treasurer'),
('Pedro Reyes', 'SK Secretary'),
('Ana Garcia', 'SK Kagawad'),
('Luis Martinez', 'SK Kagawad'),
('Carmen Lopez', 'SK Kagawad'),
('Roberto Torres', 'SK Kagawad'); 