const { Member, events: { time } } = require('@ellementul/united-events-environment')
const { System } = require("detect-collisions");

const loadEvent = require("../events/load-data")
const readyEvent = require("../events/ready-system")
// const runEvent = require("../events/run-world")
// const stopEvent = require("../events/stop-world")
const clearedEvent = require("../events/cleared-system")
const clearDataEvent = require("../events/clear-data")

const createDynamicObject = require("../events/objects/create-dynamic-object")
const updateDynamicObject = require("../events/objects/update-dynamic-object")
const removeDynamicObject = require("../events/objects/remove-dynamic-object")
const createWallsEvent = require("../events/objects/create-walls-object")
const removeWallsEvent = require("../events/objects/remove-walls-object")
const updateEvent = require("../events/objects/update-physic")
const overlapEvent = require("../events/objects/overlap-objects")
const outLimitObjectEvent = require("../events/objects/out-limit-world")

const INIT = Symbol()
const LOADING = Symbol()
const LOADED = Symbol()
const PAUSE = Symbol()
const RUNNING = Symbol()

class Physic extends Member {
  constructor() {
    super()

    this._state = INIT
    this.timer = new Timer

    this._dynamicObjects = new Map
    this._staticObjects = new Map

    this.groupsCollisions = new Collision
    this.collisionSystem = new System

    this.limit = 360*36
    
    this.onEvent(loadEvent, payload => this.load(payload))

    // this.onEvent(runEvent, () => this.run())
    // this.onEvent(stopEvent, () => this.stop())
    this.onEvent(clearDataEvent, () => this.clear())
    this.onEvent(createDynamicObject, payload => this.createDynamic(payload))
    this.onEvent(updateDynamicObject, payload => this.updateDynamic(payload))
    this.onEvent(removeDynamicObject, payload => this.removeDynamic(payload))
    this.onEvent(createWallsEvent, payload => this.createWall(payload))
    this.onEvent(removeWallsEvent, payload => this.deleteWall(payload))
    this.onEvent(time, () => this.step())
  }

  load({ resources: { physic } }) {
    if(this._state != INIT) return
    this._state = LOADING

    this.limitsRect = physic.limitsRect

    this._state = LOADED
    this.stop()
    this.send(readyEvent, { state: { system: "Physic" }})
    this.run()
  }

  run() {
    if(this._state != PAUSE) return
    this._state = RUNNING
    this.timer.run()
  }

  stop() {
    if(this._state != LOADED && this._state != RUNNING) return
    this._state = PAUSE
  }

  createDynamic({ state: newObject }) {
    if(newObject.shape === "Box")
      this.createDynamicBox(newObject)
    
  }

  createDynamicBox({ uuid, position, pivot, box: { width, height }, velocity, groupCollision }) {
    const options = { isStatic: false }
    const box = this.collisionSystem.createBox(position, width, height, options)
    box.uuid = uuid
    box.velocity = velocity
    box.groupCollision = groupCollision
    box.pivot = pivot || { x: width / 2, y: height / 2 }
    
    this._dynamicObjects.set(uuid, box)
  }

  updateDynamic({ state: object }) {
    const physicObject = this._dynamicObjects.get(object.uuid)
    physicObject.velocity = {
      x: object.velocity.x,
      y: object.velocity.y
    }
    physicObject.isOut = false
  }

  removeDynamic({ state: uuid }) {
    if(this._dynamicObjects.has(uuid)) {
      this.collisionSystem.remove(this._dynamicObjects.get(uuid))
      this._dynamicObjects.delete(uuid)
    }
  }

  createWall({ state: {
    uuid,
    position: { row, column },
    tileSize,
    half
  }}) {
    const position = {
      x: column * tileSize.width,
      y: row * tileSize.height,
    }
    if(half === "right")
      position.x += tileSize.width * 0.5

    const width = half ? tileSize.width * 0.5 : tileSize.width
    const height = tileSize.height
    const options = { isStatic: true }

    const wall = this.collisionSystem.createBox(position, width, height, options)
    wall.uuid = uuid
    wall.groupCollision = WALLS

    this._staticObjects.set(uuid, wall)
  }

