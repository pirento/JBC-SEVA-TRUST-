require("dotenv").config();

const {
    authenticateAdmin
} = require("./services/adminAuthService");

async function test() {

    console.log("");
    console.log("=================================");
    console.log("ADMIN AUTHENTICATION TEST");
    console.log("=================================");


    // ========================================
    // CORRECT PASSWORD TEST
    // ========================================

    const correctPassword =
        process.env.ADMIN_TEST_PASSWORD;

    const success =
        await authenticateAdmin({
            password: correctPassword
        });

    console.log("");
    console.log(
        "Correct password result:",
        success
    );


    // ========================================
    // WRONG PASSWORD TEST
    // ========================================

    const wrong =
        await authenticateAdmin({
            password: "WrongPassword123"
        });

    console.log("");
    console.log(
        "Wrong password result:",
        wrong
    );


    console.log("");
    console.log("=================================");

}

test().catch((error) => {

    console.error(
        "❌ Authentication test failed:"
    );

    console.error(
        error.message
    );

});