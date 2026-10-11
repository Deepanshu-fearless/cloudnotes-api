const express = require("express");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


// ===============================
// Create Users Table
// ===============================

async function createUsersTable() {

    try {

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Users table ready");

    } catch (error) {

        console.error("Table creation error:", error);

    }
}


// ===============================
// Home
// ===============================

app.get("/", (req, res) => {

    res.json({
        status: "success",
        message: "CloudNotes API Server is running!"
    });

});


// ===============================
// Database Test
// ===============================

app.get("/api/test", async (req, res) => {

    try {

        const result = await pool.query("SELECT NOW()");

        res.json({
            status: "success",
            message: "API + Database connection working!",
            databaseTime: result.rows[0].now
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            status: "error",
            message: "Database connection failed"
        });

    }

});


// ===============================
// Register
// ===============================

app.post("/api/register", async (req, res) => {

    try {

        const {
            username,
            email,
            password
        } = req.body;


        // Check required fields

        if (!username || !email || !password) {

            return res.status(400).json({
                status: "error",
                message: "Username, email and password are required"
            });

        }


        // Check existing user

        const existingUser = await pool.query(
            `SELECT id
             FROM users
             WHERE username = $1 OR email = $2`,
            [username, email]
        );


        if (existingUser.rows.length > 0) {

            return res.status(409).json({
                status: "error",
                message: "Username or email already exists"
            });

        }


        // Create user

        const result = await pool.query(
            `INSERT INTO users
             (username, email, password)
             VALUES ($1, $2, $3)
             RETURNING id, username, email, created_at`,
            [
                username,
                email,
                password
            ]
        );


        res.status(201).json({

            status: "success",

            message: "Account created successfully",

            user: result.rows[0]

        });


    } catch (error) {

        console.error("Register error:", error);

        res.status(500).json({
            status: "error",
            message: "Server error"
        });

    }

});


// ===============================
// Login
// ===============================

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        // Check fields

        if (!email || !password) {

            return res.status(400).json({
                status: "error",
                message: "Email and password are required"
            });

        }


        // Find user

        const result = await pool.query(
            `SELECT id, username, email, password
             FROM users
             WHERE email = $1`,
            [email]
        );


        if (result.rows.length === 0) {

            return res.status(401).json({
                status: "error",
                message: "Invalid email or password"
            });

        }


        const user = result.rows[0];


        // Check password
        // Temporary plain-text comparison.
        // We will replace this with bcrypt later.

        if (password !== user.password) {

            return res.status(401).json({
                status: "error",
                message: "Invalid email or password"
            });

        }


        // Check JWT secret

        if (!process.env.JWT_SECRET) {

            console.error("JWT_SECRET is missing");

            return res.status(500).json({
                status: "error",
                message: "Server authentication configuration error"
            });

        }


        // Create JWT

        const token = jwt.sign(

            {
                userId: user.id,
                username: user.username,
                email: user.email
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "7d"
            }

        );


        // Send response

        res.json({

            status: "success",

            message: "Login successful",

            token: token,

            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }

        });


    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            status: "error",
            message: "Server error"
        });

    }

});


// ===============================
// JWT Authentication Middleware
// ===============================

function authenticateToken(req, res, next) {

    const authHeader = req.headers["authorization"];

    const token = authHeader && authHeader.split(" ")[1];


    if (!token) {

        return res.status(401).json({
            status: "error",
            message: "Access token required"
        });

    }


    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (error, user) => {

            if (error) {

                return res.status(403).json({
                    status: "error",
                    message: "Invalid or expired token"
                });

            }


            req.user = user;

            next();

        }
    );

}


// ===============================
// Protected Profile Test
// ===============================

app.get(
    "/api/me",
    authenticateToken,
    async (req, res) => {

        try {

            const result = await pool.query(
                `SELECT id, username, email, created_at
                 FROM users
                 WHERE id = $1`,
                [req.user.userId]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    status: "error",
                    message: "User not found"
                });

            }


            res.json({

                status: "success",

                user: result.rows[0]

            });


        } catch (error) {

            console.error("Profile error:", error);

            res.status(500).json({
                status: "error",
                message: "Server error"
            });

        }

    }
);


// ===============================
// Start Server
// ===============================

const PORT = process.env.PORT || 10000;

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

        createUsersTable();

    }
);
