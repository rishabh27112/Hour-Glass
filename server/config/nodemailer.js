import nodemailer from 'nodemailer'
import brevoTransport from 'nodemailer-brevo-transport'
import 'dotenv/config';
const transporter=nodemailer.createTransport(
    new brevoTransport({
        apiKey: process.env.brevo_API,
    })
);
export default transporter;