
import express from "express";
import cors from "cors";
import 'dotenv/config';
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "./config/passport.js";
import jwt from 'jsonwebtoken';
import connectDB from "./config/mongodb.js";
import authRouter from './routes/authRoutes.js';
import userRouter from "./routes/userRoutes.js";
import projectRouter from './routes/ProjectRoutes.js';
import timeEntryRouter from './routes/TImeEntryRoutes.js';
import classificationRoutes from './routes/classificationRoutes.js';
import "./cron/notificationJob.js"; 
import notificationRoutes from "./routes/notificationRoutes.js";
import brainstormRoutes from './routes/brainstormRoutes.js';

const app = express();
const port = process.env.PORT || process.env.port || 4000;
connectDB();

// CORS configuration for both development and production
const allowedOrigins = [
    'http://localhost:3000',
    'https://hour-glass-1.onrender.com',
    process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(null, true); // Allow anyway in production to prevent lockout
        }
    },
    methods: "GET, POST, PUT, DELETE, PATCH, HEAD",
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Session middleware (required for passport)
app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set secure: true if using https
}));
app.use(passport.initialize());
app.use(passport.session());
//app.use(cors({origin: allowedOrigins, credentials:true}))


// Google OAuth2 routes
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: FRONTEND_URL.replace(/\/$/, '') + '/' }),
    async (req, res) => {
        try {
            // Successful authentication, create JWT and set cookie
            const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            // Redirect to frontend dashboard and also append token so SPA can persist it (fallback if cookie blocked)
            // Token is still in httpOnly cookie for normal auth; query param helps storing in localStorage for header usage.
            const redirectUrl = `${FRONTEND_URL.replace(/\/$/, '')}/dashboard?auth_token=${encodeURIComponent(token)}`;
            res.redirect(redirectUrl);
        } catch (err) {
            console.error('Google callback error:', err);
                res.redirect(`${FRONTEND_URL.replace(/\/$/, '')}/?google_error=1`);
        }
    }
);

//API endpoints
app.get('/', (req, res) => res.send("API Working"));
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/projects', projectRouter);
app.use('/api/time-entries', timeEntryRouter);
app.use('/api/classification-rules', classificationRoutes);

// Debug route to inspect Google OAuth session (for dev only)
app.get('/api/auth/google/success', (req, res) => {
    if (req.user) {
        return res.json({ success: true, user: { id: req.user._id, name: req.user.name, email: req.user.email } });
    }
    return res.json({ success: false, message: 'No user in session' });
});

app.use("/api/notifications", notificationRoutes);
app.use("/api/brainstorm", brainstormRoutes);

app.listen(port, ()=> console.log(`Server started on PORT: ${port} `));