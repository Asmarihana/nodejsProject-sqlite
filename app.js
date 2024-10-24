const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();

app.use(express.json());

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "records.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/register", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, password) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}'
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send(`Created new user with ${newUserId}`);
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  //   a is small in authorization
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/transactions", authenticateToken, async (request, response) => {
  const getQuery = `SELECT * FROM transactions ORDER BY id`;
  const getTransactions = await db.all(getQuery);
  response.send(getTransactions);
});

app.post("/transactions", authenticateToken, async (request, response) => {
  const postQuery = request.body;
  const { type, category, amount, date, description } = postQuery;
  const addTransaction = `INSERT INTO transactions (type, category, amount, date, description) VALUES('${type}','${category}','${amount}','${date}','${description}')`;
  const dbResponse = await db.run(addTransaction);
  const userID = dbResponse.lastID;
  response.send({ userID: userID });
});

app.get(
  "/transactions/:userId",
  authenticateToken,
  async (request, response) => {
    const { userId } = request.params;
    const getQuery = `select * from transactions where id=${userId}`;
    const result = await db.get(getQuery);
    response.send(result);
  }
);

app.put(
  "/transactions/:userId",
  authenticateToken,
  async (request, response) => {
    const { userId } = request.params;
    const putQuery = request.body;
    const { type, category, amount, date, description } = putQuery;
    const updatedQuery = `UPDATE transactions 
      SET  
      type='${type}',category='${category}',amount='${amount}',date='${date}',description='${description}'
      where id=${userId}`;
    const result = await db.run(updatedQuery);
    response.send(result);
  }
);

app.delete(
  "/transactions/:userId",
  authenticateToken,
  async (request, response) => {
    const { userId } = request.params;
    const deleteQuery = `delete from transactions where id=${userId} `;
    await db.run(deleteQuery);
    response.send("Deleted transaction successfully");
  }
);

module.exports = app;
