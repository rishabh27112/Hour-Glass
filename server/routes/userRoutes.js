import express from 'express'
import userAuth from '../middleware/userAuth.js';
import { getUserData, searchUsers } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/data',userAuth, getUserData)
// GET /api/users/search?email=...&username=...&q=...  (authenticated)
userRouter.get('/search', userAuth, searchUsers);

export default userRouter;