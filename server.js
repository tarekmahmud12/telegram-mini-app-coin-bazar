const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
// Port is now dynamic for deployment on platforms like Vercel or Heroku
const port = process.env.PORT || 3000;

// Middleware setup to handle JSON and enable CORS
app.use(express.json());
app.use(cors());

// MongoDB Connection URI from environment variables for security
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);

let db;

async function connectToDb() {
    try {
        await client.connect();
        db = client.db("coin_bazar_db"); // Replace with your desired database name
        console.log("Connected to MongoDB Atlas!");
    } catch (error) {
        console.error("Failed to connect to MongoDB", error);
        process.exit(1); // Exit process with failure
    }
}

connectToDb();

// API endpoint to save or update user data
// Method: POST
// URL: /api/user/save
app.post('/api/user/save', async (req, res) => {
    try {
        const { telegramId, userName, points } = req.body;
        
        if (!telegramId) {
            return res.status(400).json({ message: "telegramId is required" });
        }

        const usersCollection = db.collection("users"); // Replace with your desired collection name

        const result = await usersCollection.updateOne(
            { telegramId: telegramId },
            { $set: { userName: userName, points: points } },
            { upsert: true } // Creates a new document if one doesn't exist
        );

        res.status(200).json({ message: "User data saved successfully", result });
    } catch (error) {
        console.error("Error saving user data:", error);
        res.status(500).json({ message: "Error saving user data" });
    }
});

// API endpoint to load user data
// Method: GET
// URL: /api/user/:telegramId
app.get('/api/user/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const usersCollection = db.collection("users");

        const user = await usersCollection.findOne({ telegramId: telegramId });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error("Error loading user data:", error);
        res.status(500).json({ message: "Error loading user data" });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
