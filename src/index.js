const { UnitedEventsEnvironment: UEE } = require('@ellementul/united-events-environment')
const { WsTransport } = require('@ellementul/uee-ws-browser-transport')
const { Logging } = require('./logging')

const { Ticker } = require('@ellementul/uee-timeticker')
const { GameSession } = require("./game-session")
const { PlayersManager } = require("./players-manager")
const { World } = require("./world")

const membersList = {
  roles: [
    {
      role: "Ticker",
      memberConstructor: Ticker
    },
    {
      role: "GameSession",
      memberConstructor: GameSession
    },
    {
      role: "PlayersManager",
      memberConstructor: PlayersManager
    },
    {
      role: "World",
      memberConstructor: World
    }
  ]
}

env = new UEE({
  Transport: WsTransport,
  membersList,
  logging: Logging(),
  isShowErrors: true
})


env.run({
  isHost: true,
  signalServerAddress: "ws://127.0.0.1:8080",
})