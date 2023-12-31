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
  email: {type: String, required: true},
  notifications:[],
  rooms: [],
  friends:[]
});

let authMod = new mongoose.model("auths", authSchema);

let roomSchema = new mongoose.Schema({
  roomId: { type: Number, required: true },
  roomName: { type: String, required: true },
  users: [],
  usersData: { type: String, required: true },
  usercount: { type: Number, required: true },
  roomHistory: []
});

let roomMod = new mongoose.model("rooms", roomSchema);

app.use(express.json());

app.post("/register", (req, res) => {
  username = req.body.username;
  password = req.body.password

  authMod.findOne({ username }).then((data) => {
    if (data) {
      res.status(202);
      res.send("User already exists!");
    } 
    else {
      var registration = new authMod({
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        rooms: [],
        notifications:[]
      });
    
      registration.save();
      res.send("User registered!");
    }
  });
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
    roomHistory:[]
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

  res.send("Success");
});

//DELETE GROUP
app.delete("/deleteRoom", async (req,res)=>{
  try{
    const rid = req.body.rId;
  
    //delete room in rooms collection
    const rooms_col = mongoose.model("rooms", roomSchema);
    console.log("roomId: "+rid);
    const result = await rooms_col.deleteOne({roomId : rid})
    res.send({ message: `${result.deletedCount} document(s) deleted.` })

    //delete room in list of rooms of the user
    const userMod = mongoose.model("auths", authSchema)
    const data = await userMod.updateMany({},{$pull:{"rooms": {"roomId": rid}}});


  }
  catch(err){
    console.error(err);
    res.status(500).json({ error: 'couldnt delete' });
  }
  
})

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

app.post("/getRoomDetails", async(req,res)=>{
  const roomId = req.body.roomId;
  var mongoData = {};
  const temp = await roomMod.findOne({roomId:roomId}).then((data)=>{
    mongoData = data;
    console.log(mongoData);
  })
  res.send(JSON.stringify(mongoData));
});

async function getRoomDetails(roomId){
  var mongoData = {};
  const temp = await roomMod.findOne({roomId:roomId}).then((data)=>{
    mongoData = data;
    console.log(mongoData);
  })
  return mongoData;
}

app.get("/temp",async (req,res)=>{
  const data = await getRoomDetails(1);
  console.log(data);
  res.send("Succ");
})

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

    const roomData = await getRoomDetails(roomId);
    //Add room into user directory
    // roomData.roomUsers.push(newuser);
    // console.log(roomData)
    const users = roomData.users;
    // console.log("My users are: ");
    // console.log(users);
    users.push(newuser);
    const updObj = {
      roomId:parseInt(roomId),
      roomName: roomData.roomName,
      roomUsers: roomData.users
    }
    // console.log("Hi");
    console.log(updObj);
    const temp = await authMod.updateOne(
      { username: newuser },
      { $push: { rooms: updObj } }
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
  var description = req.body.description
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
  mongoData.roomHistory.push(username + " made a payment of " + amount + " for: " + description);
  let updating = await roomMod.findOneAndUpdate({ roomId: roomId }, mongoData);
  res.send("Success");
});

app.post("/payup", async(req,res)=>{
  const sender = req.body.sender;
  const receiver = req.body.receiver;
  const amount = req.body.amount;
  const roomId = req.body.roomId;
  const description = req.body.description;

  var getData = await roomMod.findOne({ roomId: roomId }).then((data) => {
    mongoData = data;
    // console.log(data);
  });
  var paymentData = mongoData.usersData;
  paymentData = JSON.parse(paymentData);
  console.log(paymentData);
  paymentData.toPay[sender][receiver]-=amount;
  paymentData.toBePaid[receiver][sender]-=amount;
  console.log(paymentData);
  mongoData.roomHistory.push(sender + " paid an amount of " + amount + " to " + receiver + " for: " + description);
  mongoData["usersData"] = JSON.stringify(paymentData);
  let updating = await roomMod.findOneAndUpdate({ roomId: roomId }, mongoData);
  let userDetails = await authMod.findOne({username:receiver});
  const notifString = sender + " paid an amount of " + amount + " to you for: " + description;
  const notificationObj = {"id":userDetails.notifications.length+1,"roomId": roomId, "description": notifString, "sender": sender, "amount": amount, status:false};
  const temp = await authMod.updateOne(
    { username: receiver },
    { $push: { notifications: notificationObj } }
  );


  res.send("Success");
});

app.post("/ack", async(req,res)=>{
  const username = req.body.username;
  const id = req.body.id;

  let userDetails = await authMod.findOne({username:username});
  userDetails.notifications[id-1].status = true;
  //console.log(userDetails);
  const temp = await authMod.updateOne(
    { username: username }, userDetails
  );

  res.send("Success");
})

app.post("/login", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  var email = req.body.email;

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


app.post("/fetchNotifs", async (req, res) => {
  const username = req.body.username;
  var notifications = [];
  const data = await authMod.findOne({ username: username }).then((temp) => {
    notifications = temp.notifications;
  });

  console.log("Request made for: " + username);
  res.send(JSON.stringify(notifications));
});

app.listen(3002, () => {
  console.log("Listening at 3002");
});
