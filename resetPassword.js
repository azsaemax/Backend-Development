import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import connectDB from "./src/db/index.js";
import { User } from "./src/Models/user.model.js"; // Change Models to models if needed
import bcrypt from "bcrypt";

await connectDB();

const hashedPassword = await bcrypt.hash("12345678", 10);

await User.updateOne(
    { username: "azsaemax" },
    {
        $set: {
            password: hashedPassword
        }
    }
);

console.log("✅ Password updated successfully");

process.exit(0);