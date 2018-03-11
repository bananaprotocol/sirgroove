const Discord = require('discord.js');
const client = new Discord.Client();
const ytdl = require('ytdl-core');
const request = require('request');
const fs = require('fs');
const getYoutubeID = require('get-youtube-id');
const youtubeInfo = require('youtube-info');
const dotenv = require('dotenv');
dotenv.load();

let config = require('./settings.json');

const botToken = process.env.BOT_TOKEN;
const youtubeAPIKey = process.env.YOUTUBE_API_KEY;
const botMaster = process.env.BOT_MASTER;
const prefix = config.prefix;

let guilds = {};

client.on('ready', function () {
  console.log(`Logged in as ${client.user.username}#${client.user.discriminator}`);
  clientUser = client.user;
  clientUser.setActivity('some sick Tunes!', { type: 'PLAYING' });
});

client.on('message', function (message) {
  const member = message.member;
  const msg = message.content.toLowerCase();
  const args = message.content.split(' ').slice(1).join(' ');

  if (!guilds[message.guild.id]) {
    guilds[message.guild.id] = {
      queue: [],
      queueNames: [],
      isPlaying: false,
      dispatcher: null,
      voiceChannel: null,
      skipReq: 0,
      skippers: [],
    };
  }

  if (message.author.equals(client.user) || message.author.bot) return;

  if (msg.startsWith(prefix + 'play')) {
    if (member.voiceChannel || guilds[message.guild.id].voiceChannel != null) {
      if (guilds[message.guild.id].queue.length > 0 || guilds[message.guild.id].isPlaying) {
        getID(args, function (id) {
          addToQueue(id, message);
          youtubeInfo(id, function (err, videoinfo) {
            if (err) {
              throw new Error(err);
            }

            guilds[message.guild.id].queueNames.push(videoinfo.title);
            message.reply('the song: **' + videoinfo.title + '** has been added to the queue.');
          });
        });
      } else {
        guilds[message.guild.id].isPlaying = true;
        getID(args, function (id) {
          guilds[message.guild.id].queue.push(id);
          playMusic(id, message);
          youtubeInfo(id, function (err, videoinfo) {
            if (err) {
              throw new Error(err);
            }

            guilds[message.guild.id].queueNames.push(videoinfo.title);
            message.reply('the song: **' + videoinfo.title + '** is now playing!');
          });
        });
      }
    } else if (member.voiceChannel === false) {
      message.reply('you have to be in a voice channel to play music!');
    } else {
      message.reply('you have to be in a voice channel to play music!');
    }
  } else if (msg.startsWith(prefix + 'skip')) {
    if (guilds[message.guild.id].skippers.indexOf(message.author.id) === -1) {
      guilds[message.guild.id].skippers.push(message.author.id);
      guilds[message.guild.id].skipReq++;
      if (guilds[message.guild.id].skipReq >=
      Math.ceil((guilds[message.guild.id].voiceChannel.members.size - 1) / 2)) {
        skipMusic(message);
        message.reply('your skip request has been accepted. The current song will be skipped!');
      } else {
        message.reply('your skip request has been accepted. You need **' +
        (Math.ceil((guilds[message.guild.id].voiceChannel.members.size - 1) / 2) -
        guilds[message.guild.id].skipReq) + '** more skip request(s)!');
      }
    } else {
      message.reply('you already submitted a skip request.');
    }
  } else if (msg.startsWith(prefix + 'queue')) {
    var codeblock = '```';
    for (let i = 0; i < guilds[message.guild.id].queueNames.length; i++) {
      let temp = (i + 1) + '. ' + guilds[message.guild.id].queueNames[i] +
      (i === 0 ? ' **(Current Song)**' : '') + '\n';
      if ((codeblock + temp).length <= 2000 - 3) {
        codeblock += temp;
      } else {
        codeblock += '```';
        message.channel.send(codeblock);
        codeblock = '```';
      }
    }

    codeblock += '```';
    message.channel.send(codeblock);
  } else if (msg.startsWith(prefix + 'stop')) {
    if (guilds[message.guild.id].isPlaying === false) {
      message.reply('no music is playing!');
    }

    message.reply('stopping the music...');

    guilds[message.guild.id].queue = [];
    guilds[message.guild.id].queueNames = [];
    guilds[message.guild.id].isPlaying = false;
    guilds[message.guild.id].dispatcher.end();
    guilds[message.guild.id].voiceChannel.leave();
  }
});

function isYoutube(str) {
  return str.toLowerCase().indexOf('youtube.com') > -1;
}

function searchVideo(query, callback) {
  request('https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=' +
  encodeURIComponent(query) + '&key=' + youtubeAPIKey,
  function (error, response, body) {
    var json = JSON.parse(body);
    if (!json.items[0]) {
      callback('5FjWe31S_0g');
    } else {
      callback(json.items[0].id.videoId);
    }
  });
}

function getID(str, callback) {
  if (isYoutube(str)) {
    callback(getYoutubeID(str));
  } else {
    searchVideo(str, function (id) {
      callback(id);
    });
  }
}

function addToQueue(strID, message) {
  if (isYoutube(strID)) {
    guilds[message.guild.id].queue.push(getYoutubeID(strID));
  } else {
    guilds[message.guild.id].queue.push(strID);
  }
}

function playMusic(id, message) {
  guilds[message.guild.id].voiceChannel = message.member.voiceChannel;

  guilds[message.guild.id].voiceChannel.join().then(function (connection) {
    stream = ytdl('https://www.youtube.com/watch?v=' + id, {
      filter: 'audioonly',
    });
    guilds[message.guild.id].skipReq = 0;
    guilds[message.guild.id].skippers = [];

    guilds[message.guild.id].dispatcher = connection.playStream(stream);
    guilds[message.guild.id].dispatcher.on('end', function () {
      guilds[message.guild.id].skipReq = 0;
      guilds[message.guild.id].skippers = [];
      guilds[message.guild.id].queue.shift();
      guilds[message.guild.id].queueNames.shift();
      if (guilds[message.guild.id].queue.length === 0) {
        guilds[message.guild.id].queue = [];
        guilds[message.guild.id].queueNames = [];
        guilds[message.guild.id].isPlaying = false;
      } else {
        setTimeout(function () {
          playMusic(guilds[message.guild.id].queue[0], message);
        }, 500);
      }
    });
  });
}

function skipMusic(message) {
  guilds[message.guild.id].dispatcher.end();
}

client.login(botToken);
