const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("ytdl-core");
const request = require("request");
const fs = require("fs");
const getYoutubeID = require("get-youtube-id");
const youtubeInfo = require("youtube-info");
const dotenv = require("dotenv");
dotenv.load();

let config = require("./settings.json");

const botToken = process.env.BOT_TOKEN;
const youtubeAPIKey = process.env.YOUTUBE_API_KEY;
const botMaster = process.env.BOT_MASTER;
const prefix = config.prefix;

let queue = [];
let isPlaying = false;
let dispatcher = null;
let voiceChannel = null;
let skipReq = 0;
let skippers = [];

client.on("ready", function () {
  console.log(`Logged in as ${client.user.username}#${client.user.discriminator}`);
});

client.on("message", function(message) {
  const member = message.member;
  const msg = message.content.toLowerCase();
  const args = message.content.split(" ").slice(1).join(" ");

  if(message.author.equals(client.user) || message.author.bot) return;

  if(msg.startsWith(prefix + "play")) {
    if (queue.length > 0 || isPlaying) {
      getID(args, function (id) {
        addToQueue(id);
        youtubeInfo(id, function (err, videoinfo) {
          if (err) {
            throw new Error(err);
          }
          message.reply("the song: **" + videoinfo.title + "** has been added to the queue.");
        });
      });
    } else {
      isPlaying = true;
      getID(args, function(id) {
        queue.push("Placeholder");
        playMusic(id, message);
        youtubeInfo(id, function (err, videoinfo) {
          if (err) {
            throw new Error(err);
          }
          message.reply("the song: **" + videoinfo.title + "** is now playing!");
        });
      });
    }
  }
  else if (msg.startsWith(prefix + "skip")) {
    if (skippers.indexOf(message.author.id) == -1) {
      skippers.push(message.author.id);
      skipReq++;
      if (skipReq >= Math.ceil((voiceChannel.members.size - 1) / 2)) {
        skipMusic(message);
        message.reply("your skip request has been accepted. The current song will be skipped!");
      }
      else {
        message.reply("your skip request has been accepted. You need **" + (Math.ceil((voiceChannel.members.size - 1) / 2) - skipReq) + "** more skip requests!");
      }
    }
    else {
      message.reply("you already submitted a skip request.");
    }
  }
});

function isYoutube(str) {
  return str.toLowerCase().indexOf("youtube.com") > -1;
}

function searchVideo(query, callback) {
  request("https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=" + encodeURIComponent(query) + "&key=" + youtubeAPIKey, function(error, response, body) {
    var json = JSON.parse(body);
    if (!json.items[0]) {
      callback("5FjWe31S_0g");
    }
    else {
      callback(json.items[0].id.videoId);
    }
  });
}

function getID(str, callback) {
  if (isYoutube(str)) {
    callback(getYoutubeID(str));
  } else {
    searchVideo(str, function(id) {
      callback(id);
    });
  }
}

function addToQueue(strID) {
  if (isYoutube(strID)) {
    queue.push(getYoutubeID(strID));
  } else {
    queue.push(strID);
  }
}

function playMusic(id, message) {
  voiceChannel = message.member.voiceChannel;

  voiceChannel.join().then(function(connection) {
    stream = ytdl("https://www.youtube.com/watch?v=" + id, {
      filter: 'audioonly'
    });
    skipReq = 0;
    skippers = [];

    dispatcher = connection.playStream(stream);
    dispatcher.on("end", function () {
      skipReq = 0;
      skippers = [];
      queue.shift();
      if (queue.length === 0) {
        queue = [];
        isPlaying = false;
      } else {
        playMusic(queue[0], message);
      }
    });
  });
}

function skipMusic(message) {
  dispatcher.end();
  if (queue.length > 1) {
    playMusic(queue[0], message);
  }
  else {
    skipReq = 0;
    skippers = [];
  }
}

client.login(botToken);
