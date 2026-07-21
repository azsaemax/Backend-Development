// require("dotenv").config({path: "./.env" });

import dotenv from "dotenv";
import monogoose from "mongoose";
import {DB_NAME} from "./constants.js"
import connectDB from "./db/index.js";
import {app} from "./app.js"



    dotenv.config({ path: "./.env" });

console.log(process.env.TEST_VALUE);
connectDB()

.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running on port ${process.env.PORT || 8000}`);
    });
}) 


.catch((error) => {
    console.error("Error connecting to the database:", error);
})  
    



// import express from "express";
// const app = express()
// (async () => {
//     try {
//         await mongoose.connect(`${process.env.MONGO_URL}/${DB_NAME}`)
//         app.on("error",(error) =>{
//             console.log("Error connecting to the database", error);
//             throw error
//         })
//         app.listen(process.env.PORT, () => {
//             console.log(`Server is running on port ${process.env.PORT}`);
//         })
//     } catch (error) {
//         console.error("Error starting the application:", error);
//         throw error 
//     }

// })()