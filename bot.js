const Discord = require('discord.js');
const client = new Discord.Client();
const ytdl = require('ytdl-core');
const request = require('request');
const fs = require('fs');
require('dotenv').config();

let config = require('./settings.json');

const botToken = process.env.BOT_TOKEN;
const youtubeAPIKey = process.env.YOUTUBE_API_KEY;
const botMaster = process.env.BOT_MASTER;
const prefix = config.prefix;
const role = config.role;

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
      playedTracks: []
    };
  }

  if (message.author.equals(client.user) || message.author.bot) return;

  if (msg.startsWith(prefix + 'play')) {
    if (member.voice.channel || guilds[message.guild.id].voiceChannel != null) {
      if (guilds[message.guild.id].queue.length > 0 || guilds[message.guild.id].isPlaying) {
        getID(args, function (id) {
          addToQueue(id, message);
          getVideoInfo(id, function (videoInfo) {
            guilds[message.guild.id].queueNames.push(videoInfo.videoDetails.title);
            addToPlayedTracks(message, videoInfo, message.author);
            message.reply('the song: **' + videoInfo.videoDetails.title + '** has been added to the queue.');
          });
        });
      } else {
        guilds[message.guild.id].isPlaying = true;
        getID(args, function (id) {
          guilds[message.guild.id].queue.push(id);
          playMusic(id, message);
          getVideoInfo(id, function (videoInfo) {
            guilds[message.guild.id].queueNames.push(videoInfo.videoDetails.title);
            addToPlayedTracks(message, videoInfo, message.author);
            message.reply('the song: **' + videoInfo.videoDetails.title + '** is now playing!');
          });
        });
      }
    } else if (member.voice.channel === false) {
      message.reply('you have to be in a voice channel to play music!');
    } else {
      message.reply('you have to be in a voice channel to play music!');
    }
  } else if (msg.startsWith(prefix + 'skip')) {
    if (guilds[message.guild.id].skippers.indexOf(message.author.id) === -1) {
      guilds[message.guild.id].skippers.push(message.author.id);
      guilds[message.guild.id].skipReq++;
      if (guilds[message.guild.id].skipReq >=
      Math.ceil((guilds[message.guild.id].voiceChannel.members.size - 1) / 2) || message.guild.member(message.author.id).roles.cache.find(roles => roles.name === role)) {
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
      return;
    }

    if (message.guild.member(message.author.id).roles.cache.find(roles => roles.name === role)) {
      message.reply('stopping the music...');

      guilds[message.guild.id].queue = [];
      guilds[message.guild.id].queueNames = [];
      guilds[message.guild.id].isPlaying = false;
      guilds[message.guild.id].dispatcher.end();
      guilds[message.guild.id].voiceChannel.leave();
    } else {
      message.reply("nice try, but only " + role + "s can stop me!");
    }

  } else if (msg.startsWith(prefix + 'history')){
    let defaultTrackCount = 30;
    argArr = args.split(' ');
    let includeUsers = argArr.some(val => val != null && val.toLowerCase().indexOf('user') >= 0);
    let includeTimes = argArr.some(val => val != null && val.toLowerCase().indexOf('time') >= 0);
    let historyTxt = getPlayedTracksText(message, tryParseInt(args, defaultTrackCount), includeUsers, includeTimes);
    let historyMsgs = splitTextByLines(historyTxt);
    for (let i = 0; i < historyMsgs.length; i++){
      message.reply(historyMsgs[i]);
    }
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
    callback(ytdl.getURLVideoID(str));
  } else {
    searchVideo(str, function (id) {
      callback(id);
    });
  }
}

async function getVideoInfo(id, callback) {
  callback(await ytdl.getInfo(id));
}

function addToQueue(strID, message) {
  if (isYoutube(strID)) {
    guilds[message.guild.id].queue.push(ytdl.getURLVideoID(strID));
  } else {
    guilds[message.guild.id].queue.push(strID);
  }
}

