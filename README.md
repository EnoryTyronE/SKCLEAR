# SK Management System

A comprehensive web application for managing Sangguniang Kabataan (SK) operations, including project planning, budget management, and transparency reporting.

## 🚀 Features

- **User Authentication & Role Management**
  - Chairperson (Admin Access)
  - Treasurer (Financial Access)
  - Council Members (Monitoring Access)

- **SK Information Setup**
  - Barangay information configuration
  - SK officials assignment
  - Term management

- **CBYDP Management**
  - Comprehensive Barangay Youth Development Plan
  - 3-5 year project planning
  - Project categorization and budgeting

- **ABYIP Generation**
  - Annual Barangay Youth Investment Program
  - Project timeline management
  - Resource allocation

- **Budget Management**
  - Annual budget allocation
  - Purchase request processing
  - Financial tracking and reporting

- **Project Monitoring**
  - Real-time project status tracking
  - Progress updates and milestones
  - Photo and document uploads

- **Transparency Portal**
  - Public report generation
  - QR code generation for documents
  - Audit trail management

## 🛠️ Tech Stack

### Frontend
- **React.js** - Modern UI framework
- **TypeScript** - Type safety and better development experience
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client for API calls

### Backend
- **PHP** - Server-side logic
- **MySQL** - Database (planned)
- **RESTful API** - Backend communication

### Mobile Support
- **Progressive Web App (PWA)** - Mobile app-like experience
- **Responsive Design** - Works on all devices

## 📁 Project Structure

```
SKCLEAR/
├── frontend/                 # React frontend application
│   ├── public/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── contexts/        # React contexts (Auth, etc.)
│   │   ├── pages/          # Page components
│   │   ├── App.tsx         # Main app component
│   │   └── index.tsx       # App entry point
│   ├── package.json
│   └── tailwind.config.js
├── backend/                 # PHP backend API
│   └── index.php           # Main API entry point
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- PHP (v7.4 or higher)
- Web server (Apache/Nginx) or PHP built-in server

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   ```
   http://localhost:3000
   ```

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Start PHP development server:**
   ```bash
   php -S localhost:8000
   ```

3. **API will be available at:**
   ```
   http://localhost:8000
   ```

## 🔐 Demo Credentials

### Test Users
- **Chairperson:** `chairperson` / `password123`
- **Treasurer:** `treasurer` / `password123`
- **Council Member:** `council` / `password123`

## 📱 Mobile App Development

This web application is designed to be easily converted into a mobile app using:

1. **Progressive Web App (PWA)**
   - Installable on mobile devices
   - Offline functionality
   - Push notifications

2. **React Native** (Future)
   - Native mobile app development
   - Code sharing between web and mobile
   - Platform-specific optimizations

## 🎨 Design System

### Colors
- **Primary:** Blue (#3B82F6)
- **Secondary:** Gray (#64748B)
- **Success:** Green (#22C55E)
- **Warning:** Yellow (#F59E0B)
- **Danger:** Red (#EF4444)

### Components
- **Buttons:** Primary, Secondary, Success, Danger variants
- **Cards:** Consistent shadow and border radius
- **Forms:** Input fields with focus states
- **Navigation:** Responsive sidebar with mobile support

## 🔧 Development

### Available Scripts

```bash
# Frontend
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
npm run eject      # Eject from Create React App

# Backend
php -S localhost:8000  # Start PHP development server
```

### Code Style
- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Tailwind CSS** for styling

## 📊 Database Schema (Planned)

### Tables
- `users` - User accounts and roles
- `sk_profiles` - SK information and officials
- `cbydp_projects` - CBYDP project definitions
- `abyip_projects` - Annual project implementations
- `budgets` - Budget allocations and tracking
- `purchase_requests` - Purchase request management
- `project_updates` - Project progress tracking
- `transparency_reports` - Public reports and documents

## 🚀 Deployment

### Frontend (Production)
```bash
cd frontend
npm run build
# Deploy build/ folder to web server
```

### Backend (Production)
- Upload `backend/` folder to web server
- Configure web server (Apache/Nginx)
- Set up MySQL database
- Update API endpoints in frontend

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ Basic authentication
- ✅ Dashboard and navigation
- ✅ SK Setup module
- ✅ Placeholder pages for all modules

### Phase 2 (Next)
- 🔄 CBYDP management
- 🔄 ABYIP generation
- 🔄 Budget management
- 🔄 Project monitoring

### Phase 3 (Future)
- 📋 Transparency portal
- 📋 Mobile app development
- 📋 Advanced reporting
- 📋 Integration with government systems

---

**Built with ❤️ for the SK Community** 