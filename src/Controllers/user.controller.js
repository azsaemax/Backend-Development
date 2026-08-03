import { asyncHandler } from "../Utils/asyncHandler.js";
import {ApiError} from "../Utils/ApiError.js";
import {User} from "../Models/user.model.js";
import {uploadOnCloudinary} from "../Utils/cloudinary.js";
import { ApiResponse } from "../Utils/ApiResponse.js";


const generateAccessAndReferenceTokens = async(userId){
    try{
        const user = await User.findById(userId)
        const refreshToken = await user.generateRefreshToken()
        const AccessToken = await user.generateAccessToken()

        user.refreshToken =refreshToken;
        await user.save({validateBeforeSave: false})
        return {refreshToken, AccessToken}

    }
    catch(error){
        throw new ApiError(500, "Something went wrong while generating refresh and acess token");
    }
}

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
//    console.log("email", email)

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
    console.log("Body:", req.body);
console.log("Files:", req.files);
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    // let coverImageLocalPath ;
    // if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
    //     coverImageLocalPath = req.files.coverImage[0].path;
    // }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("req.files:", req.files);
    console.log("Avatar path:", avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Avatar upload failed");
    }
    
    const user = await  User.create({
        fullName,
        email,
        password,
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

// To do list
// 1.Bring the data from request body
// 2.Check username or email is there or not
// 3.Find user
// 4.Password check
// 5.If password matched then provide access token and refresh token(we will make a method)
// 6.Send this tokens as cookies that is secure cookie



const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    if (!username) {
        throw new ApiError(400, "User name or email is required")
    }
   const user = await User.findOne({
    $or: [{username},{email}]
    })
    if (!user){
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
     if (!isPasswordValid){
        throw new ApiError(401, "Invalid credentials")

    }

    const {acessToken, refreshToken} = await generateAccessAndReferenceTokens(user._id)
    
   const loggedInUser = await User.findById(user._id).select("-password -refreshToken") //fields not required

   const options ={
    httpOnly: true,
    secure: true
   }

   return res
   .status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", refreshToken, options)
   .json(
    new ApiResponse(200,
        {
            user: loggedInUser,
            accessToken,
            refreshToken
        },
        "User logged in successfully"
        
    )
   )
})

const logooutUser = asyncHandler(async (req, res) =>{

   User.findByIdAndUpdate(
    req.user_id,
    {
        $set: {refreshToken: undefined}

    },
    {
        new: true
    }

   )

const options ={
    httpOnly: true,
    secure: true
   }

   return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out successfully")
    )

})

export { registerUser }