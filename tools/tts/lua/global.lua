-- The Quiet Vale: Seasons of Settlement (v7.0) — Enhanced Helper Global Script
-- Provides:
--   1. 1-5 Player Setup buttons (starting Warehouse 15/10/8/0/0, exact v7.0 Encounter split,
--      Target Deck shuffle, Quest Card draw, Round 1 placement, Actions/Turn announcement)
--   2. End-of-Round Cleanup button (clears X cooldown tokens from Map Board, advances Round
--      & announces Season II/III/Final Scoring, rotates Player 1 marker)
--   3. Special Tile #1-#26 Unlock Helper (pulls exact numbered Special Tile onto Tiles Board)

local CONFIG = __QV_TTS_CONFIG__

state = {
  playerCount = 2,
  round = 1,
  firstPlayerIdx = 1,
  unlockNum = 1
}

local SETUP_RULES = {
  [1] = { actions = 4, warehouse = 15, boons = 5,  burdens = 3,  arrivals = 4  },
  [2] = { actions = 4, warehouse = 10, boons = 8,  burdens = 8,  arrivals = 8  },
  [3] = { actions = 3, warehouse = 8,  boons = 12, burdens = 12, arrivals = 12 },
  [4] = { actions = 3, warehouse = 0,  boons = 16, burdens = 16, arrivals = 16 },
  [5] = { actions = 2, warehouse = 0,  boons = 26, burdens = 14, arrivals = 20 },
}

function onLoad(saved_data)
  if saved_data and saved_data ~= "" then
    local ok, decoded = pcall(JSON.decode, saved_data)
    if ok and type(decoded) == "table" then
      state.playerCount = decoded.playerCount or state.playerCount
      state.round = decoded.round or state.round
      state.firstPlayerIdx = decoded.firstPlayerIdx or state.firstPlayerIdx
      state.unlockNum = decoded.unlockNum or state.unlockNum
    end
  end
  Wait.frames(function()
    buildControlPlaqueUI()
    buildUnlockPlaqueUI()
  end, 5)
end

function onSave()
  return JSON.encode(state)
end

-- ---------------------------------------------------------------------------
-- Control Plaque UI (Setup 1-5P + End Round)
-- ---------------------------------------------------------------------------
function buildControlPlaqueUI()
  local plaque = getObjectFromGUID(CONFIG.guids.controlPlaque)
  if not plaque then return end
  plaque.clearButtons()

  plaque.createButton({
    click_function = "noop",
    function_owner = Global,
    label = "THE QUIET VALE v7.0\nSETUP BY PLAYER COUNT",
    position = {0, 0.25, -0.74},
    width = 0,
    height = 0,
    font_size = 110,
    font_color = {0.92, 0.78, 0.44}
  })

  for p = 1, 5 do
    local x = -0.84 + (p - 1) * 0.42
    local fnName = "setupPlayers_" .. tostring(p)
    _G[fnName] = function() runSetup(p) end
    plaque.createButton({
      click_function = fnName,
      function_owner = Global,
      label = tostring(p) .. "P",
      position = {x, 0.25, -0.32},
      width = 185,
      height = 180,
      font_size = 115,
      color = (state.playerCount == p) and {0.68, 0.52, 0.22} or {0.22, 0.20, 0.18},
      font_color = {0.98, 0.94, 0.84},
      tooltip = "Setup " .. tostring(p) .. "-Player Game (Actions: " .. tostring(SETUP_RULES[p].actions) .. ", Warehouse: " .. tostring(SETUP_RULES[p].warehouse) .. ")"
    })
  end

  plaque.createButton({
    click_function = "onEndRound",
    function_owner = Global,
    label = "END ROUND " .. tostring(state.round) .. " -> NEXT",
    position = {0, 0.25, 0.22},
    width = 960,
    height = 200,
    font_size = 92,
    color = {0.26, 0.42, 0.30},
    font_color = {0.96, 0.94, 0.88},
    tooltip = "Clear X tokens from Map, advance Round Marker, and rotate Player 1 marker."
  })

  plaque.createButton({
    click_function = "onRotateP1",
    function_owner = Global,
    label = "ROTATE PLAYER 1 MARKER",
    position = {0, 0.25, 0.64},
    width = 960,
    height = 150,
    font_size = 76,
    color = {0.30, 0.26, 0.22},
    font_color = {0.92, 0.84, 0.66},
    tooltip = "Move Player 1 marker to the next player seat."
  })
end

function noop() end

