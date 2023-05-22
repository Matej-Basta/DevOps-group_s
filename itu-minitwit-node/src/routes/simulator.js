var express = require('express');
var router = express.Router();

const database = require('../db/dbService')

//Services
const LatestService = require('../services/LatestService');
const latestService = new LatestService();

//Utils
var logger = require('../logger/logger');
const hash = require('../utils/hash')
const isSimulator = require('../utils/authorizationValidator');

const GetAllUsers = require('../model/user');
const getAllUsers = new GetAllUsers();
const GetFollowersFromUser = require('../model/followers.js');
const getFollowersFromUser = new GetFollowersFromUser();


//Routing
router.get('/latest', function (req, res, next) {
  res.send({ latest: latestService.getLatest() });
})

router.post("/register", async function (req, res, next) {
  try {
    //Checks if header comes from simulator
    const header = req.headers.authorization;
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.pwd;

    if (!isSimulator(header)) {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 403, message: "You are not authorized to use this resource!" });
      var error = new Error("You are not authorized to use this resource");
      error.status = 403;
      next(error);
      return;
    }

    //Updates Latest
    var latest = req.query.latest;
    if (latest !== undefined && isNaN(parseInt(latest))) {
      latestService.updateLatest(parseInt(latest));
    }

    //Checks if username is taken
    const users = await getAllUsers.getAllUsers()
    const userFound = users.find(user => user.username == username)

    var error = null
    if (username === null) {
      error = "You have to enter a username";
    } else if (email === null || email.indexOf("@") === -1) {
      error = error + ". You have to enter a valid email address"
    } else if (password === null) {
      error = error + ". You have to enter a password"
    } else if (userFound !== undefined) {
      error = error + ". The username is already taken"
    }

    if (error === null) {
      const body = {
        username: username,
        email: email,
        pw_hash: hash(password)
      };
      database.add('user', body, function (err, response) {
        if (err) {
          logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , message: err });
          var newError = new Error("Error adding user to our database");
          newError.status = 500;
          next(newError);
          return;
        } else {
          res.status(204).send("");
        }
      });

    } else {
      //Send error
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 400, message: error });
      var newError = new Error(error);
      newError.status = 400;
      next(newError);
    }
  } catch (error) {
    logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: error });
    var newError = new Error(error);
    newError.status = 500;
    next(newError);
  }
});

router.get('/msgs', function (req, res, next) {
  try {
    //Checks if header comes from simulator
    const header = req.headers.authorization;
    if (!isSimulator(header)) {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 403, message: "You are not authorized to use this resource!" });
      var error = new Error("You are not authorized to use this resource");
      error.status = 403;
      next(error);
      return;
    }

    //Updates Latest
    var latest = req.query.latest;
    if (latest !== undefined && isNaN(parseInt(latest))) {
      latestService.updateLatest(parseInt(latest));
    }

    //Gets Limit
    var no_msgs = parseInt(req.query.no);
    if (!no_msgs) {
      no_msgs = 100;
    }
    
    const query = `SELECT message.*, user.* FROM message, user
    WHERE message.flagged = 0 AND message.author_id = user.user_id
    ORDER BY message.pub_date DESC LIMIT ?`

    database.all(query, [no_msgs], (err, rows) => {
      if (err) {
        logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: err });
        var error = new Error("Error retrieving messages from our database");
        error.status = 500;
        next(error);
        return;
      }
      const filteredMsgs = [];
      for (const msg of rows) {
        const filteredMsg = {};
        filteredMsg.content = msg.text; req.method
        filteredMsg.pubDate = msg.pubDate;
        filteredMsg.user = msg.username;
        filteredMsgs.push(filteredMsg);
      }
      res.send(filteredMsgs);
    });
  } catch (error) {
    logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: error });
    var newError = new Error(error);
    newError.status = 500;
    next(newError);
  }
});

