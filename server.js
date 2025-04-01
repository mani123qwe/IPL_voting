equire('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const DATA_PATH = path.join(__dirname, 'data.json');
let db = {
    users: {},
    votes: {
        "CSK (Chennai Super Kings) 🦁": 0,
        "MI (Mumbai Indians) 🌊": 0,
        "RCB (Royal Challengers Bangalore) 🔥": 0,
        "KKR (Kolkata Knight Riders) ⚡": 0,
        "LSG (Lucknow Super Giants) 🏹": 0
    }
};

// Load existing data
try {
    const data = fs.readFileSync(DATA_PATH, 'utf8');
    db = JSON.parse(data);
} catch (err) {
    saveData();
}

function saveData() {
    fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
}

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Middleware
app.use(cors());
app.use(express.json());

function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

function validateEmail(req, res, next) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!req.body.email || !emailRegex.test(req.body.email)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid email format' 
        });
    }
    next();
}

// Routes
app.post('/send-otp', validateEmail, async (req, res) => {
    const { email } = req.body;
    
    try {
        const otp = generateOTP();
        db.users[email] = {
            otp,
            otpExpiry: Date.now() + 600000, // 10 minutes
            verified: false,
            voted: false
        };
        saveData();

        await transporter.sendMail({
            from: `"IPL Voting System" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your OTP for IPL Voting',
            text: `Your OTP is: ${otp}`,
            html: `<b>${otp}</b>`
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to send OTP' 
        });
    }
});

app.post('/verify-otp', validateEmail, (req, res) => {
    const { email, otp } = req.body;
    const user = db.users[email];

    if (!user || user.otp !== otp) {
        return res.status(401).json({ 
            success: false,
            message: 'Invalid OTP' 
        });
    }

    if (Date.now() > user.otpExpiry) {
        return res.status(401).json({ 
            success: false,
            message: 'OTP expired' 
        });
    }

    user.verified = true;
    saveData();
    
    res.json({ 
        success: true,
        hasVoted: user.voted 
    });
});

app.post('/vote', validateEmail, (req, res) => {
    const { email, team } = req.body;
    const user = db.users[email];

    if (!user || !user.verified) {
        return res.status(401).json({ 
            success: false,
            message: 'Unauthorized' 
        });
    }

    if (user.voted) {
        return res.status(400).json({ 
            success: false,
            message: 'Already voted' 
        });
    }

    // Fixed team validation - checks if team exists in votes object
    if (!Object.keys(db.votes).includes(team)) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid team selected' 
        });
    }

    db.votes[team]++;
    user.voted = true;
    saveData();

    res.json({ success: true });
});

app.get('/results', (req, res) => {
    res.json(Object.entries(db.votes).map(([name, votes]) => ({ name, votes })));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
