import mongoose from 'mongoose';

export const connectDB = async () =>{
    try {
        await mongoose.connect( process.env.MONGODB_CONNECTIONSTRING);
        console.log("connected")
    }
    catch(error){
        console.error("error connect: ",error);
        process.exit(1);
    }
}