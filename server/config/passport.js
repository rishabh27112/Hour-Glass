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
    // helper to create a unique username
    const makeBase = () => {
      const fromEmail = email ? email.split('@')[0] : '';
      const fromName = (profile.displayName || '').toString().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
      const base = (fromEmail || fromName || `user_${profile.id.substring(0,6)}`).toLowerCase();
      const cleaned = base.replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 20);
      return cleaned.length >= 3 ? cleaned : `user_${profile.id.substring(0,6)}`;
    };
    const getUniqueUsername = async (base) => {
      let candidate = base;
      let suffix = 0;
      // ensure lowercase
      candidate = candidate.toLowerCase();
      // loop until unique
      // limit attempts to avoid infinite loops
      for (let i = 0; i < 50; i++) {
        // re-trim to max 20 when adding suffix
        const withSuffix = suffix === 0 ? candidate : `${candidate}`.slice(0, Math.max(1, 20 - String(suffix).length - 1)) + `_${suffix}`;
        const exists = await userModel.findOne({ username: withSuffix });
        if (!exists) return withSuffix;
        suffix++;
      }
      return `${candidate}_${Date.now().toString().slice(-4)}`.slice(0, 20);
    };
    // Try to find by googleId first
    let user = await userModel.findOne({ googleId: profile.id });
    if (!user && email) {
      // If a user with the same email exists, link the googleId
      user = await userModel.findOne({ email: email.toLowerCase() });
      if (user) {
        user.googleId = profile.id;
        user.isAccountVerified = true;
        // backfill username if missing (due to schema update)
        if (!user.username) {
          user.username = await getUniqueUsername(makeBase());
        }
        await user.save();
      }
    }
    if (!user) {
      // Create new user
      const username = await getUniqueUsername(makeBase());
      user = await userModel.create({
        googleId: profile.id,
        name: profile.displayName || (profile._json && profile._json.name) || 'Google User',
        email: (email || `no-email-${profile.id}@example.com`).toLowerCase(),
        username,
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
