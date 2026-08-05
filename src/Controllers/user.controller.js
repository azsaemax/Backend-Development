import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { User } from "../Models/user.model.js";
import { uploadOnCloudinary } from "../Utils/cloudinary.js";
import jwt from "jsonwebtoken";
/**
 * Generate Access & Refresh Tokens
 */
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating access and refresh tokens."
        );
    }
};

/**
 * Register User
 */
const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body;

    // Validate required fields
    if (
        [fullName, email, username, password].some(
            (field) => !field || field.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required.");
    }

    // Check if user already exists
    const existingUser = await User.findOne({
        $or: [
            { email: email.toLowerCase() },
            { username: username.toLowerCase() },
        ],
    });

    if (existingUser) {
        throw new ApiError(
            409,
            "User with this email or username already exists."
        );
    }

    // Get uploaded files
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required.");
    }

    // Upload avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar) {
        throw new ApiError(500, "Failed to upload avatar.");
    }

    // Upload cover image (optional)
    let coverImage = null;

    if (coverImageLocalPath) {
        coverImage = await uploadOnCloudinary(coverImageLocalPath);
    }

    // Create user
    const user = await User.create({
        fullName,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    });

    // Fetch created user without sensitive fields
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user."
        );
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            createdUser,
            "User registered successfully."
        )
    );
});

/**
 * Login User
 */
const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!(username || email)) {
        throw new ApiError(
            400,
            "Username or email is required."
        );
    }

    if (!password) {
        throw new ApiError(400, "Password is required.");
    }

    // Find user
    const user = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    // Verify password
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials.");
    }

    // Generate tokens
    const { accessToken, refreshToken } =
        await generateAccessAndRefreshTokens(user._id);

    // Remove sensitive fields
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // Cookie options
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in successfully."
            )
        );
});

/**
 * Logout User
 */
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1,
            },
        },
        {
            new: true,
        }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(
                200,
                {},
                "User logged out successfully."
            )
        );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorize Request");
    }
try{
    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )

    const user = await User.findById(decodedToken._id)
     if (!user) {
        throw new ApiError(401, "Invalid refresh token");

    }

    if(incomingRefreshToken !== user.refreshToken){
        throw new ApiError(401, "Refresh token is expired or invalid");
    }

    const options = {
        httpOnly: true,
        secure: true,
    }

    const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    newRefreshToken,
                },
                "Access token refreshed successfully."
            )
        );
    }
    catch(error){
        throw new ApiError(401, error?.message || "Invalid refresh token");
    
    }
    })




export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}