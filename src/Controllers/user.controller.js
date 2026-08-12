import { asyncHandler } from "../Utils/asyncHandler.js";
import { ApiError } from "../Utils/ApiError.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
import { User } from "../Models/user.model.js";
import { uploadOnCloudinary } from "../Utils/cloudinary.js";
import { deleteFromCloudinary } from "../Utils/cloudinary.js";
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
        avatar: avatar.secure_url,
        avatarPublicId: avatar.public_id,
        coverImage: coverImage?.secure_url || "",
        coverImagePublicId: coverImage?.public_id || "",
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

const changeCurrentPassword = asyncHandler(async (req, res) => {
        const{ oldPassword, newPassword} = req.body;

        const user = await User.findById(req.user._id);
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
         if (!isPasswordCorrect) {
            throw new ApiError(401, "Old password is incorrect");
        }
        user.password = newPassword;
        await user.save({validateBeforeSave: false});

        return res.status(200).json(
            new ApiResponse(
                200,{},
                "Password changed successfully"
            )
        )


})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "Full name and email are required.");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { fullName, email } },
        { new: true, runValidators: true }
    ).select("-password");

    return res.status(200).json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required.");
    }

    const currentUser = await User.findById(req.user._id);

    if (!currentUser) {
        throw new ApiError(404, "User not found.");
    }

    // Delete old avatar
    if (currentUser.avatarPublicId) {
        await deleteFromCloudinary(currentUser.avatarPublicId);
    }

    // Upload new avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar) {
        throw new ApiError(500, "Error uploading avatar.");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.secure_url,
                avatarPublicId: avatar.public_id,
            },
        },
        {
            new: true,
            runValidators: true,
        }
    ).select("-password");

    return res.status(200).json(
        new ApiResponse(200, user, "Avatar updated successfully.")
    );
});
const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image is required.");
    }

    // Get current user
    const currentUser = await User.findById(req.user._id);

    if (!currentUser) {
        throw new ApiError(404, "User not found.");
    }

    // Delete old cover image from Cloudinary
    if (currentUser.coverImagePublicId) {
        await deleteFromCloudinary(currentUser.coverImagePublicId);
    }

    // Upload new cover image
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage) {
        throw new ApiError(500, "Error uploading cover image.");
    }

    // Update user document
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.secure_url,
                coverImagePublicId: coverImage.public_id,
            },
        },
        {
            new: true,
            runValidators: true,
        }
    ).select("-password");

    return res.status(200).json(
        new ApiResponse(
            200,
            user,
            "Cover image updated successfully."
        )
    );
});
//After adding avatarPublicId and coverImagePublicId to your schema, existing users in your database won't have these fields. 
// That means deletion won't work for those old records until they're updated.
//For testing:
//Register a new user, or Update the existing user's document in MongoDB to include the avatarPublicId and coverImagePublicId.
//From then on, every new upload will save the public IDs, and replacing an avatar or cover image will automatically delete the previous image from Cloudinary.

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;
    if( !username.trim() ){
        throw new ApiError(400, "Username is missing");
    }

    const channel = await User.aggregate([
            {
                $match:     {
                username: username?.toLowerCase()
                }
            //we will get one user
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscriberedTo"
                }
            },
            {
                $addFields: {
                    subscribersCount: { 
                        $size: "$subscribers"
                     },
                    channelSubscribedCount: { 
                        $size: "$subscriberedTo"
                     },
                    isSubscribed: {
                        $cond: {
                            if: {
                                $in: [req.user?._id, "$subscribers.subscriber"]
                            },
                            then: true,
                            else: false 
                        }
                    }
                }
            },
            {
                $project: {
                    fullName: 1,
                    username: 1,
                    subscribersCount: 1,
                    channelSubscribedCount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    email: 1,
                    coverImage: 1
                }
            }

    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel not found");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            channel[0],
            "Channel profile fetched successfully"
        )
    );
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
      {
        $match:{
         _id:new mongoose.Types.ObjectId(req.user._id)   
        }
      }  ,
      {
        $lookup: {
            from: "videos",
            localField: "watchHistory",
            foreignField: "_id",
            as: "watchHistoryDetails",
            pipeline: [
                {
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "ownerDetails",
                        pipeline: [
                            {
                                $project: {
                                    fullName: 1,
                                    username: 1,
                                    avatar: 1
                                }
                            }
                        ]
                    }
                },
                {
                    $addFields: {
                        owner: {
                            $first: "$ownerDetails"
                        }
                    }
                }
            ]
        }
    }
    ])


    return res.status(200).json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    );
})






export{
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile
    getWatchHistory
}