import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import userModel from '../models/userModel.js';

const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL,
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || (profile._json && profile._json.email) || null;
    // Try to find by googleId first
    let user = await userModel.findOne({ googleId: profile.id });
    if (!user && email) {
      // If a user with the same email exists, link the googleId
      user = await userModel.findOne({ email });
      if (user) {
        user.googleId = profile.id;
        user.isAccountVerified = true;
        await user.save();
      }
    }
    if (!user) {
      // Create new user
      user = await userModel.create({
        googleId: profile.id,
        name: profile.displayName || (profile._json && profile._json.name) || 'Google User',
        email: email || `no-email-${profile.id}@example.com`,
        isAccountVerified: true
      });
    }
    return done(null, user);
  } catch (err) {
    console.error('Google OAuth error:', err);
    return done(err, null);
  }
}
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
