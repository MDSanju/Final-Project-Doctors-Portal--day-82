const express = require("express");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 5000;

// JWT TOKEN
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5gvym.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// JWT TOKEN function
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("doctors_portal");
    const appointmentsCollection = database.collection("appointments");
    const usersCollection = database.collection("users");

    // POST API
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentsCollection.insertOne(appointment);
      res.json(result);
    });

    // GET API
    app.get("/appointments", verifyToken, async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      const query = { email: email, date: date };
      const cursor = appointmentsCollection.find(query);
      const appointments = await cursor.toArray();
      res.json(appointments);
    });

    // POST API
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    // UPDATE API
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    // UPDATE API(make an admin)
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res.status(403).json({ message: "Sorry. You don't have access here!" });
      }
    });

    // GET API(admin role matched)
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Doctors Portal!");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