router.get('/msgs/:username', async function (req, res, next) {
  let username = req.params.username;
  try {
    //Checks if header comes from simulator
    const header = req.headers.authorization;
    if (!isSimulator(header)) {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 403, message: "You are not authorized to use this resource!" });
      var error = new Error("You are not authorized to use this resource");
      error.status = 403;
      next(error);
      return;
    }
    //Updates Latest
    var latest = req.query.latest;
    if (latest !== undefined && isNaN(parseInt(latest))) {
      latestService.updateLatest(parseInt(latest));
    }
    //Gets Limit
    var no_msgs = parseInt(req.query.no);
    if (!no_msgs) {
      no_msgs = 100;
    }

    const users = await getAllUsers.getAllUsers()
    const userSelected = users.find(user => user.username == username)
    if (!userSelected) {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 404, message: "User is not on our database" });
      var error = new Error("User is not on our database");
      error.status = 404;
      next(error);
      return;
    }
    const userId = userSelected.user_id

    const query = `SELECT message.*, user.* FROM message, user 
    WHERE message.flagged = 0 AND
    user.user_id = message.author_id AND user.user_id = ?
    ORDER BY message.pub_date DESC LIMIT ?`

    database.all(query, [userId, no_msgs], (err, rows) => {
      if (err) {
        logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: err });
        var error = new Error("Error retrieving messages from our database");
        error.status = 500;
        next(error);
        return;
      }
      const filteredMsgs = [];
      for (const msg of rows) {
        const filteredMsg = {};
        filteredMsg.content = msg.text;
        filteredMsg.pubDate = msg.pubDate;
        filteredMsg.user = msg.username;
        filteredMsgs.push(filteredMsg);
      }
      if (filteredMsgs.length == 0) {
        res.status(204).send("");
      } else {
        res.status(200).send(filteredMsgs);
      }
    });
  } catch (error) {
    logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: error });
    var newError = new Error(error);
    newError.status = 500;
    next(newError);
  }
})

router.post('/msgs/:username', async function (req, res, next) {
  let username = req.params.username;
  let content = req.body.content;
  try {
    //Checks if header comes from simulator
    const header = req.headers.authorization;
    if (!isSimulator(header)) {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 403, message:"You are not authorized to use this resource!" });
      var error = new Error("You are not authorized to use this resource");
      error.status = 403;
      next(error);
      return;
    }
    //Updates Latest
    var latest = req.query.latest;
    if (latest !== undefined && isNaN(parseInt(latest))) {
      latestService.updateLatest(parseInt(latest));
    }

    const users = await getAllUsers.getAllUsers()
    const userSelected = users.find(user => user.username == username)
    if (!userSelected) {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 404, message: "User is not on our database" });
      var error = new Error("User is not on our database");
      error.status = 404;
      next(error);
      return;
    }
    const userId = userSelected.user_id

    const body = {
      author_id: userId,
      text: content.replace(/'/g, "''"),
      pub_date: Date.now(),
      flagged: 0
    };
    database.add('message', body, function (err, response) {
      if (err) {
        logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: err });
        var error = new Error(err);
        error.status = 500;
        next(error);
        return;
      } else {
        logger.log('info',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 204, message: "Message added successfully with id: " + response.insertId });
        res.status(204).send("");
      }
    });
  } catch (error) {
    logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: error });
    var newError = new Error(error);
    newError.status = 500;
    next(newError);
  }
})

router.get('/fllws/:username', async function (req, res, next) {
  let username = req.params.username;
  try {
    //Checks if header comes from simulator
    const header = req.headers.authorization;
    if (!isSimulator(header)) {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 403, message: "You are not authorized to use this resource!" });
      var error = new Error("You are not authorized to use this resource");
      error.status = 403;
      next(error);
      return;
    }
    //Updates Latest
    var latest = req.query.latest;
    if (latest !== undefined && isNaN(parseInt(latest))) {
      latestService.updateLatest(parseInt(latest));
    }

    const users = await getAllUsers.getAllUsers();
    const userSelected = users.find(user => user.username == username);
    if (!userSelected) {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 404, message: "User is not on our database" });
      var error = new Error("User is not on our database");
      error.status = 404;
      next(error);
      return;
    }
    const userId = userSelected.user_id;

    const query = `SELECT user.username FROM user
                   INNER JOIN follower ON follower.whom_id=user.user_id
                   WHERE follower.who_id=?
                   LIMIT ?`;

    const no_followers = parseInt(req.query.no) || 100;
    database.all(query, [userId, no_followers], (err, rows) => {
      if (err) {
        logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: err });
        var error = new Error("Error retrieving followers from our database");
        error.status = 500;
        next(error);
        return;
      }
      const filteredFllws = [];
      for (const fllw of rows) {
        filteredFllws.push(fllw.username);
      }
      const response = { follows: filteredFllws };
      res.send(response);
    });
  } catch (error) {
    logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: error });
    var newError = new Error(error);
    newError.status = 500;
    next(newError);
  }
});

