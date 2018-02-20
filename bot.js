const Discord = require('discord.js')
const client = new Discord.Client()
const ytdl = require('ytdl-core')
const request = require('request')
// const fs = require('fs')
const getYoutubeID = require('get-youtube-id')
const youtubeInfo = require('youtube-info')
const dotenv = require('dotenv')
dotenv.load()

let config = require('./settings.json')

const botToken = process.env.BOT_TOKEN
const youtubeAPIKey = process.env.YOUTUBE_API_KEY
// const botMaster = process.env.BOT_MASTER
const prefix = config.prefix
const callBackString = '5FjWe31S_0g'
let guilds = {}

client.on('ready', function () {
  console.log(`Logged in as ${client.user.username}#${client.user.discriminator}`)
  let clientUser = client.user
  clientUser.setActivity('too quiet in here')
})

client.on('message', function (message) {
  const member = message.member
  const msg = message.content.toLowerCase()
  const args = message.content.split(' ').slice(1).join(' ')

  if (!guilds[message.guild.id]) {
    guilds[message.guild.id] = {
      queue: [],
      queueNames: [],
      isPlaying: false,
      dispatcher: null,
      voiceChannel: null,
      skipReq: 0,
      skippers: []
    }
  }

  if (message.author.equals(client.user) || message.author.bot) return

  if (msg.startsWith(prefix + 'play')) {
    playSong(member, message, args)
  } else if (msg.startsWith(prefix + 'skip')) {
    skipSong(message)
  } else if (msg.startsWith(prefix + 'queue')) {
    showQueue(message)
  } else if (msg.startsWith(prefix + 'stop')) {
    stopAllSongs(message)
  } else if (msg.startsWith(prefix + 'dequeue')) {
    dequeue(message, args)
  }
})

function playSong (member, message, args) {
  client.user.setActivity('Aw yeah, MuSaK!')
  if (member.voiceChannel || guilds[message.guild.id].voiceChannel != null) {
    if (guilds[message.guild.id].queue.length > 0 || guilds[message.guild.id].isPlaying) {
      getID(args, function (id) {
        addToQueue(id, message)
        youtubeInfo(id, function (err, videoInfo) {
          if (err) {
            throw new Error(err)
          }
          guilds[message.guild.id].queueNames.push(videoInfo.title)
          message.reply('the song: **' + videoInfo.title + '** has been added to the queue.')
        })
      })
    } else {
      guilds[message.guild.id].isPlaying = true
      getID(args, function (id) {
        guilds[message.guild.id].queue.push(id)
        playMusic(id, message)
        youtubeInfo(id, function (err, videoInfo) {
          if (err) {
            throw new Error(err)
          }
          guilds[message.guild.id].queueNames.push(videoInfo.title)
          message.reply('the song: **' + videoInfo.title + '** is now playing!')
        })
      })
    }
  } else if (member.voiceChannel === false) {
    message.reply('you have to be in a voice channel to play music!')
  } else {
    message.reply('you have to be in a voice channel to play music!')
  }
}

function skipSong (message) {
  if (guilds[message.guild.id].skippers.indexOf(message.author.id) === -1) {
    guilds[message.guild.id].skippers.push(message.author.id)
    guilds[message.guild.id].skipReq++
    if (guilds[message.guild.id].skipReq >= Math.ceil((guilds[message.guild.id].voiceChannel.members.size - 1) / 2) ||
        message.author.roles.find('name', 'DJ')) { // "DJ" role can skip without votes.
      skipMusic(message)
      message.reply('your skip request has been accepted. The current song will be skipped!')
    } else {
      message.reply('your skip request has been accepted. You need **' + (Math.ceil((guilds[message.guild.id].voiceChannel.members.size - 1) / 2) - guilds[message.guild.id].skipReq) + '** more skip request(s)!')
    }
  } else {
    message.reply('you already submitted a skip request.')
  }
}

function showQueue (message) {
  if (guilds[message.guild.id].queue.length === 0) {
    message.channel.send('```There are no more songs in the queue. !play to add a song.```')
    return
  }
  let codeBlock = '```'
  for (let i = 0; i < guilds[message.guild.id].queueNames.length; i++) {
    let temp = (i + 1) + '. ' + guilds[message.guild.id].queueNames[i] + (i === 0 ? ' **(Current Song)**' : '') + '\n'
    if ((codeBlock + temp).length <= 2000 - 3) {
      codeBlock += temp
    } else {
      codeBlock += '```'
      message.channel.send(codeBlock)
      codeBlock = '```'
    }
  }

  codeBlock += '```'
  message.channel.send(codeBlock)
}

