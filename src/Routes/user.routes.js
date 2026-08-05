import { Router } from "express";
import { loginUser, registerUser, logoutUser, refreshAccessToken } from "../controllers/user.controller.js";
import { upload } from "../Middlewares/Multer.middleware.js";
import { verifyJWT } from "../Middlewares/auth.middleware.js";

const router = Router();

console.log("✅ user.routes.js loaded");

router.get("/test", (req, res) => {
    res.send("Working");
});

router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 }
    ]),
    registerUser
);

router.route("/login").post(loginUser);

router.route("/logout").post(verifyJWT, logoutUser);

router.route("/refresh-token").post(refreshAccessToken);

export default router;