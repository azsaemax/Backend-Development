import { asyncHandler } from "../Utils/asyncHandler.js";
import {ApiError} from "../Utils/ApiError.js";
import {User} from "../Models/user.model.js";
import {uploadOnCloudinary} from "../Utils/cloudinary.js";
import { ApiResponse } from "../Utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    
// Steps for User register
// 1.Take user data from user
// 2.Add the validation(Both at frontend and backend)
// 3.Check if user already exists
// 4.Check if files exists upload to cloudinary(like image)
// 5.Check if Uploaded if multer uploaded to cloudinary
// 6.Create user entry in db
// 7.Remove password and response token
// 8.Check for user creation if null data is fetched or exact data fetched if fetched then return a response if not then return error

   const{fullName, email, username, password} = req.body;
   console.log("email", email)

   if ([fullName, email, username, password].some((field) => field?.trim() === "") ){
    throw new ApiError(400, "All fields are required");
   }
   
   const existingUsername = await User.findOne({email});
   if(existingUsername){
    throw new ApiError(400, "Username already exists ");
    }


   const existingEmail = await User.findOne({email});
    if(existingEmail){
        throw new ApiError(400, "Email already exists ");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Avatar upload failed");
    }
    
    const user = await  User.create({
        fullName,
        email,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
    });

    const createdUser = await User.findByIdAndUpdate(user._id).select("-password -refreshToken")
    
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully"));

})


export { registerUser }