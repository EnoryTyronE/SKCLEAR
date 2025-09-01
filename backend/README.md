# SK CLEAR Backend

This is the PHP backend for the SK CLEAR Management System.

## 🗄️ Database Setup

### Prerequisites
- PHP 7.4 or higher
- MySQL 5.7 or higher
- PDO MySQL extension

### 1. Database Configuration

Edit `config/database.php` with your MySQL credentials:

```php
private $host = 'localhost';
private $db_name = 'skclear_db';
private $username = 'root';        // Your MySQL username
private $password = '';            // Your MySQL password
```

### 2. Create Database

Run the database schema script:

```bash
# Option 1: Using MySQL command line
mysql -u root -p < database/schema.sql

# Option 2: Using phpMyAdmin
# Import the database/schema.sql file
```

### 3. Test Setup

Run the setup script to verify everything is working:

```bash
php setup.php
```

## 🚀 Starting the Server

```bash
php -S localhost:8000
```

The API will be available at: `http://localhost:8000`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### SK Profile Management
- `GET /api/sk/profile` - Get SK profile
- `POST /api/sk/setup` - Save SK setup
- `GET /api/sk/officials` - Get SK officials
- `POST /api/sk/officials` - Save SK officials

### CBYDP Management
- `POST /api/cbydp` - Save CBYDP
- `GET /api/cbydp` - Get all CBYDP
- `GET /api/cbydp/:id` - Get specific CBYDP

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

### Dashboard & Reports
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/projects` - Get projects
- `POST /api/projects` - Create project
- `GET /api/budget` - Get budget
- `POST /api/budget` - Create budget

## 🔧 Default Users

The system comes with these default users (password: `password123`):

- **chairperson** - SK Chairperson
- **treasurer** - SK Treasurer  
- **secretary** - SK Secretary
- **council1** - SK Kagawad
- **council2** - SK Kagawad
- **council3** - SK Kagawad
- **council4** - SK Kagawad

## 📁 Project Structure

```
backend/
├── config/
│   └── database.php          # Database configuration
├── models/
│   ├── SKProfile.php         # SK Profile model
│   ├── SKOfficials.php       # SK Officials model
│   ├── CBYDP.php            # CBYDP model
│   ├── CBYDPCenters.php     # CBYDP Centers model
│   └── CBYDPProjects.php    # CBYDP Projects model
├── database/
│   └── schema.sql           # Database schema
├── index.php                # Main API router
├── setup.php               # Setup script
└── README.md               # This file
```

## 🔒 Security Notes

- This is a development setup
- For production, implement proper authentication (JWT tokens)
- Use HTTPS in production
- Implement input validation and sanitization
- Use environment variables for sensitive data

## 🐛 Troubleshooting

### Database Connection Issues
1. Check if MySQL is running
2. Verify credentials in `config/database.php`
3. Ensure database `skclear_db` exists
4. Check if PDO MySQL extension is installed

### PHP Issues
1. Ensure PHP 7.4+ is installed
2. Check if PDO MySQL extension is enabled
3. Verify PHP is in your system PATH

### Port Issues
- If port 8000 is busy, use a different port:
  ```bash
  php -S localhost:8001
  ``` 