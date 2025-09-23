import OtpVerification from '../models/otpVerificationModel.js';
// New: Send OTP endpoint (step 1)
export const sendOtp = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    try {
        // Check if user already exists
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'User already exists' });
        }
        // Generate OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpireAt = Date.now() + 10 * 60 * 1000; // 10 min
        // Upsert OTP record
        await OtpVerification.findOneAndUpdate(
            { email },
            { otp, otpExpireAt, verified: false },
            { upsert: true, new: true }
        );
        // Send OTP email
        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: email,
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
        const record = await OtpVerification.findOne({ email });
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
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import transporter from '../config/nodemailer.js';

export const register = async (req, res) => {
  const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Missing details' });
    }
    try {
        // Only allow registration if email is verified in OtpVerification
        const otpRecord = await OtpVerification.findOne({ email });
        if (!otpRecord || !otpRecord.verified) {
            return res.status(403).json({ success: false, message: 'Please verify your email before registering.' });
        }
        // Prevent duplicate user
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'User already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new userModel({
            name,
            email,
            password: hashedPassword,
            isAccountVerified: true
        });
        await user.save();
        // Remove OTP record after successful registration
        await OtpVerification.deleteOne({ email });
        return res.status(201).json({ success: true, message: 'User registered successfully. You can now log in.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Missing details' });
    }
    try {
        const user = await userModel.findOne({ email });
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
        return res.status(200).json({ success: true, message: 'Login successful' });
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

export const sendVerifyOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.json({ success: false, message: 'Email is required' });
        }
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        if (user.isAccountVerified) {
            return res.json({ success: false, message: 'Account already verified' });
        }
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        user.verifyOtp = otp;
        user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;
        await user.save();
        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Account Verification OTP',
            text: `Your OTP is ${otp}. Verify your account using this OTP.`
        };
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Verification OTP sent on email' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const verifyemail = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.json({ success: false, message: 'Email and OTP are required' });
    }
    try {
        const user = await userModel.findOne({ email });
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
        const user = await userModel.findOne({email});
        if(!user){
            return res.json({success: false, message: 'User not Found'});
        }
         const otp = String(Math.floor(100000 + Math.random()*900000));

        user.resetOtp = otp;
        user.resetOtpExpireAt = Date.now() + 15*60*1000;

        await user.save();

        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Password Reset OTP',
            text:`Your OTP for resetting your password is ${otp}. Use this OTP to proceed with resetting your password.`
        };
        await transporter.sendMail(mailOptions);
        return res.json({success: true, message: 'OTP sent to youe email'});
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

        const user = await userModel.findOne({email});
        if(!user){
            return res.json({success: false, message: 'User not Found'}); 
        }

        if(user.resetOtp==="" || user.resetOtp!== otp){
             return res.json({success: false, message: 'Invalid OTP'});
        }

        if(user.resetOtpExpireAt < Date.now()){
             return res.json({success: false, message: 'OTP expired'});
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