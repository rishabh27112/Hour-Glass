import mongoose from 'mongoose';

const otpVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true ,lowercase: true},
  otp: { type: String, required: true },
  otpExpireAt: { type: Number, required: true },
  verified: { type: Boolean, default: false }
});

const OtpVerification = mongoose.models.OtpVerification || mongoose.model('OtpVerification', otpVerificationSchema);

export default OtpVerification;
