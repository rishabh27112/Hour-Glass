import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String }, // Not required for Google users
    googleId: { type: String }, // For Google OAuth users
    isAccountVerified: { type: Boolean, default: false },
    resetOtp: { type: String, default: '' },
    resetOtpExpireAt: { type: Number, default: 0 },
    // timestamp (ms) when the last reset OTP was sent
    resetOtpLastSent: { type: Number, default: 0 },
});


const userModel = mongoose.models.user || mongoose.model('user', userSchema)

export default userModel; 