-- ---------------------------------------------------------------------------
-- 1-5P Setup Automation
-- ---------------------------------------------------------------------------
function runSetup(playerCount)
  local rules = SETUP_RULES[playerCount]
  if not rules then return end
  state.playerCount = playerCount
  state.round = 1
  state.firstPlayerIdx = 1

  -- 1. Set all 6 Warehouse counters
  for _, guid in ipairs(CONFIG.guids.warehouseCounters) do
    local c = getObjectFromGUID(guid)
    if c then
      c.call("setValue", rules.warehouse)
    end
  end

  -- 2. Shuffle Target Deck
  local targetDeck = getObjectFromGUID(CONFIG.guids.targetDeck)
  if targetDeck then
    targetDeck.shuffle()
  end

  -- 3. Shuffle Quest Deck and deal 1 Quest Card face up onto the Tiles Board
  local questDeck = getObjectFromGUID(CONFIG.guids.questDeck)
  if questDeck then
    questDeck.shuffle()
    questDeck.takeObject({
      position = CONFIG.positions.activeQuest,
      rotation = {0, 180, 0},
      smooth = true
    })
  end

  -- 4. Build the exact v7.0 Encounter Deck from Boons, Burdens, and Arrivals
  local drawPos = CONFIG.positions.encounterDraw
  local pulled = {}
  local function takeCards(deckGuid, count)
    local deck = getObjectFromGUID(deckGuid)
    if not deck then return end
    deck.shuffle()
    for i = 1, count do
      if deck.getQuantity() > 1 then
        local card = deck.takeObject({
          position = {drawPos[1], drawPos[2] + 0.3 + (#pulled * 0.04), drawPos[3]},
          rotation = {0, 180, 180},
          smooth = false
        })
        if card then table.insert(pulled, card) end
      elseif deck.getQuantity() == 1 then
        deck.setPosition({drawPos[1], drawPos[2] + 0.3 + (#pulled * 0.04), drawPos[3]})
        deck.setRotation({0, 180, 180})
        table.insert(pulled, deck)
        break
      end
    end
  end

  takeCards(CONFIG.guids.boonsDeck, rules.boons)
  takeCards(CONFIG.guids.burdensDeck, rules.burdens)
  takeCards(CONFIG.guids.arrivalsDeck, rules.arrivals)

  Wait.time(function()
    -- Find newly formed deck at Encounter Draw well and shuffle it
    local hits = Physics.cast({
      origin = {drawPos[1], drawPos[2] + 4, drawPos[3]},
      direction = {0, -1, 0},
      type = 3,
      size = {2.2, 4, 3.2},
      max_distance = 6
    })
    for _, hit in ipairs(hits) do
      if hit.hit_object and hit.hit_object.tag == "Deck" then
        hit.hit_object.setName("Encounter Deck (" .. tostring(playerCount) .. "P)")
        hit.hit_object.shuffle()
        break
      end
    end
  end, 0.9)

  -- 5. Place Round Marker on Round 1 & Player 1 Marker at Seat 1
  moveRoundMarker(1)
  movePlayer1Marker(1)

  buildControlPlaqueUI()
  broadcastToAll(
    string.format(
      "Setup complete for %dP! Actions/turn: %d | Starting Warehouse: %d each | Encounters: %d Boons, %d Burdens, %d Arrivals.",
      playerCount, rules.actions, rules.warehouse, rules.boons, rules.burdens, rules.arrivals
    ),
    {0.94, 0.84, 0.56}
  )
end

-- ---------------------------------------------------------------------------
-- End-of-Round Cleanup, Round Marker & Player 1 Rotation
-- ---------------------------------------------------------------------------
function moveRoundMarker(roundNum)
  local marker = getObjectFromGUID(CONFIG.guids.roundMarker)
  local pos = CONFIG.positions.roundSockets[roundNum]
  if marker and pos then
    marker.setPositionSmooth({pos[1], pos[2] + 0.25, pos[3]}, false, true)
    marker.setRotationSmooth({0, 180, 0}, false, true)
  end
end

function movePlayer1Marker(seatIdx)
  local marker = getObjectFromGUID(CONFIG.guids.player1Marker)
  local pos = CONFIG.positions.seatMarkers[seatIdx]
  if marker and pos then
    marker.setPositionSmooth({pos[1], pos[2] + 0.3, pos[3]}, false, true)
    marker.setRotationSmooth({0, 180, 0}, false, true)
  end
end

function onRotateP1()
  state.firstPlayerIdx = (state.firstPlayerIdx % state.playerCount) + 1
  movePlayer1Marker(state.firstPlayerIdx)
  broadcastToAll("Player 1 marker rotated to Seat " .. tostring(state.firstPlayerIdx) .. ".", {0.92, 0.84, 0.62})
end

function onEndRound()
  -- 1. Sweep all X Cooldown tokens off the Map Board
  local bounds = CONFIG.mapBounds
  local cleared = 0
  for _, obj in ipairs(getAllObjects()) do
    if obj.getName() == "Cooldown X" and not obj.getLock() then
      local p = obj.getPosition()
      if p.x >= bounds.minX and p.x <= bounds.maxX and p.z >= bounds.minZ and p.z <= bounds.maxZ then
        obj.destruct()
        cleared = cleared + 1
      end
    end
  end

  -- 2. Advance Round & rotate Player 1 marker
  if state.round < 12 then
    state.round = state.round + 1
    moveRoundMarker(state.round)
    state.firstPlayerIdx = (state.firstPlayerIdx % state.playerCount) + 1
    movePlayer1Marker(state.firstPlayerIdx)
    buildControlPlaqueUI()

    local seasonMsg = ""
    if state.round == 5 then
      seasonMsg = " — SEASON II BEGINS! Refresh Steward powers."
    elseif state.round == 9 then
      seasonMsg = " — SEASON III BEGINS! Refresh Steward powers."
    end
    broadcastToAll(
      string.format("Round %d begins (cleared %d X tokens, Player 1 -> Seat %d)%s",
        state.round, cleared, state.firstPlayerIdx, seasonMsg),
      {0.84, 0.94, 0.78}
    )
  else
    broadcastToAll(
      string.format("Round 12 complete (cleared %d X tokens)! Proceed to Final Scoring.", cleared),
      {0.98, 0.84, 0.44}
    )
  end
end

-- ---------------------------------------------------------------------------
-- Special Tile #1-#26 Unlock Helper Plaque
-- ---------------------------------------------------------------------------
function buildUnlockPlaqueUI()
  local plaque = getObjectFromGUID(CONFIG.guids.unlockPlaque)
  if not plaque then return end
  plaque.clearButtons()

  plaque.createButton({
    click_function = "noop",
    function_owner = Global,
    label = "UNLOCK SPECIAL TILE",
    position = {0, 0.25, -0.58},
    width = 0,
    height = 0,
    font_size = 105,
    font_color = {0.92, 0.78, 0.44}
  })

  plaque.createButton({
    click_function = "onUnlockPrev",
    function_owner = Global,
    label = "<",
    position = {-0.62, 0.25, -0.05},
    width = 200,
    height = 200,
    font_size = 150,
    color = {0.24, 0.22, 0.20},
    font_color = {0.95, 0.90, 0.80}
  })

  plaque.createButton({
    click_function = "noop",
    function_owner = Global,
    label = "#" .. tostring(state.unlockNum),
    position = {0, 0.25, -0.05},
    width = 360,
    height = 200,
    font_size = 150,
    color = {0.14, 0.12, 0.10},
    font_color = {0.96, 0.88, 0.64}
  })

  plaque.createButton({
    click_function = "onUnlockNext",
    function_owner = Global,
    label = ">",
    position = {0.62, 0.25, -0.05},
    width = 200,
    height = 200,
    font_size = 150,
    color = {0.24, 0.22, 0.20},
    font_color = {0.95, 0.90, 0.80}
  })

  plaque.createButton({
    click_function = "onUnlockTile",
    function_owner = Global,
    label = "UNLOCK #" .. tostring(state.unlockNum),
    position = {0, 0.25, 0.52},
    width = 860,
    height = 190,
    font_size = 100,
    color = {0.58, 0.44, 0.18},
    font_color = {0.98, 0.95, 0.86},
    tooltip = "Pull Special Tile #" .. tostring(state.unlockNum) .. " from the reserve bag onto the Tiles Board (0 Actions to place)."
  })
end

function onUnlockPrev(_, _, alt)
  local step = alt and 5 or 1
  state.unlockNum = ((state.unlockNum - 1 - step) % 26) + 1
  buildUnlockPlaqueUI()
end

function onUnlockNext(_, _, alt)
  local step = alt and 5 or 1
  state.unlockNum = ((state.unlockNum - 1 + step) % 26) + 1
  buildUnlockPlaqueUI()
end

function onUnlockTile()
  local bag = getObjectFromGUID(CONFIG.guids.specialBag)
  if not bag then
    broadcastToAll("Special Tiles reserve bag not found.", {0.95, 0.45, 0.45})
    return
  end
  local prefix = "#" .. tostring(state.unlockNum) .. " "
  local targetPos = CONFIG.positions.unlockedSpecial
  for _, entry in ipairs(bag.getObjects()) do
    if string.sub(entry.name, 1, #prefix) == prefix then
      bag.takeObject({
        guid = entry.guid,
        position = {targetPos[1] + math.random(-8, 8) * 0.08, targetPos[2] + 0.6, targetPos[3] + math.random(-5, 5) * 0.08},
        rotation = {0, 180, 0},
        smooth = true
      })
      broadcastToAll("Unlocked Special Tile " .. entry.name .. " (0 Actions to place)!", {0.94, 0.84, 0.52})
      return
    end
  end
  broadcastToAll("Special Tile #" .. tostring(state.unlockNum) .. " is already unlocked (not in reserve bag).", {0.95, 0.72, 0.42})
end
