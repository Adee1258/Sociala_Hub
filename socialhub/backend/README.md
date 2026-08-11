# SocialHub Backend

Node.js/Express backend with MongoDB for SocialHub app.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure MongoDB is running locally or update MONGODB_URI in .env

3. Start server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

## API Endpoints

### Auth Routes
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/check-username` - Check username availability

### Health Check
- `GET /api/health` - Server health status

## Environment Variables

- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_EXPIRE` - JWT expiration time (default: 7d)
