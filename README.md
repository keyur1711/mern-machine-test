# MERN Stack Assignment

A simple MERN stack application for admin login, agent management, and CSV file distribution.

## Features

1. **Admin Login** - JWT-based authentication
2. **Agent Management** - Create and view agents
3. **CSV Upload & Distribution** - Upload CSV/Excel files and distribute items equally among agents (up to 5 agents)

## Technology Stack

- **MongoDB** - Database
- **Express.js** - Backend framework
- **React.js** - Frontend framework
- **Node.js** - Runtime environment

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd Internship_Assignment
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env file with your MongoDB connection string
# MONGODB_URI=mongodb://localhost:27017/mern_assignment
# JWT_SECRET=your-secret-key
# PORT=5000
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# Create .env file (optional, defaults to http://localhost:5000/api)
# REACT_APP_API_URL=http://localhost:5000/api
```

### 4. Create Admin User

Before running the application, you need to create an admin user in MongoDB. You can do this by:

**Option 1: Using MongoDB Compass or MongoDB Shell**

```javascript
use mern_assignment
db.users.insertOne({
  email: "admin@example.com",
  password: "$2a$10$YourHashedPasswordHere"
})
```

**Option 2: Using a simple script (create-admin.js)**

Create a file `backend/create-admin.js`:

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  email: String,
  password: String
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await User.create({
    email: 'admin@example.com',
    password: hashedPassword
  });
  console.log('Admin user created: admin@example.com / admin123');
  process.exit();
}

createAdmin();
```

Run it:
```bash
cd backend
node create-admin.js
```

## Running the Application

### 1. Start MongoDB

Make sure MongoDB is running on your system:
```bash
# Windows
mongod

# Mac/Linux
sudo systemctl start mongod
# or
mongod
```

### 2. Start Backend Server

```bash
cd backend
npm start
# or for development with auto-reload
npm run dev
```

The backend server will run on `http://localhost:5000`

### 3. Start Frontend Server

Open a new terminal:

```bash
cd frontend
npm start
```

The frontend will run on `http://localhost:3000`

## Usage

1. **Login**
   - Open `http://localhost:3000`
   - Login with admin credentials (e.g., admin@example.com / admin123)

2. **Create Agents**
   - Go to "Agents" tab
   - Fill in agent details (Name, Email, Mobile with country code, Password)
   - Click "Create Agent"

3. **Upload CSV File**
   - Go to "Upload CSV" tab
   - Select a CSV/XLSX/XLS file with columns: FirstName, Phone, Notes
   - Click "Upload and Distribute"
   - Items will be distributed equally among up to 5 agents

4. **View Distributed Lists**
   - Go to "Distributed Lists" tab
   - View items assigned to each agent

## CSV File Format

The CSV file should have the following columns:
- **FirstName** (or firstname, firstName)
- **Phone**
- **Notes**

Example CSV:
```csv
FirstName,Phone,Notes
John Doe,1234567890,Test note 1
Jane Smith,0987654321,Test note 2
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login

### Agents
- `GET /api/agents` - Get all agents (requires authentication)
- `POST /api/agents` - Create new agent (requires authentication)

### Lists
- `POST /api/lists/upload` - Upload CSV file (requires authentication)
- `GET /api/lists/distributed` - Get distributed lists (requires authentication)

## Project Structure

```
Internship_Assignment/
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   ├── Agent.js
│   │   └── List.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── agents.js
│   │   └── lists.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.js
│   │   │   ├── Login.css
│   │   │   ├── Dashboard.js
│   │   │   └── Dashboard.css
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
└── README.md
```

## Notes

- The application distributes items equally among the first 5 agents
- If there are fewer than 5 agents, items are distributed among available agents
- Remaining items (if not divisible) are distributed sequentially starting from the first agent
- Passwords are hashed using bcrypt
- JWT tokens expire after 24 hours

## Troubleshooting

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check your MONGODB_URI in .env file

2. **Port Already in Use**
   - Change PORT in backend/.env
   - Or kill the process using the port

3. **CORS Errors**
   - Ensure backend CORS is configured correctly
   - Check API URL in frontend

4. **File Upload Errors**
   - Ensure file format is CSV, XLSX, or XLS
   - Check file size (max 10MB)
   - Verify CSV has required columns

## License

This project is created for internship assignment purposes.
