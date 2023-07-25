const { EventFactory, Types } = require('@ellementul/united-events-environment')
const type = Types.Object.Def({
  system: "World",
  entity: "Tiles",
  action: "Load"
}, true) 
module.exports = EventFactory(type)