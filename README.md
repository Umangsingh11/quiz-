# Real-Time Fullstack Quiz Application

A modern, fast, and real-time quiz application designed for college events.

## Features
*   **Real-time** sync between Admin and Participants (Socket.io)
*   **Anti-Cheat System** (Visibility API, Fullscreen Enforcement, Blur Detection, No Right-Click)
*   **Live Leaderboard** and scoring mechanisms
*   **Admin Dashboard** to add questions and control quiz flow

---

## 🏃‍♂️ Step-by-Step Local Setup

1. **Prerequisites**: Make sure you have [Node.js](https://nodejs.org/) installed and a MongoDB Database (local or MongoDB Atlas).

2. **Clone / Download** this folder.

3. **Backend Setup**:
   - Open your terminal and navigate to the backend folder:
     ```bash
     cd backend
     ```
   - Install dependencies:
     ```bash
     npm install
     ```
   - Make sure your `.env` file in the `backend/` folder has your MongoDB URI:
     ```env
     MONGO_URI=mongodb://localhost:27017/quiz_db 
     # Or your MongoDB Atlas connection string
     JWT_SECRET=supersecretjwtkeyforquiz
     PORT=5000
     ```
   - Start the server:
     ```bash
     npm start
     # Server will run on http://localhost:5000
     ```

4. **Frontend Setup**:
   - The frontend is built with pure HTML/CSS/JS (Vanilla).
   - You can simply open `frontend/index.html` directly in your browser or serve it using an extension like VS Code Live Server.

5. **Testing Locally**:
   - Open the frontend and Register a new user.
   - **Important**: To access the Admin Panel, you need to manually set `isAdmin: true` for a user in your MongoDB database, or you can register one user, use a DB viewer like MongoDB Compass to change their `isAdmin` to `true`, and log in again.
   - Login as the admin on one window, and students on other windows. Admin starts the quiz, students answer!

---

## 🚀 Deployment Instructions

To make this app available publicly with a custom domain (e.g., `myquiz.in`), follow these steps:

### 1. Deploy Backend on Render (Free)
1. Push your code to a GitHub repository.
2. Go to [Render](https://render.com/) and create a new **Web Service**.
3. Connect your GitHub repository and select the `backend` directory (if deployed as a monorepo, set the Root Directory to `backend`).
4. Build command: `npm install`
5. Start command: `node server.js`
6. Under **Environment Variables**, add:
    *   `MONGO_URI`: Your MongoDB Atlas connection string.
    *   `JWT_SECRET`: A secure random string.
7. Click **Deploy**. Copy the provided Render URL (e.g., `https://quiz-backend.onrender.com`).

### 2. Update Frontend API Endpoint
Before deploying the frontend, update the API URLs to point to your live Render backend:
*   In `frontend/js/api.js`, change `API_URL` to `https://quiz-backend.onrender.com/api`
*   In all files using Socket (`admin.js`, `quiz.js`, `socket-client.js`, `leaderboard.html`), change `http://localhost:5000` to `https://quiz-backend.onrender.com`.

### 3. Deploy Frontend on Vercel (Free)
1. Go to [Vercel](https://vercel.com/) and log in.
2. Click **Add New Project** and import your GitHub repository.
3. Select the `frontend` folder as your Root Directory.
4. Since this is Vanilla HTML/JS, Vercel requires no build commands.
5. Click **Deploy**. Your frontend is now live on a Vercel subdomain!

### 4. How to Buy a Domain & Map it
1. Go to **GoDaddy** or **Namecheap**.
2. Search for your desired domain (e.g., `myquiz.in`) and purchase it.
3. Once purchased, go to your Domain **DNS Settings** (Nameserver / DNS Management).
4. **Connect Domain to Frontend (Vercel)**:
    *   In Vercel, go to your project **Settings > Domains** and add `myquiz.in`.
    *   Vercel will give you DNS records to add. Usually, this means going to GoDaddy/Namecheap and adding:
        *   **Type:** `A Record` | **Host/Name:** `@` | **Value:** `76.76.21.21` (Vercel IP)
        *   **Type:** `CNAME` | **Host/Name:** `www` | **Value:** `cname.vercel-dns.com`
5. *Wait 10-30 minutes for DNS propagation.* Your app is now live at `myquiz.in`!

---

## Sample Data for Testing
You can easily add questions via the Admin Dashboard. Here is some sample data you can add:
*   **Q:** What is the speed of light?
    *   *Options:* 3x10^8 m/s, 1x10^8 m/s, 5x10^8 m/s, 2x10^8 m/s
    *   *Correct:* 3x10^8 m/s
*   **Q:** Which programming language is known as the language of the web?
    *   *Options:* Python, JavaScript, C++, Java
    *   *Correct:* JavaScript
