const { Types } = require('@ellementul/united-events-environment')
const genUuid = Types.UUID.Def().rand

const { Plan, PlanWithBorder }  = require('./plan')

const CHUNK_LIMIT = 64

class ChunksList extends Map {
  constructor(type, tileSize) {
    super()

    this.type = type
    this.tileSize = { ...tileSize }

    this.plan = type === "ground" ? new PlanWithBorder : new Plan

    this.current = new Chunk(this.plan)
    this.set(this.current.uuid, this.current)
  }

  get size() {
    let sum = 0
    for (const [_, chunk] of this) {
      sum += chunk.size
    }

    return sum
  }

  add(tile) {
    const chunk = this.getEmptyChunck()
    chunk.add(tile)
    this.plan.add(tile)

    return tile
  }

  delete(uuid, chunkUuid) {
    const chunk = this.get(chunkUuid)
    if(!chunk) return

    const tile = chunk.get(uuid)

    if(!tile) return

    chunk.delete(tile.uuid)
    return this.plan.delete(tile.position)
  }

  getAll() {
    const uuids = []
    for (const [_, chunk] of this) {
      uuids.push(...chunk.values())
    }

    return uuids
  }

  getTileByUuid(uuid) {
    for (const [_, chunk] of this) {
      if(chunk.has(uuid))
        return chunk.get(uuid)
    }
  }

  getEmptyChunck() {
    if(this.current.size < CHUNK_LIMIT)
      return this.current

    let emptyChunk = new Chunk(this.plan)
    for (const [uuid, chunk] of this) {
      if(chunk.size < emptyChunk.size || (emptyChunk.size === 0 && chunk.size < CHUNK_LIMIT))
        emptyChunk = chunk
    }

    this.current = emptyChunk

    if(emptyChunk.size === 0)
      this.set(emptyChunk.uuid, emptyChunk)

    return this.current
  }

  setFullUpdate() {
    for (const [_, chunk] of this) {
      chunk.changed = true
    }
  }

  isUpdate() {
    let changed = false
    for (const [uuid, chunk] of this)
      changed ||= chunk.changed

    return changed
  }

  toDrawLayers() {
    const layers = []
    for (const [uuid, chunk] of this) {
      if(chunk.changed)
        layers.push({
          uuid: uuid,
          type: this.type,
          tileSize: this.tileSize,
          tiles: chunk.toDrawTiles()
        })
    }

    return layers
  }
}

class Chunk extends Map {
  constructor(plan) {
    super()

    this.uuid = genUuid()
    this.plan = plan
    this.changed = false
  }

  add(tile) {
    tile.chunkUuid = this.uuid
    super.set(tile.uuid, tile)
    this.changed = true

    return tile
  }

  delete(uuid) {
    super.delete(uuid)
    this.changed = true
  }

  toDrawTiles() {
    const tiles = []
    for(const [uuid, tile] of this) {
      const { row, column } = tile.position
      const tileToDraw = {
        uuid: tile.uuid,
        texture: tile.texture,
        position: { row, column },
        frame: { ...tile.tilesetRect },
        isSpawn: tile.isSpawn
      }

      tiles.push(tileToDraw)
    }
    this.changed = false
    return tiles
  }
}

module.exports = { ChunksList }