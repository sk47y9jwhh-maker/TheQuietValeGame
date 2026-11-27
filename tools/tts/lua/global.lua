-- The Quiet Vale: Seasons of Settlement (v7.0) — Automated Tabletop Assistant
-- Features:
--   1. Collapsible XmlUI HUD + synced 3D board plaques & Warehouse counters
--   2. One-click 1-5P Setup: auto-places Steward meeples on legal Starting Terrain hexes,
--      sets Warehouse (15/10/8/0/0), builds exact v7.0 Encounter pool, deals 9-card seeding
--      hands to active seats (+ 3*P to Encounter draw well), deals Quest Card, shuffles Target Deck
--   3. Quick-Seed button: gathers dealt hands + draw pile into one shuffled Encounter Deck
--   4. Reveal Encounters (P cards): flips P Encounters into open In Play slots, auto-places
--      3 Arrival Timer tokens on any revealed Arrival, announces Burden season resolution costs
--   5. Draw Target Card: returns previous Target Card face-down to bottom, flips next Target Card,
--      and broadcasts its exact 2-row + compass criteria to chat
--   6. Smart End Round: sweeps Cooldown X tokens off Map Board, ticks Arrival Timers (-1 per
--      active Arrival with expiry alert), advances Round/Season marker, rotates Player 1 marker
--   7. Unlock Special Tile (#1-#26) & Quick-Pull Core Tile (21 Core types)

local CONFIG = __QV_TTS_CONFIG__

state = {
  playerCount = 2,
  round = 1,
  firstPlayerIdx = 1,
  unlockNum = 1,
  coreIdx = 1,
  hudCollapsed = false,
  activeTargetGuid = ""
}

local SETUP_RULES = {
  [1] = { actions = 4, warehouse = 15, boons = 5,  burdens = 3,  arrivals = 4  },
  [2] = { actions = 4, warehouse = 10, boons = 8,  burdens = 8,  arrivals = 8  },
  [3] = { actions = 3, warehouse = 8,  boons = 12, burdens = 12, arrivals = 12 },
  [4] = { actions = 3, warehouse = 0,  boons = 16, burdens = 16, arrivals = 16 },
  [5] = { actions = 2, warehouse = 0,  boons = 26, burdens = 14, arrivals = 20 },
}

local SEAT_COLORS = { "White", "Red", "Blue", "Green", "Yellow" }

function getSeason(r)
  if r <= 4 then return 1, "I" end
  if r <= 8 then return 2, "II" end
  return 3, "III"
end

function onLoad(saved_data)
  if saved_data and saved_data ~= "" then
    local ok, decoded = pcall(JSON.decode, saved_data)
    if ok and type(decoded) == "table" then
      state.playerCount = decoded.playerCount or state.playerCount
      state.round = decoded.round or state.round
      state.firstPlayerIdx = decoded.firstPlayerIdx or state.firstPlayerIdx
      state.unlockNum = decoded.unlockNum or state.unlockNum
      state.coreIdx = decoded.coreIdx or state.coreIdx
      state.hudCollapsed = decoded.hudCollapsed or false
      state.activeTargetGuid = decoded.activeTargetGuid or ""
    end
  end
  Wait.frames(function()
    buildControlPlaqueUI()
    buildUnlockPlaqueUI()
    refreshHud()
  end, 8)
end

function onSave()
  return JSON.encode(state)
end

-- ---------------------------------------------------------------------------
-- XmlUI HUD Handlers
-- ---------------------------------------------------------------------------
function onHudToggle()
  state.hudCollapsed = not state.hudCollapsed
  refreshHud()
end

function onHudSetup(_, playerCountStr)
  local p = tonumber(playerCountStr)
  if p then runSetup(p) end
end

function onHudQuickSeed()
  runQuickSeed()
end

function onHudRevealEncounters()
  revealEncounters()
end

function onHudDrawTarget()
  drawTargetCard()
end

function onHudEndRound()
  onEndRound()
end

function onHudWhPlus(_, idxStr)
  local idx = tonumber(idxStr)
  local guid = idx and CONFIG.guids.warehouseCounters[idx]
  local c = guid and getObjectFromGUID(guid)
  if c then c.call("adjust", 1) end
  syncWarehouseHud()
end

function onHudWhMinus(_, idxStr)
  local idx = tonumber(idxStr)
  local guid = idx and CONFIG.guids.warehouseCounters[idx]
  local c = guid and getObjectFromGUID(guid)
  if c then c.call("adjust", -1) end
  syncWarehouseHud()
end

function onHudUnlockPrev()
  onUnlockPrev(nil, nil, false)
end

function onHudUnlockNext()
  onUnlockNext(nil, nil, false)
end

function onHudUnlockTile()
  onUnlockTile()
end

function onHudCorePrev()
  local n = #CONFIG.coreCatalog
  state.coreIdx = ((state.coreIdx - 2) % n) + 1
  refreshHud()
end

function onHudCoreNext()
  local n = #CONFIG.coreCatalog
  state.coreIdx = (state.coreIdx % n) + 1
  refreshHud()
end

function onHudPullCoreTile()
  pullCoreTile(state.coreIdx)
end

function syncWarehouseHud()
  for i, guid in ipairs(CONFIG.guids.warehouseCounters) do
    local c = getObjectFromGUID(guid)
    if c then
      local v = c.call("getValue") or 0
      UI.setAttribute("whVal" .. tostring(i), "text", tostring(v))
    end
  end
end

function refreshHud()
  local _, seasonRoman = getSeason(state.round)
  local rules = SETUP_RULES[state.playerCount] or SETUP_RULES[2]
  UI.setAttribute("qvHudBody", "active", state.hudCollapsed and "false" or "true")
  UI.setAttribute("qvHudRoot", "height", state.hudCollapsed and "36" or "548")
  UI.setAttribute("qvToggleBtn", "text", state.hudCollapsed and "+" or "-")
  UI.setAttribute(
    "qvStatus",
    "text",
    string.format("Season %s  |  Round %d/12  |  %dP (%d Act)", seasonRoman, state.round, state.playerCount, rules.actions)
  )
  for p = 1, 5 do
    UI.setAttribute("btnSetup" .. tostring(p), "color", (state.playerCount == p) and "#8a6624" or "#2e2922")
  end
  UI.setAttribute(
    "btnRevealEnc",
    "text",
    string.format("REVEAL ENCOUNTERS (%d %s)", state.playerCount, state.playerCount == 1 and "CARD" or "CARDS")
  )
  UI.setAttribute(
    "btnEndRound",
    "text",
    state.round < 12 and string.format("END ROUND %d -> %d", state.round, state.round + 1) or "FINISH ROUND 12"
  )
  UI.setAttribute("hudUnlockNum", "text", "#" .. tostring(state.unlockNum))
  local entry = CONFIG.coreCatalog[state.coreIdx]
  if entry then
    UI.setAttribute("hudCoreName", "text", entry.name)
  end
  syncWarehouseHud()
end

-- ---------------------------------------------------------------------------
-- 3D Control Plaque UI (Synced with HUD)
-- ---------------------------------------------------------------------------
function buildControlPlaqueUI()
  local plaque = getObjectFromGUID(CONFIG.guids.controlPlaque)
  if not plaque then return end
  plaque.clearButtons()

  plaque.createButton({
    click_function = "noop",
    function_owner = Global,
    label = "THE QUIET VALE v7.0\nSETUP BY PLAYER COUNT",
    position = {0, 0.56, -0.34},
    width = 0,
    height = 0,
    font_size = 70,
    font_color = {0.94, 0.80, 0.46}
  })

  for p = 1, 5 do
    local x = -0.38 + (p - 1) * 0.19
    local fnName = "setupPlayers_" .. tostring(p)
    _G[fnName] = function() runSetup(p) end
    plaque.createButton({
      click_function = fnName,
      function_owner = Global,
      label = tostring(p) .. "P",
      position = {x, 0.56, -0.10},
      width = 90,
      height = 90,
      font_size = 64,
      color = (state.playerCount == p) and {0.68, 0.52, 0.22} or {0.26, 0.24, 0.22},
      font_color = {0.98, 0.94, 0.84},
      tooltip = "Setup " .. tostring(p) .. "-Player Game (auto-places Stewards, Warehouse & Encounters)"
    })
  end

  plaque.createButton({
    click_function = "revealEncounters",
    function_owner = Global,
    label = "REVEAL " .. tostring(state.playerCount) .. " ENCOUNTERS",
    position = {0, 0.56, 0.14},
    width = 450,
    height = 88,
    font_size = 50,
    color = {0.56, 0.40, 0.14},
    font_color = {0.98, 0.94, 0.84},
    tooltip = "Flip P Encounter cards into In Play and auto-place 3 Timers on Arrivals."
  })

  plaque.createButton({
    click_function = "onEndRound",
    function_owner = Global,
    label = "END ROUND " .. tostring(state.round) .. " -> NEXT",
    position = {0, 0.56, 0.35},
    width = 450,
    height = 84,
    font_size = 48,
    color = {0.26, 0.44, 0.30},
    font_color = {0.96, 0.94, 0.88},
    tooltip = "Clear X tokens, tick Arrival timers, advance Round Marker, rotate Player 1."
  })
end

function noop() end

-- ---------------------------------------------------------------------------
-- 1-5P Automated Setup (Stewards on Starting Terrain + Seeding Hands)
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
    if c then c.call("setValue", rules.warehouse) end
  end

  -- 2. Auto-place active Steward meeples onto their legal Starting Terrain hexes
  local placedStewards = {}
  for i = 1, 6 do
    local st = CONFIG.stewards[i]
    local pawn = st and getObjectFromGUID(st.pawnGuid)
    if pawn then
      if i <= playerCount then
        local hp = st.startHexPos
        pawn.setPositionSmooth({hp[1], hp[2] + 0.5, hp[3]}, false, true)
        pawn.setRotationSmooth({0, 180, 0}, false, true)
        table.insert(placedStewards, st.name .. " (" .. st.startHexId .. ")")
      else
        local home = st.homePawnPos
        pawn.setPositionSmooth({home[1], home[2], home[3]}, false, true)
      end
    end
  end

  -- 3. Shuffle Target Deck
  local targetDeck = getObjectFromGUID(CONFIG.guids.targetDeck)
  if targetDeck then targetDeck.shuffle() end

  -- 4. Shuffle Quest Deck and deal 1 Quest Card face up onto the Tiles Board
  local questDeck = getObjectFromGUID(CONFIG.guids.questDeck)
  if questDeck then
    questDeck.shuffle()
    questDeck.takeObject({
      position = CONFIG.positions.activeQuest,
      rotation = {0, 180, 0},
      smooth = true
    })
  end

  -- 5. Build the exact v7.0 Encounter Pool onto the Encounter draw well
  local drawPos = CONFIG.positions.encounterDraw
  local pulledCount = 0
  local function takeCards(deckGuid, count)
    local deck = getObjectFromGUID(deckGuid)
    if not deck then return end
    deck.shuffle()
    for _ = 1, count do
      if deck.getQuantity() > 1 then
        deck.takeObject({
          position = {drawPos[1], drawPos[2] + 0.3 + (pulledCount * 0.035), drawPos[3]},
          rotation = {0, 180, 180},
          smooth = false
        })
        pulledCount = pulledCount + 1
      elseif deck.getQuantity() == 1 then
        deck.setPosition({drawPos[1], drawPos[2] + 0.3 + (pulledCount * 0.035), drawPos[3]})
        deck.setRotation({0, 180, 180})
        pulledCount = pulledCount + 1
        break
      end
    end
  end

  takeCards(CONFIG.guids.boonsDeck, rules.boons)
  takeCards(CONFIG.guids.burdensDeck, rules.burdens)
  takeCards(CONFIG.guids.arrivalsDeck, rules.arrivals)

  -- Wait for cards to stack into a Deck, shuffle, and deal 9-card seeding hands to active seats
  Wait.time(function()
    local encDeck = findEncounterDrawDeck()
    if encDeck and encDeck.tag == "Deck" then
      encDeck.setName("Encounter Deck (" .. tostring(playerCount) .. "P)")
      encDeck.shuffle()
      -- Deal 9 cards to each active seat that has a seated player; otherwise keep ready for Quick-Seed
      local seatedCount = 0
      for i = 1, playerCount do
        local color = SEAT_COLORS[i]
        if Player[color] and Player[color].seated then
          encDeck.deal(9, color)
          seatedCount = seatedCount + 1
        end
      end
      if seatedCount > 0 then
        broadcastToAll(
          string.format("Dealt 9-card seeding hands to %d seated player(s). Seed cards onto Encounter well or click QUICK-SEED!", seatedCount),
          {0.82, 0.92, 0.98}
        )
      else
        broadcastToAll(
          "Encounter Deck is shuffled and ready in the ENCOUNTER well! Click REVEAL ENCOUNTERS to start Round 1.",
          {0.82, 0.92, 0.98}
        )
      end
    end
  end, 1.0)

  -- 6. Place Round Marker on Round 1 & Player 1 Marker at Seat 1
  moveRoundMarker(1)
  movePlayer1Marker(1)

  buildControlPlaqueUI()
  refreshHud()
  broadcastToAll(
    string.format(
      "Setup %dP complete! Stewards placed: %s | Actions/turn: %d | Warehouse: %d each.",
      playerCount, table.concat(placedStewards, ", "), rules.actions, rules.warehouse
    ),
    {0.94, 0.84, 0.56}
  )
end

-- Gather any dealt seeding hands back onto the Encounter Draw well and shuffle
function runQuickSeed()
  local drawPos = CONFIG.positions.encounterDraw
  local moved = 0
  for i = 1, state.playerCount do
    local color = SEAT_COLORS[i]
    if Player[color] and Player[color].seated then
      local hand = Player[color].getHandObjects()
      for _, card in ipairs(hand) do
        card.setPosition({drawPos[1], drawPos[2] + 0.8 + moved * 0.04, drawPos[3]})
        card.setRotation({0, 180, 180})
        moved = moved + 1
      end
    end
  end
  Wait.time(function()
    local encDeck = findEncounterDrawDeck()
    if encDeck and encDeck.tag == "Deck" then
      encDeck.shuffle()
      broadcastToAll("Quick-Seed complete (" .. tostring(moved) .. " hand cards merged). Encounter Deck shuffled & ready for Round 1!", {0.84, 0.95, 0.78})
    else
      broadcastToAll("Encounter Deck is ready in the ENCOUNTER well!", {0.84, 0.95, 0.78})
    end
  end, 0.8)
end

-- ---------------------------------------------------------------------------
-- Reveal Encounters (P cards) + Auto-Place 3 Timers on Arrivals
-- ---------------------------------------------------------------------------
function findEncounterDrawDeck()
  local p = CONFIG.positions.encounterDraw
  local hits = Physics.cast({
    origin = {p[1], p[2] + 4, p[3]},
    direction = {0, -1, 0},
    type = 3,
    size = {2.4, 4, 3.6},
    max_distance = 6
  })
  for _, hit in ipairs(hits) do
    local obj = hit.hit_object
    if obj and (obj.tag == "Deck" or obj.tag == "Card") then
      return obj
    end
  end
  return nil
end

function isSlotOccupied(pos)
  local hits = Physics.cast({
    origin = {pos[1], pos[2] + 3, pos[3]},
    direction = {0, -1, 0},
    type = 3,
    size = {1.8, 3, 2.8},
    max_distance = 5
  })
  for _, hit in ipairs(hits) do
    local obj = hit.hit_object
    if obj and (obj.tag == "Card" or obj.tag == "Deck") then
      return true
    end
  end
  return false
end

function spawnArrivalTimers(cardPos)
  local bag = getObjectFromGUID(CONFIG.guids.arrivalTimerBag)
  if not bag then return end
  local offsets = { {-0.62, 0.55, 0.95}, {0.0, 0.55, 0.95}, {0.62, 0.55, 0.95} }
  for _, off in ipairs(offsets) do
    bag.takeObject({
      position = {cardPos[1] + off[1], cardPos[2] + off[2], cardPos[3] + off[3]},
      rotation = {0, 180, 0},
      smooth = true
    })
  end
end

function revealEncounters()
  local encDeck = findEncounterDrawDeck()
  if not encDeck then
    broadcastToAll("No Encounter Deck found in the ENCOUNTER draw well! Click 1P–5P Setup first.", {0.96, 0.52, 0.45})
    return
  end

  local slots = CONFIG.positions.inPlaySlots
  local openSlots = {}
  for _, s in ipairs(slots) do
    if not isSlotOccupied(s) then
      table.insert(openSlots, s)
    end
  end

  local seasonNum, seasonRoman = getSeason(state.round)
  local burdenCost = seasonNum * 2 + 1
  local toDraw = state.playerCount

  local function announceCard(cardObj, slotPos)
    local name = cardObj.getName()
    local desc = cardObj.getDescription() or ""
    if string.sub(desc, 1, 7) == "Arrival" then
      Wait.time(function() spawnArrivalTimers(slotPos) end, 0.45)
      broadcastToAll("ARRIVAL revealed: " .. name .. " (+3 Arrival Timers placed!)", {0.68, 0.88, 0.98})
    elseif string.sub(desc, 1, 6) == "Burden" then
      broadcastToAll(string.format("BURDEN revealed: %s (Season %s resolve cost: %d)", name, seasonRoman, burdenCost), {0.98, 0.62, 0.56})
    else
      broadcastToAll("BOON revealed: " .. name, {0.78, 0.95, 0.72})
    end
  end

  for i = 1, toDraw do
    local slotPos = openSlots[i] or slots[((i - 1) % #slots) + 1]
    local targetPos = {slotPos[1], slotPos[2] + 0.25, slotPos[3]}
    if encDeck.tag == "Deck" then
      if encDeck.getQuantity() > 1 then
        local card = encDeck.takeObject({
          position = targetPos,
          rotation = {0, 180, 0},
          smooth = true
        })
        if card then announceCard(card, targetPos) end
      else
        -- Last card in deck
        encDeck.setPositionSmooth(targetPos, false, true)
        encDeck.setRotationSmooth({0, 180, 0}, false, true)
        announceCard(encDeck, targetPos)
        break
      end
    elseif encDeck.tag == "Card" then
      encDeck.setPositionSmooth(targetPos, false, true)
      encDeck.setRotationSmooth({0, 180, 0}, false, true)
      announceCard(encDeck, targetPos)
      break
    end
  end
end

-- ---------------------------------------------------------------------------
-- Draw Target Card (auto-returns previous Target Card to bottom of deck)
-- ---------------------------------------------------------------------------
function drawTargetCard()
  local deck = getObjectFromGUID(CONFIG.guids.targetDeck)
  if not deck then
    -- Check if deck got recreated in Target well
    local tp = CONFIG.positions.targetWell
    local hits = Physics.cast({
      origin = {tp[1], tp[2] + 4, tp[3]},
      direction = {0, -1, 0},
      type = 3,
      size = {2.2, 4, 3.2},
      max_distance = 6
    })
    for _, hit in ipairs(hits) do
      if hit.hit_object and hit.hit_object.tag == "Deck" then
        deck = hit.hit_object
        CONFIG.guids.targetDeck = deck.getGUID()
        break
      end
    end
  end

  if not deck then
    broadcastToAll("Target Deck not found in the TARGET CARDS well.", {0.96, 0.52, 0.45})
    return
  end

  -- Return previous face-up Target Card face-down to the bottom of the Target Deck
  if state.activeTargetGuid ~= "" then
    local prev = getObjectFromGUID(state.activeTargetGuid)
    if prev then
      local dp = deck.getPosition()
      prev.setRotation({0, 180, 180})
      prev.setPosition({dp.x, dp.y - 0.15, dp.z})
      deck.setPosition({dp.x, dp.y + 0.35, dp.z})
    end
    state.activeTargetGuid = ""
  end

  Wait.time(function()
    local disp = CONFIG.positions.activeTarget
    local card = deck.takeObject({
      position = {disp[1], disp[2] + 0.35, disp[3]},
      rotation = {0, 180, 0},
      smooth = true
    })
    if card then
      state.activeTargetGuid = card.getGUID()
      broadcastToAll("TARGET: " .. card.getName() .. " — " .. (card.getDescription() or ""), {0.82, 0.90, 0.98})
    end
  end, 0.25)
end

-- ---------------------------------------------------------------------------
-- End-of-Round Cleanup: X Tokens + Arrival Timer Tick + Round + Player 1
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

function tickArrivalTimers()
  local slots = CONFIG.positions.inPlaySlots
  local ticked = 0
  local expired = {}
  for _, slot in ipairs(slots) do
    local hits = Physics.cast({
      origin = {slot[1], slot[2] + 3, slot[3]},
      direction = {0, -1, 0},
      type = 3,
      size = {2.1, 3, 3.2},
      max_distance = 5
    })
    local timers = {}
    local cardName = "Arrival"
    for _, hit in ipairs(hits) do
      local o = hit.hit_object
      if o and not o.getLock() then
        if o.getName() == "Arrival Timer" then
          table.insert(timers, o)
        elseif o.tag == "Card" then
          cardName = o.getName()
        end
      end
    end
    if #timers > 0 then
      timers[1].destruct()
      ticked = ticked + 1
      if #timers == 1 then
        table.insert(expired, cardName)
      end
    end
  end
  return ticked, expired
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

  -- 2. Tick down 1 Arrival Timer per active Arrival in In Play
  local ticked, expired = tickArrivalTimers()

  -- 3. Advance Round & rotate Player 1 marker
  if state.round < 12 then
    state.round = state.round + 1
    moveRoundMarker(state.round)
    state.firstPlayerIdx = (state.firstPlayerIdx % state.playerCount) + 1
    movePlayer1Marker(state.firstPlayerIdx)
    buildControlPlaqueUI()
    refreshHud()

    local seasonMsg = ""
    if state.round == 5 then
      seasonMsg = " — SEASON II BEGINS! Refresh Steward powers (Burden cost now 5)."
    elseif state.round == 9 then
      seasonMsg = " — SEASON III BEGINS! Refresh Steward powers (Burden cost now 7)."
    end
    broadcastToAll(
      string.format("Round %d begins (cleared %d X, ticked %d Arrival timer(s), P1 -> Seat %d)%s",
        state.round, cleared, ticked, state.firstPlayerIdx, seasonMsg),
      {0.84, 0.94, 0.78}
    )
  else
    broadcastToAll(
      string.format("Round 12 complete (cleared %d X, ticked %d timer(s))! Proceed to Final Scoring.", cleared, ticked),
      {0.98, 0.84, 0.44}
    )
  end

  if #expired > 0 then
    broadcastToAll(
      "ARRIVAL EXPIRED (0 timers left): " .. table.concat(expired, ", ") .. " — Resolve Failure (-10 VP & Strain)!",
      {0.98, 0.44, 0.40}
    )
  end
end

-- ---------------------------------------------------------------------------
-- Quick-Pull Core Tile from Category Bag
-- ---------------------------------------------------------------------------
function pullCoreTile(idx)
  local entry = CONFIG.coreCatalog[idx]
  if not entry then return end
  local bag = getObjectFromGUID(entry.bagGuid)
  if not bag then
    broadcastToAll("Core tile bag not found for " .. entry.name, {0.95, 0.48, 0.44})
    return
  end
  local prefix = entry.name .. " /"
  local sp = CONFIG.positions.coreStaging
  for _, item in ipairs(bag.getObjects()) do
    if string.sub(item.name, 1, #prefix) == prefix then
      bag.takeObject({
        guid = item.guid,
        position = {sp[1] + math.random(-4, 4) * 0.12, sp[2] + 0.6, sp[3] + math.random(-4, 4) * 0.12},
        rotation = {0, 180, 0},
        smooth = true
      })
      broadcastToAll("Pulled Core Tile: " .. entry.name .. " (Basic side up, press F to upgrade).", {0.86, 0.94, 0.80})
      return
    end
  end
  broadcastToAll("No copies of " .. entry.name .. " remain in supply.", {0.95, 0.72, 0.42})
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
    position = {0, 0.56, -0.34},
    width = 0,
    height = 0,
    font_size = 64,
    font_color = {0.94, 0.80, 0.46}
  })

  plaque.createButton({
    click_function = "onUnlockPrev",
    function_owner = Global,
    label = "<",
    position = {-0.30, 0.56, -0.04},
    width = 100,
    height = 100,
    font_size = 86,
    color = {0.28, 0.26, 0.24},
    font_color = {0.95, 0.90, 0.80}
  })

  plaque.createButton({
    click_function = "noop",
    function_owner = Global,
    label = "#" .. tostring(state.unlockNum),
    position = {0, 0.56, -0.04},
    width = 175,
    height = 100,
    font_size = 86,
    color = {0.10, 0.09, 0.08},
    font_color = {0.96, 0.88, 0.64}
  })

  plaque.createButton({
    click_function = "onUnlockNext",
    function_owner = Global,
    label = ">",
    position = {0.30, 0.56, -0.04},
    width = 100,
    height = 100,
    font_size = 86,
    color = {0.28, 0.26, 0.24},
    font_color = {0.95, 0.90, 0.80}
  })

  plaque.createButton({
    click_function = "onUnlockTile",
    function_owner = Global,
    label = "UNLOCK #" .. tostring(state.unlockNum),
    position = {0, 0.56, 0.28},
    width = 420,
    height = 100,
    font_size = 58,
    color = {0.60, 0.46, 0.18},
    font_color = {0.98, 0.95, 0.86},
    tooltip = "Pull Special Tile #" .. tostring(state.unlockNum) .. " from the reserve bag onto the Tiles Board (0 Actions to place)."
  })
end

function onUnlockPrev(_, _, alt)
  local step = alt and 5 or 1
  state.unlockNum = ((state.unlockNum - 1 - step) % 26) + 1
  buildUnlockPlaqueUI()
  refreshHud()
end

function onUnlockNext(_, _, alt)
  local step = alt and 5 or 1
  state.unlockNum = ((state.unlockNum - 1 + step) % 26) + 1
  buildUnlockPlaqueUI()
  refreshHud()
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
        position = {targetPos[1] + math.random(-6, 6) * 0.08, targetPos[2] + 0.6, targetPos[3] + math.random(-4, 4) * 0.08},
        rotation = {0, 180, 0},
        smooth = true
      })
      broadcastToAll("Unlocked Special Tile " .. entry.name .. " (0 Actions to place)!", {0.94, 0.84, 0.52})
      return
    end
  end
  broadcastToAll("Special Tile #" .. tostring(state.unlockNum) .. " is already unlocked (not in reserve bag).", {0.95, 0.72, 0.42})
end
