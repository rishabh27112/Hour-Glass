import jwt from "jsonwebtoken";


const userAuth = async (req, res, next) =>{
    // Accept token from cookie (httpOnly) or Authorization header (Bearer)
        const cookieToken = req.cookies && req.cookies.token;
        const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
        const bearerToken = authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const token = cookieToken || bearerToken || (req.body && req.body.token) || (req.query && req.query.token);

        // Debug: log which source provided a token (do not log token value)
        try {
            const source = cookieToken ? 'cookie' : (bearerToken ? 'authorization-header' : (req.body && req.body.token ? 'body' : (req.query && req.query.token ? 'query' : 'none')));
            console.log(`[userAuth] token source=${source} path=${req.path} method=${req.method}`);
        } catch (e) {}

    if(!token){
        console.log('[userAuth] No token found in request');
        return res.status(401).json({success: false, message: 'Not Authorized. Login Again.'});
    }

    try{
        // Verify JWT_SECRET is configured
        if (!process.env.JWT_SECRET) {
            console.error('[userAuth] CRITICAL: JWT_SECRET not configured!');
            return res.status(500).json({success: false, message: 'Server configuration error'});
        }

        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        if(tokenDecode && tokenDecode.id){
            req.userId = tokenDecode.id;
            // Optional: Add user info to request for logging
            console.log(`[userAuth] Authenticated user: ${tokenDecode.id}`);
        }
        else{
            console.log('[userAuth] Token decoded but no user ID found');
            return res.status(401).json({success: false, message: 'Not Authorized. Login Again.'});
        }

        next();
    }
    catch(error){
        console.log(`[userAuth] JWT verification failed: ${error.message}`);
        // Provide specific error messages for common JWT errors
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({success: false, message: 'Token expired. Please login again.'});
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({success: false, message: 'Invalid token. Please login again.'});
        }
        return res.status(401).json({success: false, message: 'Authentication failed. Please login again.'});
    }
}

export default userAuth;