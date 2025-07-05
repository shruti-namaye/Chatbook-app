# 💬 ChatBook

ChatBook is a full-stack real-time chat application built with **React**, **Node.js**, **Express**, **MongoDB**, and **Socket.IO**. It enables seamless private messaging and group chats with features like emoji support, persistent chat history, user authentication, and a modern responsive UI.

---

## ✨ Features

- 🔐 **User Authentication** (Register/Login)
- 💬 **Private Messaging**
- 👥 **Group Chat Support**
- 📜 **Persistent Chat History** (stored in MongoDB)
- 😊 **Emoji Picker Integration**
- 🧑‍💻 **Active Users Sidebar**
- 📱 **Responsive & Modern UI**
- 🚀 **Real-time Communication** via Socket.IO
- 🔔 **Toast Notifications** for messages

---

## 🛠️ Tech Stack

**Frontend:**

- React
- React Router DOM
- Tailwind CSS
- Emoji Mart
- React Toastify
- Axios

**Backend:**

- Node.js
- Express.js
- MongoDB with Mongoose
- Socket.IO
- CORS, dotenv, bcryptjs

---

## 📂 Project Structure

ChatBook/
│
├── backend/
│ ├── controllers/
│ ├── models/
│ ├── routes/
│ ├── server.js
│ └── .env
│
├── frontend/
│ ├── src/
│ │ ├── components/
│ │ ├── pages/
│ │ ├── App.jsx
│ │ ├── main.jsx
│ │ └── index.css
│ └── vite.config.js
│
├── package.json
└── README.md

Installation:

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/chatbook.git
cd chatbook

2. Backend Setup

    cd backend
    npm install

Create a .env file in backend/:

    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
```

Start the backend server:
npm start

3. Frontend Setup
   cd frontend
   npm install

Start the frontend development server:
npm run dev

To login :
username:gara
password:gara

Project by Shruti S Namaye - Student of Mumbai University
