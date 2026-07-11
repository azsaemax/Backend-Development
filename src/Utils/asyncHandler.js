const asyncHandler = (requestHandler) => {
    (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
    }
}

export {asyncHandler}


// //Async Await approach to handle errors in express routes. It wraps the async function and catches any errors that occur, passing them to the next middleware for error handling.
// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next);

//     }
//     catch (error) {
//         res.status(err.code || 500).json({
//             success: false,
//             message: err.message || "Internal Server Error",
//         });
//     }
// }