function playMusic(id, message) {
  guilds[message.guild.id].voiceChannel = message.member.voice.channel;

  guilds[message.guild.id].voiceChannel.join().then(function (connection) {
    stream = ytdl('https://www.youtube.com/watch?v=' + id, {
      filter: 'audioonly',
      dlChunkSize: 0
    });
    guilds[message.guild.id].skipReq = 0;
    guilds[message.guild.id].skippers = [];

    guilds[message.guild.id].dispatcher = connection.play(stream);
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

function addToPlayedTracks(message, videoInfo, user){
  let trackInfo = {
    title: videoInfo.videoDetails.title, 
    url: videoInfo.videoDetails.video_url, 
    dateVal: Date.now(), 
    username: user.username
  };
  guilds[message.guild.id].playedTracks.push(trackInfo);
  if (guilds[message.guild.id].playedTracks.length > 100){
    guilds[message.guild.id].playedTracks.shift();
  }
}

function getPlayedTracksText(message, trackCount, includeUsers, includeTimes){
  const playedTracks = guilds[message.guild.id].playedTracks;
  if (trackCount == undefined){
    trackCount = playedTracks.length;
  }
  const startIndex = trackCount >= playedTracks.length ? 0 : playedTracks.length - trackCount;
  let tracksText = '';
  for (let i = startIndex; i < playedTracks.length; i++){
    const trackNum = i - startIndex + 1;
    tracksText += `${trackNum}: ${playedTracks[i].title} (<${playedTracks[i].url}>)${(includeUsers ? ' by ' + playedTracks[i].username : '')}${(includeTimes ? ' at ' + formatDate(playedTracks[i].dateVal) : '')}\n`;
  }
  return tracksText.trim();
}

function splitTextByLines(text, maxCharsPerText){
  if (text == undefined || text.length == 0){
    return [];
  }
  if (maxCharsPerText == undefined){
    maxCharsPerText = 2000;
  }
  const lines = text.split('\n');
  let messages = [''];
  let charCount = 0;
  let messageIndex = 0;
  for (let i = 0; i < lines.length; i++){
    const line = lines[i] + '\n';
    charCount += line.length;
    if (charCount <= maxCharsPerText){
      messages[messageIndex] += line;
    } else {
      let lineTextRemaining = line;
      while (charCount > maxCharsPerText){
        let currentLineText = lineTextRemaining.substr(0, maxCharsPerText);
        messages.push(currentLineText);
        messageIndex++;
        charCount -= maxCharsPerText;
        if (charCount > 0){
          let startSplitIndex = maxCharsPerText <= lineTextRemaining.length ? maxCharsPerText : lineTextRemaining.length - 1;
          lineTextRemaining = lineTextRemaining.substring(startSplitIndex, lineTextRemaining.length);
        } else {
          charCount = 0
        }
      }
    }
  }
  for (let i = 0; i < messages.length; i++){
    messages[i] = messages[i].trim();
  }
  return messages;
}

function tryParseInt(arg, defaultVal){
  if (defaultVal == undefined){
    defaultVal = 0;
  }
  try {
    let argNum = parseInt(arg);
    if (!isNaN(argNum)){
      return argNum;
    }
    return defaultVal;
  } catch (parseException){
    return defaultVal;
  }
}

//YYYY-MM-DD hh:mm:ss UTC
function formatDate(dateValue){
  const date = new Date(dateValue);
  return `${date.getUTCFullYear()}-${padTo2DigitInt(date.getUTCMonth() + 1)}-${padTo2DigitInt(date.getUTCDate())} ${padTo2DigitInt(date.getUTCHours())}:${padTo2DigitInt(date.getUTCMinutes())}:${padTo2DigitInt(date.getUTCSeconds())} UTC`;
}

function padTo2DigitInt(intValue){
  return intValue > 9 ? '' + intValue: '0' + intValue;
}

client.login(botToken);
