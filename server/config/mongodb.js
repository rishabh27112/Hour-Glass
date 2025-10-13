import mongoose from "mongoose";

const connectDB = async()=>{

    mongoose.connection.on('connected', ()=>console.log("DataBase Connected"));
    await mongoose.connect(`${process.env.MONGODB_URL}/Loginpage`);
};

export default connectDB;
/*import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    userID: {type : String , required :true,index: true},
    email: { type: String, required: true, unique: true , index: true,lowercase: true},
    password: { type: String ,select: false}, // Not required for Google users
    googleId: { type: String }, // For Google OAuth users
    resetOtp: { type: String, default: '' },
    resetOtpExpireAt: { type: Number, default: 0 },
    createdAt:{type:Date},
});
//role :- once project is created by someone , he is given role of PM automatically
const ProjectSchema = new mongoose.Schema({
    ProjectName: { type: String, required: true},
    status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'},
    members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userSchema' // Creates a reference to the user model
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'userSchema',
    required: true
  }

}, { timestamps: true });

const timeEntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date // Can be null if the timer is currently running
  },
  duration: { // Stored in seconds
    type: Number,
    required: true,
    default: 0
  },
  }, { timestamps: true });
module.exports = mongoose.model('TimeEntry', timeEntrySchema);
const userModel = mongoose.models.user || mongoose.model('user', userSchema)

export default userModel;  */