router.post('/fllws/:username', async function (req, res, next) {
  let username = req.params.username;
  try {
    // Checks if header comes from simulator
    const header = req.headers.authorization;
    if (!isSimulator(header)) {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 403, message: "You are not authorized to use this resource!" });
      var error = new Error("You are not authorized to use this resource");
      error.status = 403;
      next(error);
      return;
    }

    // Updates Latest
    const latest = req.query.latest;
    if (latest !== undefined && isNaN(parseInt(latest))) {
      latestService.updateLatest(parseInt(latest));
    }

    const users = await getAllUsers.getAllUsers();
    const userSelected = users.find(user => user.username == username);
    if (!userSelected) {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 404, message: "User is not on our database" });
      var error = new Error("User is not on our database");
      error.status = 404;
      next(error);
      return;
    }
    const userId = userSelected.user_id;

    if (req.body.follow) {
      const followUsername = req.body.follow;
      const followsUser = users.find(user => user.username == followUsername);
      if (!followsUser) {
        logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 404, message: "Follows user is not on our database" });
        var error = new Error("User to be followed is not on our database");
        error.status = 404;
        next(error);
        return;
      }

      const userFollowsList = await getFollowersFromUser.getFollowersFromUser(userId, null);
      if (userFollowsList.includes(followsUser.username)) {
        logger.log('warn',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 204, message: "User already follows this user" });
        var error = new Error("User already follows this user");
        error.status = 204;
        next(error);
        return
      }
      
      const followsUserId = followsUser.user_id;
      const query = "INSERT INTO follower (who_id, whom_id) values (?, ?)";

      database.run(query, [userId, followsUserId], function (err, result) {
        if (err) {
          logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: err });
          var error = new Error(err);
          error.status = 500;
          next(error);
          return;
        }
        res.status(204).send("");
      });
    } else if (req.body.unfollow) {
      const unfollowUsername = req.body.unfollow;
      const unfollowsUser = users.find(user => user.username == unfollowUsername);
      if (!unfollowsUser) {
        logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 404, message: "Unfollows user is not on our database" });
        var error = new Error("Unfollows user is not on our database");
        error.status = 404;
        next(error);
        return;
      }
      const unfollowsUserId = unfollowsUser.user_id;

      //Validates if user is following the unfollows user
      const userFollowsList = await getFollowersFromUser.getFollowersFromUser(userId, null);
      if (!userFollowsList.includes(unfollowsUser.username)) {
        logger.log('warn',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 204, message: "User is not following the user with name " + unfollowsUser.username });
        res.status(204).send("");
        return
      }

      const query = "DELETE FROM follower WHERE who_id=? and whom_id=?";
      database.run(query, [userId, unfollowsUserId], function (err, result) {
        if (err) {
          logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: err });
          var error = new Error(err);
          error.status = 500;
          next(error);
          return;
        }
        res.status(204).send("");
      });
    } else {
      logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 400, message: "Invalid request body" });
      var error = new Error("Invalid request body");
      error.status = 400;
      next(error);
      return;
    }
  } catch (error) {
    logger.log('error',  { url: req.url ,method: req.method, requestBody: req.body , responseStatus: 500, message: error });
    var newError = new Error(error);
    newError.status = 500;
    next(newError);
  }
});

module.exports = router;