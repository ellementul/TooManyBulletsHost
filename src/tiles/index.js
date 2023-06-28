const { Member } = require('@ellementul/united-events-environment')

const loadTilesEvent = require("../events/load-tiles")
const addSpwanEvent = require("../events/add-spawn")
const physicUpdateEvent = require("../events/update-physic")
const updateEvent = require("../events/update-tiles")

class Tiles extends Member {
  constructor() {
    super()

    this.tiles = [null]// TODO: Make zero for errors
    this.tilesets = [null]// TODO: Make zero for errors
    this.map = {}
    this.onEvent(loadTilesEvent, payload => this.load(payload))
  }

  load({ state: tileMap }) {
    this.loadTiles(tileMap.tilesets)
    this.loadMap(tileMap)
    
    this.onEvent(physicUpdateEvent, payload => this.physicUpdated(payload))
  }

  physicUpdated(payload) {
    this.send(updateEvent, {
      state: this.serialize()
    })
  }

  loadTiles(tilesets) {
    tilesets.forEach(({
      tilesetUid,
      tileSize,
      size,
      texture
    }) => {
      const tileset = new Tileset({
        tilesetUid,
        tileSize,
        size,
        texture
      })
      this.tilesets[tileset.uid] = tileset
    });
  }

  loadMap(tileMap) {
    tileMap.layers.forEach(layer => {

      if(layer.name == "background")
        this.loadLayer(layer)

      if(layer.name == "walls")
        this.loadLayer(layer)
    });
  }

  loadLayer({
    name,
    tiles: tilesIds,
    tilesets: tilesetsIds,
    position,
    size: {
      height: rows,
      width: columns
    },
    tileSize: {
      height: tHeight,
      width: tWidth
    },
    spawns
  }) {
    if(tilesIds.length !== rows * columns)
      throw new TypeError("Inccorect number tiles in layer!")

    const tiles = this.getTilesFromTilesets(tilesetsIds)

    const spawnsIds = []
    if(Array.isArray(spawns)) {
      spawnsIds.push(...spawns.map(spawn => spawn.number))
    }
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const tileId = tilesIds[r*columns + c]

        if(tileId == 0)
          continue

        const tile = tiles[tileId].copy()

        if(spawnsIds.includes(tileId))
          tile.isSpawn = true

        tile.position = {
          offsetLayer: position,
          row: r,
          column: c
        }

        tile.size = {
          height: tile.tilesetRect.height / tHeight,
          width: tile.tilesetRect.width / tWidth,
        }

        if(tile.size.height * tile.size.width != 1)
          throw new TypeError("Right now tile has to be size 1x1!")


        this.setTileOnMap(tile, {
          name,
          size: {
            height: rows,
            width: columns
          },
          tileSize: {
            height: tHeight,
            width: tWidth
          },
        })
      }
    }
  }

  getTilesFromTilesets(tilesetsIds) {
    return tilesetsIds.reduce((tiles, tilesetId) => tiles.concat(this.tilesets[tilesetId].tiles), this.tiles)
  }

  setTileOnMap(tile, { name: layerName, size, tileSize }) {
    const { row, column } = tile.position
    if(!this.map[layerName])
      this.map[layerName] = {
        name: layerName,
        tiles: [],
        size,
        tileSize
      }

    const layer = this.map[layerName]

    if(!Array.isArray(layer.tiles[row]))
      layer.tiles[row] = []

    layer.tiles[row][column] = tile

    if(tile.isSpawn)
      this.send(addSpwanEvent, { state: {
        position: {
          x: (column * tileSize.width) + (tile.tilesetRect.width / 2),
          y: (row * tileSize.height) + (tile.tilesetRect.height / 2),
        }
      }})
  }

  serialize() {
    const tileMap = this.map
    const layers = {}

    for (const layerName in tileMap) {
      const layer = tileMap[layerName]

      const tiles = []
      layer.tiles.forEach(row => row.forEach(tile => {
        if(tile.isSpawn)
          return

        const { row, column, z } = tile.position
        const { height, width, x, y } = tile.tilesetRect
        tiles.push({
          texture: tile.tileset.texture,
          position: { row, column, z },
          frame: { height, width, x, y },
        })
      }))
      layers[layerName] = {
        name: layerName,
        tiles,
        size: layer.size,
        tileSize: layer.tileSize
      }
    }
    return { layers }
  }
}

  

class Tileset {
  constructor({
    tilesetUid,
    tileSize: {
      height: tHeight,
      width: tWidth
    },
    size: {
      height: rows,
      width: columns
    },
    texture
  }) {
    this.uid = tilesetUid
    this.tiles = []
    this.texture = texture

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        this.tiles.push(new Tile({ 
          tileset: this, 
          tilesetRect: {
            tHeight,
            tWidth,
            row: r,
            column: c
          }
        }))
      }
    }
  }
}

class Tile {
  constructor({ 
    tileset, 
    tilesetRect: {
      tHeight,
      tWidth,
      row,
      column
    }
  }) {
    this.tileset = tileset
    this.tilesetRect = {
      height: tHeight,
      width: tWidth,
      x: column * tWidth,
      y: row * tHeight,
    }
  }

  copy() {
    return {
      tileset: this.tileset,
      tilesetRect: {
        height: this.tilesetRect.height,
        width: this.tilesetRect.width,
        x: this.tilesetRect.x,
        y: this.tilesetRect.y,
      }
    }
  }
}

module.exports = { Tiles }