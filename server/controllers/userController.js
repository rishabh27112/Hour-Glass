import userModel from "../models/userModel.js";

export const getUserData = async(req, res) => {
    try{
        const userId = req.userId;

        const user = await userModel.findById(userId);

        if(!user){
             return res.json({success: false, message: 'User not Found'});
        }

        return res.json({
            success:true,
            userData:{
                name: user.name,
                email: user.email,
                username: user.username
            }
        });
    }  

    catch(error){

    }
}

export const searchUsers = async (req, res) => {
    try {
        const { email, username, q } = req.query;

        // Build query: prefer explicit email/username, otherwise use q for flexible search
        const conditions = [];
        if (email) {
            conditions.push({ email: { $regex: new RegExp(`^${email.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i') } });
        }
        if (username) {
            conditions.push({ username: { $regex: new RegExp(`^${username.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i') } });
        }
        if (q && conditions.length === 0) {
            const safe = q.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            conditions.push({ username: { $regex: new RegExp(safe, 'i') } });
            conditions.push({ email: { $regex: new RegExp(safe, 'i') } });
            conditions.push({ name: { $regex: new RegExp(safe, 'i') } });
        }

        const query = conditions.length > 0 ? { $or: conditions } : {};

        const users = await userModel.find(query).select('_id username email name').limit(20);
        return res.json({ success: true, users });
    } catch (error) {
        console.error('searchUsers error', error);
        return res.status(500).json({ success: false, message: 'Server error searching users' });
    }
}