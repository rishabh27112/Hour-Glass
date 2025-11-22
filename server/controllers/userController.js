import userModel from "../models/userModel.js";
import Project from "../models/ProjectModel.js";

export const getUserData = async(req, res) => {
    try{
        const userId = req.userId;

        const user = await userModel.findById(userId);

        if(!user){
             return res.json({success: false, message: 'User not Found'});
        }

        // Determine if user is a manager by checking if they've created any projects
        const projectCount = await Project.countDocuments({ createdBy: userId });
        const isManager = projectCount > 0;

        // Match the format returned by login endpoint for consistency
        return res.json({
            success:true,
            userData:{
                id: user._id,
                _id: user._id, // Include for backwards compatibility
                name: user.name,
                email: user.email,
                username: user.username,
                isAccountVerified: user.isAccountVerified,
                googleId: user.googleId,
                // Dynamically set based on project ownership
                role: isManager ? 'manager' : 'employee',
                isManager: isManager
            }
        });
    }  

    catch(error){
        console.error('getUserData error:', error);
        return res.status(500).json({success: false, message: 'Server error'});
    }
}

export const searchUsers = async (req, res) => {
    try {
        // Support: ?q= (typed prefix search), ?username= (explicit), ?email=
        // If q is empty: return some users up to limit (default 20)
        const { q, username, email, limit } = req.query;

        const maxLimit = 50;
        let lim = 20;
        if (limit) {
            const parsed = parseInt(limit, 10);
            if (!isNaN(parsed) && parsed > 0) lim = Math.min(parsed, maxLimit);
        }

        // helper to escape regex special chars
        const escapeRegex = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

        let queryObj = {};

        if (username && username.trim()) {
            const safe = escapeRegex(username.trim());
            queryObj = { username: { $regex: new RegExp('^' + safe, 'i') } };
        } else if (email && email.trim()) {
            const safe = escapeRegex(email.trim());
            queryObj = { email: { $regex: new RegExp('^' + safe, 'i') } };
        } else if (q && q.trim()) {
            // typed search: treat as prefix for username (users expect incremental search)
            const safe = escapeRegex(q.trim());
            queryObj = { username: { $regex: new RegExp('^' + safe, 'i') } };
        } else {
            // empty search: return some users (recently created)
            queryObj = {};
        }

    // include email in selection so clients can show/search-by-email results
    const users = await userModel.find(queryObj).select('_id username name email createdAt').sort({ createdAt: -1 }).limit(lim);

        // Mask usernames for display: show first char and replace rest with '*' (preserves length)
        const masked = users.map(u => {
            const uname = u.username || '';
            const maskedName = uname.length > 1 ? uname[0] + '*'.repeat(uname.length - 1) : uname;
            return { _id: u._id, username: uname, usernameMasked: maskedName, name: u.name || '', email: u.email || '' };
        });

        return res.json({ success: true, users: masked });
    } catch (error) {
        console.error('searchUsers error', error);
        return res.status(500).json({ success: false, message: 'Server error searching users' });
    }
}