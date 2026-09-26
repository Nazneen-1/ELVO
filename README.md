# ELVO 🗓️

> **Elevate Your Everyday.**
> ELVO is an intuitive, calendar-first task and schedule management platform designed for students and modern professionals.

**[🌐 Live Demo: ELVO on Vercel](https://elvo-two.vercel.app/)**

---

## 🚀 Quick Start

### 1. Backend Setup
```bash
cd server
npm install
cp .env.example .env
# Fill in your MONGODB_URI and JWT_SECRET in the .env file
npm run dev
```

### 2. Frontend Setup
```bash
cd client
npm install
cp .env.example .env
# Ensure your client environment variables point to the backend (e.g., VITE_API_URL)
npm run dev
```

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router v6, date-fns, Lucide React, Axios
- **Backend:** Node.js, Express.js, MongoDB, Mongoose, JWT, bcryptjs, Helmet, CORS, Nodemailer
- **Database:** MongoDB Atlas
- **Deployment:** Vercel (Frontend), Render/Railway (Backend)