  deleteWall({ state: uuid }) {
    if(this._staticObjects.has(uuid)) {
      this.collisionSystem.remove(this._staticObjects.get(uuid))
      this._staticObjects.delete(uuid)
    }
  }

  clear() {
    for (const [uuid, _] of this._dynamicObjects) {
      this.removeDynamic({ state: uuid })
    }

    for (const [uuid, _] of this._staticObjects) {
      this.deleteWall({ state: uuid })
    }

    this._state = INIT
    this.send(clearedEvent, { state: { system: "Physic" }})
  }

  step() {
    if(this._state != RUNNING) return
    this.timer.step()

    this.updatePositions()
    this.checkCollisions()
    this.sendUpdated()
  }

  checkCollisions() {
    this.collisionSystem.checkAll(({ a, b, overlapV }) => {
      if(this.groupsCollisions.isRebound(a.groupCollision, b.groupCollision))
        this.resolveCollision({ a, b, overlapV })

      if(this.groupsCollisions.isTrigger(a.groupCollision, b.groupCollision))
        this.send(overlapEvent, { state: [a.uuid, b.uuid] })
    })
  }

  resolveCollision({ a, b, overlapV }) {
    if(!a.isStatic)
      a.setPosition(
        a.x - overlapV.x,
        a.y - overlapV.y
      )
  }

  sendUpdated() {
    const objectsPositions = {}

    for (const [uuid, object] of this._dynamicObjects) {
      objectsPositions[uuid] = {
        x: object.x,
        y: object.y,
        pivot: { ...object.pivot },
        vx: object.velocity.x,
        vy: object.velocity.y
      }
    }

    this.send(updateEvent, { state: objectsPositions })
  }

  updatePositions() {
    for (const [uuid, object] of this._dynamicObjects) {
      if(object.isOut) continue

      this.updatePosition(object)
      const { x , y } = object

      if(this.checkLimitOfPosition({ x , y })) {
        object.isOut = true
        this.send(outLimitObjectEvent, { state: uuid })
      }
    }
  }

  checkLimitOfPosition({ x , y }) {
    if(x < this.limitsRect.x || x > this.limitsRect.width)
      return true

    if(y < this.limitsRect.y || y > this.limitsRect.height)
      return true

    return false
  }

  updatePosition(object) {
    object.setPosition(
      object.x + object.velocity.x * this.timer.delta,
      object.y + object.velocity.y * this.timer.delta
    )
  }
}

const NONE = "None"
const TRRIGER = "Overlap"
const REBOUND = "Rebound"

const WALLS = "Walls"
const CHARACTERS = "Characters"
const BULLETS = "Bullets"

class Collision {
  constructor() {
    const walls = new Map([
      [WALLS, TRRIGER],
      [CHARACTERS, REBOUND],
      [BULLETS, TRRIGER]
    ])
    const characters = new Map([
      [WALLS, REBOUND],
      [CHARACTERS, NONE],
      [BULLETS, TRRIGER]
    ])
    const bullets = new Map([
      [WALLS, TRRIGER],
      [CHARACTERS, TRRIGER],
      [BULLETS, NONE]
    ]) 

    this._collisionsTypes = new Map([
      [WALLS, walls],
      [CHARACTERS, characters],
      [BULLETS, bullets]
    ]) 
  }

  isTrigger(typeA, typeB) {
    return this._collisionsTypes.get(typeA).get(typeB) === TRRIGER
  }

  isRebound(typeA, typeB) {
    return this._collisionsTypes.get(typeA).get(typeB) === REBOUND
  }
}

class Timer {
  constructor() {
    this._time = null
    this._delta = 0
  }
  
  run() {
    this._time = Date.now()
    this._delta = 0
  }

  step () {
    const newTime = Date.now()
    this._delta = newTime - this._time
    this._time = newTime
  }

  get delta () {
    return this._delta / 1000
  }
}

module.exports = { Physic }