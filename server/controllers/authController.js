import OtpVerification from '../models/otpVerificationModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import transporter from '../config/nodemailer.js';
// New: Send OTP endpoint (step 1)
export const sendOtp = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    try {
        const emailLower = String(email).trim().toLowerCase().replace(/[\s,;]+$/g, '').replace(/[;,]/g,'');
        // Check if user already exists
        const existingUser = await userModel.findOne({ email: emailLower });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'User already exists' });
        }
        // Rate-limit: if an OTP was sent recently, require a 30s gap before resending
        const existingRecord = await OtpVerification.findOne({ email: emailLower });
        const now = Date.now();
        const RESEND_GAP_MS = 30 * 1000; // 30 seconds
        if (existingRecord && existingRecord.lastSent && (now - existingRecord.lastSent) < RESEND_GAP_MS) {
            const waitMs = RESEND_GAP_MS - (now - existingRecord.lastSent);
            const waitSec = Math.ceil(waitMs / 1000);
            return res.status(429).json({ success: false, message: `Please wait ${waitSec} second(s) before requesting a new OTP.` });
        }

        // Generate OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpireAt = Date.now() + 10 * 60 * 1000; // 10 min
        // Upsert OTP record (store lastSent)
        await OtpVerification.findOneAndUpdate(
            { email: emailLower },
            { otp, otpExpireAt, verified: false, lastSent: now },
            { upsert: true, new: true }
        );
        // Send OTP email
        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: emailLower,
            subject: 'Your OTP for Registration',
            text: `Your OTP is ${otp}. It is valid for 10 minutes.`
        };
        await transporter.sendMail(mailOptions);
        return res.json({ success: true, message: 'OTP sent to your email.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// New: Verify OTP endpoint (step 2)
export const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    try {
        const emailLower = String(email).trim().toLowerCase().replace(/[\s,;]+$/g, '').replace(/[;,]/g,'');
        const record = await OtpVerification.findOne({ email: emailLower });
        if (!record) return res.status(404).json({ success: false, message: 'No OTP request found for this email' });
        if (record.verified) return res.json({ success: true, message: 'Email already verified' });
        if (record.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });
        if (record.otpExpireAt < Date.now()) return res.status(400).json({ success: false, message: 'OTP expired' });
        record.verified = true;
        await record.save();
        return res.json({ success: true, message: 'OTP verified. You can now register.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const register = async (req, res) => {
  const { name, email, password, username } = req.body;

    if (!name || !email || !password || !username) {
        return res.status(400).json({ success: false, message: 'Missing details' });
    }
    try {
        // Password policy: 6-12 chars, at least 1 upper, 1 lower, 1 digit, 1 special char
        const pwdPolicy = /^(?=.{6,12}$)(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?`~]).*$/;
        if (!pwdPolicy.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be 6-12 characters long and include at least one uppercase letter, one lowercase letter, one number and one special character.'
            });
        }
        const normalizedEmail = String(email).trim().toLowerCase().replace(/[\s,;]+$/g, '').replace(/[;,]/g,'');
        const normalizedUsername = String(username).trim().toLowerCase();
        // basic server-side validation for username
        if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
            return res.status(400).json({ success: false, message: 'Invalid username. Use 3-20 chars: lowercase letters, numbers, underscore.' });
        }
        // Only allow registration if email is verified in OtpVerification
        const otpRecord = await OtpVerification.findOne({ email: normalizedEmail });
        if (!otpRecord || !otpRecord.verified) {
            return res.status(403).json({ success: false, message: 'Please verify your email before registering.' });
        }
        // Prevent duplicate user (by email or username)
        const existingUser = await userModel.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
        if (existingUser) {
            const conflictField = existingUser.email === normalizedEmail ? 'Email' : 'Username';
            return res.status(409).json({ success: false, message: `${conflictField} already in use` });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new userModel({
            name,
            email: normalizedEmail,
            username: normalizedUsername,
            password: hashedPassword,
            isAccountVerified: true
        });
        await user.save();
        // Remove OTP record after successful registration
        await OtpVerification.deleteOne({ email: normalizedEmail });
        return res.status(201).json({ success: true, message: 'User registered successfully. You can now log in.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const login = async (req, res) => {
    const { identifier, email, username, password } = req.body;
    // accept common variants and a safe fallback for common typo
    const idInput = identifier ?? email ?? username ?? req.body.userName ?? req.body.login ?? req.body.uesrname;
    if (!idInput || !password) {
        return res.status(400).json({ success: false, message: 'Missing details' });
    }
    try {
        const normalized = String(idInput).trim().toLowerCase();
        const user = await userModel.findOne({ $or: [{ email: normalized }, { username: normalized }] });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        if (!user.isAccountVerified) {
            return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        // Return token and user (without password) so frontend can store and use them
        const userData = { id: user._id, name: user.name, email: user.email, username: user.username };
        return res.status(200).json({ success: true, message: 'Login successful', token, user: userData });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ...existing code...

export const logout = async (req, res)=>{
    try{
        res.clearCookie('token',{
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    })
    return res.json({success: true, message: "Logged Out"})
    } 

    catch(error){
    return res.json({ success: false, message: error.message});
    }
}


export const verifyemail = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.json({ success: false, message: 'Email and OTP are required' });
    }
    try {
        const emailLower = String(email).trim().toLowerCase().replace(/[\s,;]+$/g, '').replace(/[;,]/g,'');
        const user = await userModel.findOne({ email: emailLower });
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        if (user.verifyOtp === '' || user.verifyOtp !== otp) {
            return res.json({ success: false, message: 'Invalid OTP' });
        }
        if (user.verifyOtpExpireAt < Date.now()) {
            return res.json({ success: false, message: 'OTP expired' });
        }
        user.isAccountVerified = true;
        user.verifyOtp = '';
        user.verifyOtpExpireAt = 0;
        await user.save();
        return res.json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const isAuthenticated = async (req, res) =>{
    try{
        return res.json({success:true});
    }
    catch(error){
        res.json({success: false, message: error.message});
    }

}

//Send pwd reset otp

export const sendResetOtp = async (req, res)=>{
    const {email} = req.body;

    if(!email){
        return res.json({success: false, message: 'Email is Required'})
    }

    try{
        const emailLower = String(email).trim().toLowerCase().replace(/[\s,;]+$/g, '').replace(/[;,]/g,'');
        const user = await userModel.findOne({email: emailLower});
        if(!user){
            return res.json({success: false, message: 'User not Found'});
        }
        // Rate-limit reset OTP sends: require 30s gap between sends
        const now = Date.now();
        const RESEND_GAP_MS = 30 * 1000;
        if (user.resetOtpLastSent && (now - user.resetOtpLastSent) < RESEND_GAP_MS) {
            const waitMs = RESEND_GAP_MS - (now - user.resetOtpLastSent);
            const waitSec = Math.ceil(waitMs / 1000);
            return res.status(429).json({ success: false, message: `Please wait ${waitSec} second(s) before requesting a new OTP.` });
        }

        const otp = String(Math.floor(100000 + Math.random()*900000));

        user.resetOtp = otp;
        user.resetOtpExpireAt = Date.now() + 15*60*1000;
        user.resetOtpLastSent = now;

        await user.save();

        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Password Reset OTP',
            text:`Your OTP for resetting your password is ${otp}. Use this OTP to proceed with resetting your password.`
        };
        await transporter.sendMail(mailOptions);
        return res.json({success: true, message: 'OTP sent to your email'});
    }
    catch(error){
        res.json({success: false, message: error.message});
    }
}

export const resetPassword = async(req, res) =>{
    const {email, otp, newPassword} = req.body;

    if(!email || !otp || !newPassword){
        return res.json({success: false, message: 'Email,OTP and new password are required'});
    }

    try{
        const emailLower = String(email).trim().toLowerCase().replace(/[\s,;]+$/g, '').replace(/[;,]/g,'');
        const user = await userModel.findOne({email: emailLower});
        if(!user){
            return res.json({success: false, message: 'User not Found'}); 
        }

        if(user.resetOtp==="" || user.resetOtp!== otp){
             return res.json({success: false, message: 'Invalid OTP'});
        }

        if(user.resetOtpExpireAt < Date.now()){
             return res.json({success: false, message: 'OTP expired'});
        }

        // Enforce same password policy for resets
        const pwdPolicy = /^(?=.{6,12}$)(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?`~]).*$/;
        if (!pwdPolicy.test(newPassword)) {
            return res.json({
                success: false,
                message: 'New password must be 6-12 characters long and include at least one uppercase letter, one lowercase letter, one number and one special character.'
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword,10);

        user.password = hashedPassword;
        user.resetOtp = '';
        user.resetOtpExpireAt = 0;

        await user.save();

        return res.json({success: true, message: 'Password has been reset successfully'});

    }
    catch(error){
       return res.json({success: false, message: error.message});
    }

}