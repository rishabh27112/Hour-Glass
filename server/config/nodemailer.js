import nodemailer from 'nodemailer'
import brevoTransport from 'nodemailer-brevo-transport'
import 'dotenv/config';

// Prefer BREVO_API_KEY; keep legacy BREVO_API fallback
const transporter = nodemailer.createTransport(
    new brevoTransport({
        apiKey: process.env.BREVO_API_KEY || process.env.BREVO_API || '',
    })
);

export default transporter;