function stopAllSongs (message) {
  if (guilds[message.guild.id].isPlaying === false || guilds[message.guild.id].dispatcher === null) {
    message.reply('leaving the channel bye bye...')
  }
  else{
  client.user.setActivity('too quiet in here...')
  message.reply('stopping the music...')
  }
  guilds[message.guild.id].queue = []
  guilds[message.guild.id].queueNames = []
  guilds[message.guild.id].isPlaying = false
  guilds[message.guild.id].dispatcher.end()
  guilds[message.guild.id].voiceChannel.leave()
}

function dequeue (message, args) {
  // here we will dequeueeueueueue a song.
  showQueue(message)
  args = args.split(' ').map(Number) // split args
  args.sort((a, b) => { return b - a })
  if (!validateIndexes(args, guilds[message.guild.id].queue.length)) {
    message.reply('In order to remove a song from the queue, please, give a valid song number from the !queue list. !dequeue [number]')
    return
  }
  let returnMessage = ''
  for (var i = 0; i < args.length; i++) {
    let index = parseInt(args[i])
    if (index === 0) {
      index = 1
    }
    returnMessage += 'Removed song at index: ' + index + ' ' + guilds[message.guild.id].queueNames[index - 1] + '\n'
    if (index === 1) {
      skipMusic(message)
    } else {
      guilds[message.guild.id].queue.splice(index - 1, 1)
      guilds[message.guild.id].queueNames.splice(index - 1, 1)
    }
  }
  message.reply(returnMessage)
  showQueue(message)
}

// if indexes contain any non-numeric symbol, this function will return false
function validateIndexes (indexes, queueLength) {
  for (var i = 0; i < indexes.length; i++) {
    if (isNaN(indexes[i])) return false
    if (indexes[i] < 0 || indexes[i] > queueLength) return false
    if (indexes[i] === 0 && queueLength === 0) return false
  }
  return true
}

function isYoutube (str) {
  return str.toLowerCase().indexOf('youtube.com') > -1
}

function searchVideo (query, callback) {
  request('https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=' + encodeURIComponent(query) + '&key=' + youtubeAPIKey, function (error, response, body) {
    let json = JSON.parse(body)
    if (!json.items[0]) {
      callback(callBackString)
    } else {
      callback(json.items[0].id.videoId)
    }
  })
}

function getID (str, callback) {
  if (isYoutube(str)) {
    callback(getYoutubeID(str))
  } else {
    searchVideo(str, function (id) {
      callback(id)
    })
  }
}

function addToQueue (strID, message) {
  if (isYoutube(strID)) {
    guilds[message.guild.id].queue.push(getYoutubeID(strID))
  } else {
    guilds[message.guild.id].queue.push(strID)
  }
}

function playMusic (id, message) {
  guilds[message.guild.id].voiceChannel = message.member.voiceChannel

  guilds[message.guild.id].voiceChannel.join().then(function (connection) {
    let stream = ytdl('https://www.youtube.com/watch?v=' + id, {
      filter: 'audioonly'
    })
    guilds[message.guild.id].skipReq = 0
    guilds[message.guild.id].skippers = []

    guilds[message.guild.id].dispatcher = connection.playStream(stream)
    guilds[message.guild.id].dispatcher.on('end', function () {
      guilds[message.guild.id].skipReq = 0
      guilds[message.guild.id].skippers = []
      guilds[message.guild.id].queue.shift()
      guilds[message.guild.id].queueNames.shift()
      if (guilds[message.guild.id].queue.length === 0) {
        guilds[message.guild.id].queue = []
        guilds[message.guild.id].queueNames = []
        guilds[message.guild.id].isPlaying = false
      } else {
        setTimeout(function () {
          playMusic(guilds[message.guild.id].queue[0], message)
        }, 500)
      }
    })
  })
}

function skipMusic (message) {
  if (guilds[message.guild.id].isPlaying === false || guilds[message.guild.id].dispatcher === null) {
    return
  }
  guilds[message.guild.id].dispatcher.end()
}

client.login(botToken)
