const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "CloudNotes API Server is running!"
    });
});

app.get("/api/test", (req, res) => {
    res.json({
        status: "success",
        message: "API connection working!"
    });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
