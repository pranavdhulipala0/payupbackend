const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
app.use(cors());

async function run() {
  const x = await mongoose.connect(
    "mongodb+srv://pranavdhulipala14:Qwerty222@cluster0.vru1qe3.mongodb.net/PayUp"
  );
  // console.log(x);
}

run();

let authSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rooms: [],
});

let authMod = new mongoose.model("auths", authSchema);

let roomSchema = new mongoose.Schema({
  roomId: { type: Number, required: true },
  roomName: { type: String, required: true },
  users: [],
  usersData: { type: String, required: true },
  usercount: { type: Number, required: true },
});

let roomMod = new mongoose.model("rooms", roomSchema);

app.use(express.json());

app.post("/register", (req, res) => {
  var registration = new authMod({
    username: req.body.username,
    password: req.body.password,
    rooms: [],
  });

  registration.save();
  res.send("User registered!");
});

function initializer(usersArray, usercount, i) {
  var jsonData = {};
  for (var j = 0; j < usercount; j++) {
    if (i != j) {
      jsonData[usersArray[j]] = 0;
    }
  }
  return jsonData;
}

function updater(paymentData, users) {
  users.forEach((username) => {
    Object.keys(paymentData.toPay[username]).forEach((key) => {
      if (
        paymentData.toPay[username][key] >= paymentData.toBePaid[username][key]
      ) {
        paymentData.toPay[username][key] -= paymentData.toBePaid[username][key];
        paymentData.toBePaid[username][key] = 0;
        paymentData.toPay[key][username] = 0;
        paymentData.toBePaid[key][username] = paymentData.toPay[username][key];
      }
    });
  });

  return paymentData;
}

app.post("/create", async (req, res) => {
  var roomId = req.body.roomId;
  var roomName = req.body.roomName;
  var usersArray = req.body.users;
  var usercount = usersArray.length;
  //Create the structured data
  var userData = { toPay: {}, toBePaid: {} };
  for (var i = 0; i < usercount; i++) {
    var curr = usersArray[i];
    var temp = {};
    var jsonData = initializer(usersArray, usercount, i);
    userData.toPay[curr] = jsonData;
    userData.toBePaid[curr] = jsonData;
  }
  var finalData = JSON.stringify(userData);
  console.log(userData);
  console.log(finalData);
  var creation = new roomMod({
    roomId: roomId,
    roomName: roomName,
    users: usersArray,
    usersData: finalData,
    usercount: usercount,
  });

  creation.save();
  for (var i = 0; i < usercount; i++) {
    const temp = await authMod.updateOne(
      { username: usersArray[i] },
      {
        $push: {
          rooms: { roomId: roomId, roomName: roomName, roomUsers: usersArray },
        },
      }
    );
  }

  // Update the user rooms
  res.send("Success");
});

//GET USERS LIST
app.get("/getUsers", async (req, res) => {
  const users = mongoose.model("auths", authSchema);

  users.find({}, { _id: 0, username: 1 }).then((data) => {
    console.log(data);
    let arr = [];
    for (let i = 0; i < data.length; i++) {
      arr.push(data[i].username);
      // console.log(arr[i]);
    }
    res.send(JSON.stringify(arr));
  });
});

app.get("/temproute", async (req, res) => {
  const temp = await authMod.findOne({ username: "drakeswd" }).then((data) => {
    console.log(data);
    data = data.json;
  });

  console.log(temp);
});

app.post("/addUser", async (req, res) => {
  var newuser = req.body.newuser;
  var roomId = req.body.roomId;
  var mongoData = {};
  var getData = await roomMod.findOne({ roomId: roomId }).then((data) => {
    mongoData = data;
    console.log(data);
  });

  if (!mongoData) {
    res.status(500);
    res.send("Group does not exist");
  } else {
    console.log(mongoData);
    var paymentData = mongoData.usersData;
    paymentData = JSON.parse(paymentData);
    mongoData.users.push(newuser);
    mongoData.usercount += 1;
    var jsonData = initializer(
      mongoData.users,
      mongoData.usercount,
      mongoData.usercount - 1
    );
    paymentData.toPay[newuser] = jsonData;
    paymentData.toBePaid[newuser] = jsonData;
    //Adding new user into everybody's directories

    Object.keys(paymentData.toPay).forEach(function (key) {
      if (key == newuser) {
        //Nothing
      } else {
        paymentData.toPay[key][newuser] = 0;
      }
    });

    Object.keys(paymentData.toBePaid).forEach(function (key) {
      if (key == newuser) {
        //Nothing
      } else {
        paymentData.toBePaid[key][newuser] = 0;
      }
    });

    //Add room into user directory
    const temp = await authMod.updateOne(
      { username: newuser },
      { $push: { rooms: roomId } }
    );

    mongoData["usersData"] = JSON.stringify(paymentData);
    let updating = await roomMod.findOneAndUpdate(
      { roomId: roomId },
      mongoData
    );
    res.send("Success");
  }
});

app.post("/split", async (req, res) => {
  var mongoData = {};
  var username = req.body.username;
  var roomId = req.body.roomId;
  var amount = req.body.amount;
  var getData = await roomMod.findOne({ roomId: roomId }).then((data) => {
    mongoData = data;
    // console.log(data);
  });
  var paymentData = mongoData.usersData;
  paymentData = JSON.parse(paymentData);

  //Now we have to split the amount from here on
  var length = mongoData.usercount;
  var splitAmount = amount / length;
  console.log(splitAmount);
  //ToBePaid
  Object.keys(paymentData.toBePaid[username]).forEach(function (key) {
    paymentData.toBePaid[username][key] += splitAmount;
  });
  //ToPay
  Object.keys(paymentData.toPay).forEach(function (key) {
    if (key == username) {
      //Nothing
    } else {
      paymentData.toPay[key][username] += splitAmount;
    }
  });
  // console.log("After splitting and before updating");
  // console.log(paymentData);
  // console.log("After splitting and updating");
  paymentData = updater(paymentData, mongoData.users);
  console.log(paymentData);
  mongoData["usersData"] = JSON.stringify(paymentData);
  // console.log(mongoData);

  let updating = await roomMod.findOneAndUpdate({ roomId: roomId }, mongoData);
  res.send("Success");
});

app.post("/login", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;

  // console.log(username);

  authMod.findOne({ username }).then((data) => {
    console.log(data);
    if (data) {
      if (data.password === password) {
        res.status(200);
        res.send("Success");
        console.log("Logged in!");
      } else {
        res.status(201);
        res.send("Wrong password");
      }
    } else {
      res.status(202);
      res.send("User not found!");
    }
  });
});

app.post("/fetchRooms", async (req, res) => {
  const username = req.body.username;
  var myRooms = [];
  const data = await authMod.findOne({ username: username }).then((temp) => {
    myRooms = temp.rooms;
  });

  console.log("Request made for: " + username);
  res.send(JSON.stringify(myRooms));
});

app.listen(3002, () => {
  console.log("Listening at 3002");
});
