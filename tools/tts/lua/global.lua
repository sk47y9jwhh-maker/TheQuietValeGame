-- The Quiet Vale: Seasons of Settlement (v7.0) — Full Automated Tabletop Assistant
-- Includes:
--   1. Collapsible XmlUI HUD + Turn/Action Tracker + Live Score Calculator
--   2. One-click 1-5P Setup (Stewards on Starting Terrain, Warehouse, Seeding Hands, Quest, Target Deck)
--   3. One-click Reveal Encounters (+3 Arrival Timers) & Draw Target Card (auto-returns previous)
--   4. Right-click Context Menus on EVERY Tile (Activate w/ Linked Production & Shrines, Pay & Place
--      w/ Shelter in the Ruins, Upgrade & Flip, +Strain w/ Supported Shield auto-consume, -Strain, +Shield)
--   5. Right-click Context Menus on EVERY Encounter Card (Welcome Arrival -> pay & auto-unlock Special Tile,
--      Resolve Burden -> pay Season 3/5/7 cost & discard, Discard Encounter)
--   6. Smart End Round (clear X tokens, tick Arrival Timers, advance Round/Season, rotate Player 1)

local CONFIG = __QV_TTS_CONFIG__

state = {
  playerCount = 2,
  round = 1,
  firstPlayerIdx = 1,
  currentTurnIdx = 1,
  actionsLeft = 4,
  unlockNum = 1,
  coreIdx = 1,
  hudCollapsed = false,
  activeTargetGuid = "",
  roundRevealed = false,
  stewardOrder = { 1, 2, 3, 4, 5, 6 },
  powerUsed = { false, false, false, false, false, false },
  scoreQuest = false,
  scoreObj = 0,
  scoreGold = 0,
  scoreFailedArrivals = 0,
  placedTileGuids = {},
  pawnLastHex = {},
  activeTab = "play"
}

local TERRAIN_LABEL = {
  grasslands = "Grasslands",
  woodland = "Woodland",
  water = "Water/River",
  mountains = "Mountains",
  heaths = "Heaths",
  arable = "Arable Land",
  ruins = "Ruins"
}

local alertTimerId = nil

function showAlert(title, body)
  UI.setAttribute("qvAlertTitle", "text", title)
  UI.setAttribute("qvAlertBody", "text", body)
  UI.setAttribute("qvAlertBanner", "active", "true")
  if alertTimerId then Wait.stop(alertTimerId) end
  alertTimerId = Wait.time(function()
    UI.setAttribute("qvAlertBanner", "active", "false")
  end, 6.5)
end

function onHudDismissAlert()
  if alertTimerId then Wait.stop(alertTimerId) end
  UI.setAttribute("qvAlertBanner", "active", "false")
end

function findNearestHex(pos)
  local best, bestD2 = nil, 2.25 -- within 1.5 TTS units of hex center
  for _, h in ipairs(CONFIG.mapHexes) do
    local dx = pos.x - h.x
    local dz = pos.z - h.z
    local d2 = dx * dx + dz * dz
    if d2 < bestD2 then
      bestD2 = d2
      best = h
    end
  end
  return best
end

function listContains(tbl, val)
  if not tbl then return false end
  for _, v in ipairs(tbl) do
    if v == val then return true end
  end
  return false
end

function validateTilePlacement(tileObj, rule, hex)
  local pl = rule.placement
  if not pl then return true, nil end

  -- 1. Terrain check
  if pl.terrain and #pl.terrain > 0 then
    if not listContains(pl.terrain, hex.t) then
      local need = pl.text ~= "" and pl.text or ("Must be placed on: " .. table.concat(pl.terrain, " / "))
      return false, string.format("%s on %s (%s): %s", rule.name, hex.id, TERRAIN_LABEL[hex.t] or hex.t, need)
    end
  elseif hex.t == "water" then
    return false, string.format("%s cannot be placed on %s (Water/River).", rule.name, hex.id)
  end

  -- 2. Adjacent terrain check (e.g., Washhouse -> Water/River, The Vaults -> Ruins)
  if pl.adjacentTerrain and #pl.adjacentTerrain > 0 then
    local foundAdj = false
    for _, h2 in ipairs(CONFIG.mapHexes) do
      if h2.id ~= hex.id and listContains(pl.adjacentTerrain, h2.t) then
        local dist = math.sqrt((h2.x - hex.x)^2 + (h2.z - hex.z)^2)
        if dist <= 2.65 then foundAdj = true; break end
      end
    end
    if not foundAdj then
      local need = pl.text ~= "" and pl.text or ("Must be adjacent to: " .. table.concat(pl.adjacentTerrain, " / "))
      return false, string.format("%s on %s: %s", rule.name, hex.id, need)
    end
  end

  -- 3. Adjacent placed tile category check (e.g., Cottage -> Housing, Inn/Workshops -> Travel)
  if pl.adjacentCategory and #pl.adjacentCategory > 0 then
    local foundCat = false
    for _, other in ipairs(getAllObjects()) do
      if other ~= tileObj then
        local oid = other.getGMNotes() or ""
        local orule = CONFIG.tileRules[oid]
        if orule and listContains(pl.adjacentCategory, orule.category) and isOnMapBoard(other.getPosition()) then
          local op = other.getPosition()
          local dist = math.sqrt((op.x - hex.x)^2 + (op.z - hex.z)^2)
          if dist <= 2.65 then foundCat = true; break end
        end
      end
    end
    if not foundCat then
      local need = pl.text ~= "" and pl.text or ("Must be adjacent to a " .. table.concat(pl.adjacentCategory, "/") .. " tile.")
      return false, string.format("%s on %s: %s", rule.name, hex.id, need)
    end
  end

  return true, nil
end

function onObjectDrop(_, obj)
  if not obj or obj.getLock() then return end
  Wait.frames(function()
    if not obj then return end
    local pos = obj.getPosition()
    if not isOnMapBoard(pos) then return end
    local hex = findNearestHex(pos)
    if not hex then return end

    -- Case A: Steward Meeple moved to a different hex -> auto-spend 1 Action
    for _, st in ipairs(CONFIG.stewards) do
      if obj.getGUID() == st.pawnGuid then
        if not state.pawnLastHex then state.pawnLastHex = {} end
        local prevHex = state.pawnLastHex[st.id]
        if prevHex and prevHex ~= hex.id then
          spendAction(1)
          broadcastToAll(string.format("Moved %s to %s (%s) — -1 Action (%d left).", st.name, hex.id, TERRAIN_LABEL[hex.t] or hex.t, state.actionsLeft or 0), {0.82, 0.92, 0.98})
        end
        state.pawnLastHex[st.id] = hex.id
        return
      end
    end

    -- Case B: Tile dropped onto a Map Board hex -> validate placement & auto-count Action
    local id = obj.getGMNotes() or ""
    local rule = CONFIG.tileRules[id]
    if not rule then return end

    local legal, reason = validateTilePlacement(obj, rule, hex)
    if not legal then
      showAlert("INVALID PLACEMENT (!)", reason)
      broadcastToAll("! PLACEMENT WARNING: " .. reason, {0.98, 0.56, 0.36})
      return
    end

    onHudDismissAlert()

    -- Keep any Steward Meeple standing on this hex neatly ON TOP of the placed tile!
    local tileY = 1.12
    for _, st in ipairs(CONFIG.stewards) do
      local pawn = getObjectFromGUID(st.pawnGuid)
      if pawn then
        local pp = pawn.getPosition()
        local dist = math.sqrt((pp.x - hex.x)^2 + (pp.z - hex.z)^2)
        if dist <= 1.35 then
          obj.setPosition({hex.x, tileY, hex.z})
          obj.setRotation({0, 180, obj.is_face_down and 180 or 0})
          pawn.setPositionSmooth({hex.x, tileY + 0.48, hex.z}, false, true)
          pawn.setRotationSmooth({0, 180, 0}, false, true)
        end
      end
    end

    if not state.placedTileGuids then state.placedTileGuids = {} end
    local guid = obj.getGUID()
    if not state.placedTileGuids[guid] then
      state.placedTileGuids[guid] = hex.id
      if rule.kind == "core" then
        spendAction(1)
        local extra = (hex.t == "ruins") and " [Shelter in the Ruins: Wood/Stone/Metal ignored!]" or ""
        broadcastToAll(
          string.format("Placed %s on %s (%s) — -1 Action (%d left). Right-click tile to Pay Cost / Activate.%s",
            rule.name, hex.id, TERRAIN_LABEL[hex.t] or hex.t, state.actionsLeft or 0, extra),
          {0.82, 0.95, 0.78}
        )
        if (state.actionsLeft or 0) == 0 then
          showAlert("0 ACTIONS REMAINING", "This player has used all Actions — click NEXT TURN when ready.")
        end
      elseif rule.kind == "special" then
        broadcastToAll(
          string.format("Placed Special Tile %s on %s (%s) — 0 Actions (v7.0 rule)!", rule.name, hex.id, TERRAIN_LABEL[hex.t] or hex.t),
          {0.94, 0.86, 0.56}
        )
      end
    end
  end, 8)
end

local SETUP_RULES = {
  [1] = { actions = 4, warehouse = 15, boons = 5,  burdens = 3,  arrivals = 4  },
  [2] = { actions = 4, warehouse = 10, boons = 8,  burdens = 8,  arrivals = 8  },
  [3] = { actions = 3, warehouse = 8,  boons = 12, burdens = 12, arrivals = 12 },
  [4] = { actions = 3, warehouse = 0,  boons = 16, burdens = 16, arrivals = 16 },
  [5] = { actions = 2, warehouse = 0,  boons = 26, burdens = 14, arrivals = 20 },
}

local SEAT_COLORS = { "White", "Red", "Blue", "Green", "Yellow" }
-- Warehouse counter indices match Logistics Board column order:
-- 1=stone, 2=metal, 3=goods, 4=wood, 5=food, 6=herbs
local RES_TO_IDX = { stone = 1, metal = 2, goods = 3, wood = 4, food = 5, herbs = 6 }
local RES_LABEL  = { stone = "Stone", metal = "Metal", goods = "Goods", wood = "Wood", food = "Food", herbs = "Herbs" }

-- Settlement-wide v7.0 Shrine bonuses: shrineId -> { targetTileId, resource, amount }
local SHRINE_BONUS = {
  special_shrine_of_ancestors = { tileId = "c20_dig_site",          res = "metal", amt = 2, name = "Shrine of Ancestors" },
  special_shrine_of_ancients  = { tileId = "c03_gathering_outpost", res = "herbs", amt = 2, name = "Shrine of Ancients" },
  special_shrine_of_bounty    = { tileId = "c04_farmstead",         res = "food",  amt = 2, name = "Shrine of Bounty" },
  special_shrine_of_depths    = { tileId = "c02_mine_tunnel",       res = "stone", amt = 2, name = "Shrine of Depths" },
  special_shrine_of_renewal   = { tileId = "c01_lumber_yard",       res = "wood",  amt = 2, name = "Shrine of Renewal" }
}

function getSeason(r)
  if r <= 4 then return 1, "I" end
  if r <= 8 then return 2, "II" end
  return 3, "III"
end

function onLoad(saved_data)
  if saved_data and saved_data ~= "" then
    local ok, decoded = pcall(JSON.decode, saved_data)
    if ok and type(decoded) == "table" then
      for k, v in pairs(decoded) do state[k] = v end
    end
  end
  Wait.frames(function()
    for _, obj in ipairs(getAllObjects()) do
      attachObjectMenus(obj)
    end
    refreshHud()
  end, 8)
end

function onSave()
  return JSON.encode(state)
end

function onObjectLeaveContainer(_, obj)
  if obj then
    Wait.frames(function() attachObjectMenus(obj) end, 2)
  end
end

-- ---------------------------------------------------------------------------
-- Warehouse Helper Functions (Synced between 3D counters & HUD)
-- ---------------------------------------------------------------------------
function getWarehouse()
  local wh = {}
  for res, idx in pairs(RES_TO_IDX) do
    local c = getObjectFromGUID(CONFIG.guids.warehouseCounters[idx])
    wh[res] = (c and c.call("getValue")) or 0
  end
  return wh
end

function addWarehouseResources(gains)
  local parts = {}
  for _, res in ipairs({"wood", "stone", "metal", "food", "herbs", "goods"}) do
    local amt = gains[res] or 0
    if amt > 0 then
      local idx = RES_TO_IDX[res]
      local c = getObjectFromGUID(CONFIG.guids.warehouseCounters[idx])
      if c then
        local cur = c.call("getValue") or 0
        local nextVal = math.min(15, cur + amt)
        c.call("setValue", nextVal)
        table.insert(parts, "+" .. tostring(nextVal - cur) .. " " .. RES_LABEL[res])
      end
    end
  end
  syncWarehouseHud()
  return parts
end

function canAffordCost(costMap)
  local wh = getWarehouse()
  local missing = {}
  for _, res in ipairs({"wood", "stone", "metal", "food", "herbs", "goods"}) do
    local need = costMap[res] or 0
    if need > 0 and (wh[res] or 0) < need then
      table.insert(missing, string.format("%s (%d/%d)", RES_LABEL[res], wh[res] or 0, need))
    end
  end
  return #missing == 0, missing
end

function payCost(costMap)
  local ok, missing = canAffordCost(costMap)
  if not ok then return false, missing end
  local paid = {}
  for _, res in ipairs({"wood", "stone", "metal", "food", "herbs", "goods"}) do
    local need = costMap[res] or 0
    if need > 0 then
      local idx = RES_TO_IDX[res]
      local c = getObjectFromGUID(CONFIG.guids.warehouseCounters[idx])
      if c then
        local cur = c.call("getValue") or 0
        c.call("setValue", math.max(0, cur - need))
        table.insert(paid, "-" .. tostring(need) .. " " .. RES_LABEL[res])
      end
    end
  end
  syncWarehouseHud()
  return true, paid
end

-- ---------------------------------------------------------------------------
-- Smart Right-Click Context Menus for Tiles & Encounter Cards
-- ---------------------------------------------------------------------------
function attachObjectMenus(obj)
  if not obj then return end
  local note = obj.getGMNotes() or ""
  if note == "" then return end

  if CONFIG.tileRules[note] then
    local rule = CONFIG.tileRules[note]
    obj.clearContextMenu()
    obj.addContextMenuItem("Activate Tile", function() activateTile(obj) end)
    if rule.kind == "core" then
      obj.addContextMenuItem("Pay Placement Cost", function() payPlaceTile(obj) end)
      obj.addContextMenuItem("Upgrade Tile (Pay & Flip)", function() upgradeTile(obj) end)
    end
    obj.addContextMenuItem("+1 Strain (Auto-Shield)", function() addStrainToTile(obj) end)
    obj.addContextMenuItem("-1 Strain", function() removeStrainFromTile(obj) end)
    obj.addContextMenuItem("+Supported Shield", function() addSupportedToTile(obj) end)
  elseif CONFIG.encounterRules[note] then
    local erule = CONFIG.encounterRules[note]
    obj.clearContextMenu()
    if erule.type == "arrival" then
      obj.addContextMenuItem("Welcome Arrival (Pay & Unlock)", function() resolveArrivalCard(obj) end)
      obj.addContextMenuItem("+1 Arrival Timer (max 3)", function() addTimerToArrivalCard(obj) end)
    elseif erule.type == "burden" then
      obj.addContextMenuItem("Resolve Burden (Pay Season Cost)", function() resolveBurdenCard(obj) end)
    end
    obj.addContextMenuItem("Seed -> Season I (Top)", function() seedCardToBand(obj, 1) end)
    obj.addContextMenuItem("Seed -> Season II (Middle)", function() seedCardToBand(obj, 2) end)
    obj.addContextMenuItem("Seed -> Season III (Bottom)", function() seedCardToBand(obj, 3) end)
    obj.addContextMenuItem("Discard Encounter", function() discardEncounterCard(obj) end)
  end
end

-- Scan tokens sitting directly on a tile
function getTokensOnTile(tileObj)
  local p = tileObj.getPosition()
  local hits = Physics.cast({
    origin = {p.x, p.y + 3, p.z},
    direction = {0, -1, 0},
    type = 3,
    size = {1.9, 3.5, 1.9},
    max_distance = 5
  })
  local res = { strain = {}, supported = {}, cooldown = {} }
  for _, hit in ipairs(hits) do
    local o = hit.hit_object
    if o and o ~= tileObj and not o.getLock() then
      local n = o.getName()
      if n == "Strain Token" then table.insert(res.strain, o)
      elseif n == "Supported Shield" then table.insert(res.supported, o)
      elseif n == "Cooldown X" then table.insert(res.cooldown, o)
      end
    end
  end
  return res
end

function isOnMapBoard(pos)
  local b = CONFIG.mapBounds
  return pos.x >= b.minX and pos.x <= b.maxX and pos.z >= b.minZ and pos.z <= b.maxZ
end

function isOnRuinsHex(pos)
  for _, rp in ipairs(CONFIG.positions.ruinsHexes) do
    local dx = pos.x - rp[1]
    local dz = pos.z - rp[3]
    if (dx * dx + dz * dz) < 1.1 then return true end
  end
  return false
end

function isTileUpgraded(tileObj)
  return tileObj.is_face_down
end

function findActiveShrines()
  local active = {}
  for _, obj in ipairs(getAllObjects()) do
    local id = obj.getGMNotes() or ""
    if SHRINE_BONUS[id] and isOnMapBoard(obj.getPosition()) then
      local toks = getTokensOnTile(obj)
      if #toks.strain < 3 then
        active[id] = SHRINE_BONUS[id]
      end
    end
  end
  return active
end

function spawnTokenOnTile(bagGuid, tileObj, offX, offZ)
  local bag = getObjectFromGUID(bagGuid)
  if not bag then return end
  local p = tileObj.getPosition()
  bag.takeObject({
    position = {p.x + offX, p.y + 0.55, p.z + offZ},
    rotation = {0, 180, 0},
    smooth = true
  })
end

function activateTile(tileObj)
  local id = tileObj.getGMNotes() or ""
  local rule = CONFIG.tileRules[id]
  if not rule then return end

  local toks = getTokensOnTile(tileObj)
  if #toks.strain >= 3 then
    broadcastToAll(tileObj.getName() .. " is OVERSTRAINED (3+ Strain) and cannot activate!", {0.96, 0.44, 0.40})
    return
  end
  -- Resource tiles with Linked Production can ALWAYS be activated again; Cooldown X only
  -- marks that their once-per-round Linked Production bonus has already been used!
  local hasCooldown = #toks.cooldown > 0
  if hasCooldown and not rule.linked then
    broadcastToAll(tileObj.getName() .. " already has a Cooldown X token this round!", {0.96, 0.72, 0.42})
    return
  end

  local upgraded = (rule.kind == "core") and isTileUpgraded(tileObj)
  local face = upgraded and rule.upgraded or rule.basic
  local faceName = (face and face.name) or rule.name
  local gains = {}
  local function addProd(prodMap)
    if not prodMap then return end
    for res, amt in pairs(prodMap) do
      if amt and amt > 0 then gains[res] = (gains[res] or 0) + amt end
    end
  end

  addProd(face and face.prod)

  -- Check settlement-wide Shrine bonus (v7.0)
  local shrines = findActiveShrines()
  local shrineNotes = {}
  local function applyShrinesFor(tileId)
    for _, sh in pairs(shrines) do
      if sh.tileId == tileId then
        gains[sh.res] = (gains[sh.res] or 0) + sh.amt
        table.insert(shrineNotes, sh.name .. " +" .. tostring(sh.amt) .. " " .. RES_LABEL[sh.res])
      end
    end
  end
  applyShrinesFor(id)

  -- Check Linked Production (only if this tile has NOT used Linked Production this round)
  local linkedCount = 0
  if rule.linked then
    if not hasCooldown and isOnMapBoard(tileObj.getPosition()) then
      local p1 = tileObj.getPosition()
      for _, other in ipairs(getAllObjects()) do
        if other ~= tileObj and (other.getGMNotes() or "") == id and isOnMapBoard(other.getPosition()) then
          local p2 = other.getPosition()
          local dist = math.sqrt((p1.x - p2.x)^2 + (p1.z - p2.z)^2)
          if dist <= 2.65 then
            local oToks = getTokensOnTile(other)
            if #oToks.strain < 3 and #oToks.cooldown == 0 then
              local oUp = isTileUpgraded(other)
              local oFace = oUp and rule.upgraded or rule.basic
              addProd(oFace and oFace.prod)
              applyShrinesFor(id)
              spawnTokenOnTile(CONFIG.guids.cooldownXBag, other, 0.55, -0.45)
              linkedCount = linkedCount + 1
            end
          end
        end
      end
      -- Only place Cooldown X on a resource tile when Linked Production actually triggered
      if linkedCount > 0 then
        spawnTokenOnTile(CONFIG.guids.cooldownXBag, tileObj, 0.55, -0.45)
      end
    end
  else
    -- Non-linked tile: place Cooldown X for once-per-round tracking
    spawnTokenOnTile(CONFIG.guids.cooldownXBag, tileObj, 0.55, -0.45)
  end

  local addedParts = addWarehouseResources(gains)
  spendAction(1)

  -- Smart auto-effects for Wellbeing strain-clearing tiles (Tavern, Eatery, Washhouse, Apothecary, Vaults)
  local strainClearMap = {
    c09_tavern = { basic = 1, upgraded = 2, maxPerTile = 1 },
    c10_eatery = { basic = 1, upgraded = 2, maxPerTile = 1 },
    c11_washhouse = { basic = 1, upgraded = 2, maxPerTile = 1 },
    c12_apothecary = { basic = 1, upgraded = 2, maxPerTile = 2 },
    c21_the_vaults = { basic = 1, upgraded = 2, maxPerTile = 2 }
  }
  local scRule = strainClearMap[id]
  if scRule and isOnMapBoard(tileObj.getPosition()) then
    local p1 = tileObj.getPosition()
    local strainedAdj = {}
    for _, other in ipairs(getAllObjects()) do
      if other ~= tileObj and CONFIG.tileRules[other.getGMNotes() or ""] and isOnMapBoard(other.getPosition()) then
        local p2 = other.getPosition()
        if math.sqrt((p1.x - p2.x)^2 + (p1.z - p2.z)^2) <= 2.65 then
          local oToks = getTokensOnTile(other)
          if #oToks.strain > 0 then table.insert(strainedAdj, { obj = other, toks = oToks.strain }) end
        end
      end
    end
    local limit = upgraded and scRule.upgraded or scRule.basic
    if #strainedAdj == 1 then
      local target = strainedAdj[1]
      local removeN = math.min(limit, scRule.maxPerTile, #target.toks)
      for k = 1, removeN do target.toks[k].destruct() end
      broadcastToAll(string.format("[AUTO] Activated %s: removed %d Strain from adjacent %s!", faceName, removeN, target.obj.getName()), {0.78, 0.96, 0.80})
      return
    elseif #strainedAdj == 0 then
      broadcastToAll("[AUTO] Activated " .. faceName .. " (no adjacent tiles have Strain).", {0.88, 0.88, 0.78})
      return
    else
      broadcastToAll(string.format("[MANUAL] Activated %s: %d adjacent tiles have Strain — right-click chosen tile(s) -> -1 Strain (up to %d).", faceName, #strainedAdj, limit), {0.96, 0.82, 0.48})
      return
    end
  end

  -- Smart auto-effect for Inn / Dawn Break Inn (+1 / +2 Arrival Timer)
  if id == "c08_inn" then
    local addAmt = upgraded and 2 or 1
    local candidates = {}
    for _, slot in ipairs(CONFIG.positions.inPlaySlots) do
      local hits = Physics.cast({ origin = {slot[1], slot[2] + 3, slot[3]}, direction = {0, -1, 0}, type = 3, size = {2.2, 3, 3.4}, max_distance = 5 })
      local cardObj, tCount = nil, 0
      for _, h in ipairs(hits) do
        local o = h.hit_object
        if o and not o.getLock() then
          if o.getName() == "Arrival Timer" then tCount = tCount + 1
          elseif o.tag == "Card" and CONFIG.encounterRules[o.getGMNotes() or ""] and CONFIG.encounterRules[o.getGMNotes() or ""].type == "arrival" then cardObj = o end
        end
      end
      if cardObj and tCount < 3 then table.insert(candidates, { card = cardObj, timers = tCount }) end
    end
    if #candidates == 1 then
      local c = candidates[1]
      local toAdd = math.min(addAmt, 3 - c.timers)
      for _ = 1, toAdd do addTimerToArrivalCard(c.card) end
      broadcastToAll(string.format("[AUTO] Activated %s: added +%d Arrival Timer to %s!", faceName, toAdd, c.card.getName()), {0.74, 0.94, 0.98})
      return
    elseif #candidates > 1 then
      broadcastToAll(string.format("[MANUAL] Activated %s: right-click an active Arrival -> +1 Arrival Timer (up to +%d).", faceName, addAmt), {0.96, 0.82, 0.48})
      return
    else
      broadcastToAll("[AUTO] Activated " .. faceName .. " (no active Arrivals with <3 timers).", {0.88, 0.88, 0.78})
      return
    end
  end

  local msg = "[AUTO] Activated " .. faceName
  if linkedCount > 0 then
    msg = msg .. " (+Linked x" .. tostring(linkedCount) .. ")"
  elseif rule.linked and hasCooldown then
    msg = msg .. " (solo — Linked Production already used this round)"
  end
  if #addedParts > 0 then
    msg = msg .. ": " .. table.concat(addedParts, ", ")
  else
    msg = "[MANUAL] Activated " .. faceName .. " — resolve its printed effect manually."
  end
  if #shrineNotes > 0 then msg = msg .. " [" .. table.concat(shrineNotes, ", ") .. "]" end
  broadcastToAll(msg, #addedParts > 0 and {0.82, 0.95, 0.76} or {0.96, 0.82, 0.48})
end

function payPlaceTile(tileObj)
  local id = tileObj.getGMNotes() or ""
  local rule = CONFIG.tileRules[id]
  if not rule or rule.kind ~= "core" then return end
  local costCopy = {}
  local shelterIgnored = {}
  local onRuins = isOnRuinsHex(tileObj.getPosition())
  for res, amt in pairs(rule.basic.cost or {}) do
    if amt > 0 then
      if onRuins and (res == "wood" or res == "stone" or res == "metal") then
        table.insert(shelterIgnored, tostring(amt) .. " " .. RES_LABEL[res])
      else
        costCopy[res] = amt
      end
    end
  end
  local ok, details = payCost(costCopy)
  if not ok then
    broadcastToAll("Cannot place " .. rule.basic.name .. " — missing: " .. table.concat(details, ", "), {0.96, 0.48, 0.44})
    return
  end
  if not state.placedTileGuids or not state.placedTileGuids[tileObj.getGUID()] then
    spendAction(1)
  end
  local msg = "Placed " .. rule.basic.name
  if #details > 0 then msg = msg .. " (" .. table.concat(details, ", ") .. ")" else msg = msg .. " (Free!)" end
  if #shelterIgnored > 0 then msg = msg .. " [Shelter in the Ruins ignored: " .. table.concat(shelterIgnored, ", ") .. "]" end
  broadcastToAll(msg, {0.86, 0.92, 0.78})
end

function upgradeTile(tileObj)
  local id = tileObj.getGMNotes() or ""
  local rule = CONFIG.tileRules[id]
  if not rule or rule.kind ~= "core" then return end
  if isTileUpgraded(tileObj) then
    broadcastToAll(rule.upgraded.name .. " is already Upgraded!", {0.96, 0.78, 0.44})
    return
  end

  -- Auto-detect Workshops (-1 adjacent) or Makers Conclave (-2 settlement-wide) once-per-round discount!
  local costMap = {}
  for res, amt in pairs(rule.upgraded.cost or {}) do costMap[res] = amt end
  local discountAmt, discountObj, discountLabel = 0, nil, nil
  local p1 = tileObj.getPosition()
  for _, other in ipairs(getAllObjects()) do
    if other ~= tileObj and (other.getGMNotes() or "") == "c13_workshops" and isOnMapBoard(other.getPosition()) then
      local oToks = getTokensOnTile(other)
      if #oToks.strain < 3 and #oToks.cooldown == 0 then
        local oUp = isTileUpgraded(other)
        local dist = math.sqrt((p1.x - other.getPosition().x)^2 + (p1.z - other.getPosition().z)^2)
        if oUp and discountAmt < 2 then
          discountAmt, discountObj, discountLabel = 2, other, "Makers Conclave (-2)"
        elseif (not oUp) and dist <= 2.65 and discountAmt < 1 then
          discountAmt, discountObj, discountLabel = 1, other, "Workshops (-1)"
        end
      end
    end
  end

  local discounted = 0
  while discounted < discountAmt do
    local bestRes, bestAmt = nil, 0
    for res, amt in pairs(costMap) do
      if amt > bestAmt then bestRes, bestAmt = res, amt end
    end
    if not bestRes then break end
    costMap[bestRes] = costMap[bestRes] - 1
    discounted = discounted + 1
  end

  local ok, details = payCost(costMap)
  if not ok then
    broadcastToAll("Cannot upgrade to " .. rule.upgraded.name .. " — missing: " .. table.concat(details, ", "), {0.96, 0.48, 0.44})
    return
  end
  if discounted > 0 and discountObj then
    spawnTokenOnTile(CONFIG.guids.cooldownXBag, discountObj, 0.55, -0.45)
  end
  tileObj.flip()
  spendAction(1)
  local msg = "[AUTO] Upgraded to " .. rule.upgraded.name
  if #details > 0 then msg = msg .. " (" .. table.concat(details, ", ") .. ")" else msg = msg .. " (Free!)" end
  if discounted > 0 and discountLabel then msg = msg .. " [" .. discountLabel .. " applied!]" end
  broadcastToAll(msg, {0.94, 0.86, 0.56})
end

function addStrainToTile(tileObj)
  local toks = getTokensOnTile(tileObj)
  if #toks.supported > 0 then
    toks.supported[1].destruct()
    broadcastToAll("Supported Shield prevented 1 Strain on " .. tileObj.getName() .. " (shield consumed)!", {0.92, 0.80, 0.46})
    return
  end
  local n = #toks.strain
  local offX = -0.55 + (n % 3) * 0.42
  spawnTokenOnTile(CONFIG.guids.strainBag, tileObj, offX, 0.48)
  if n + 1 >= 3 then
    broadcastToAll(tileObj.getName() .. " reached 3 Strain — OVERSTRAINED! (Stops working/scoring & spreads 1 Strain to a neighbour!)", {0.98, 0.36, 0.36})
  else
    broadcastToAll("+1 Strain on " .. tileObj.getName() .. " (" .. tostring(n + 1) .. " total).", {0.95, 0.68, 0.58})
  end
end

function removeStrainFromTile(tileObj)
  local toks = getTokensOnTile(tileObj)
  if #toks.strain == 0 then
    broadcastToAll(tileObj.getName() .. " has no Strain tokens to remove.", {0.88, 0.88, 0.82})
    return
  end
  toks.strain[1].destruct()
  broadcastToAll("-1 Strain on " .. tileObj.getName() .. " (" .. tostring(#toks.strain - 1) .. " remaining).", {0.78, 0.94, 0.82})
end

function addSupportedToTile(tileObj)
  spawnTokenOnTile(CONFIG.guids.supportedBag, tileObj, -0.55, -0.45)
  broadcastToAll("Placed Supported Shield on " .. tileObj.getName() .. " (single-use Strain prevention).", {0.92, 0.82, 0.52})
end

-- ---------------------------------------------------------------------------
-- Smart Encounter Card Resolution (Arrivals & Burdens)
-- ---------------------------------------------------------------------------
function addTimerToArrivalCard(cardObj)
  local p = cardObj.getPosition()
  local hits = Physics.cast({
    origin = {p.x, p.y + 3, p.z},
    direction = {0, -1, 0},
    type = 3,
    size = {2.1, 3.5, 3.2},
    max_distance = 5
  })
  local count = 0
  for _, hit in ipairs(hits) do
    local o = hit.hit_object
    if o and o.getName() == "Arrival Timer" and not o.getLock() then count = count + 1 end
  end
  if count >= 3 then
    broadcastToAll(cardObj.getName() .. " already has the maximum 3 Arrival Timers!", {0.96, 0.78, 0.44})
    return
  end
  local bag = getObjectFromGUID(CONFIG.guids.arrivalTimerBag)
  if not bag then return end
  local offsets = { {-0.66, 0.50, -1.78}, {0.0, 0.50, -1.78}, {0.66, 0.50, -1.78} }
  local off = offsets[count + 1] or {0, 0.50, -1.78}
  bag.takeObject({
    position = {p.x + off[1], p.y + off[2], p.z + off[3]},
    rotation = {0, 180, 0},
    smooth = true
  })
  broadcastToAll("[AUTO] +1 Arrival Timer on " .. cardObj.getName() .. " (" .. tostring(count + 1) .. "/3).", {0.72, 0.92, 0.98})
end

function clearTimersOnCard(cardObj)
  local p = cardObj.getPosition()
  local hits = Physics.cast({
    origin = {p.x, p.y + 3, p.z},
    direction = {0, -1, 0},
    type = 3,
    size = {2.1, 3.5, 3.2},
    max_distance = 5
  })
  for _, hit in ipairs(hits) do
    local o = hit.hit_object
    if o and o.getName() == "Arrival Timer" and not o.getLock() then
      o.destruct()
    end
  end
end

function discardEncounterCard(cardObj)
  clearTimersOnCard(cardObj)
  local dp = CONFIG.positions.encounterDiscard
  cardObj.setPositionSmooth({dp[1], dp[2] + 0.5, dp[3]}, false, true)
  cardObj.setRotationSmooth({0, 180, 0}, false, true)
  broadcastToAll("Discarded " .. cardObj.getName() .. ".", {0.82, 0.82, 0.78})
end

function resolveArrivalCard(cardObj)
  local id = cardObj.getGMNotes() or ""
  local erule = CONFIG.encounterRules[id]
  if not erule or erule.type ~= "arrival" then return end
  local ok, details = payCost(erule.cost or {})
  if not ok then
    broadcastToAll("Cannot welcome " .. cardObj.getName() .. " — missing: " .. table.concat(details, ", "), {0.96, 0.48, 0.44})
    return
  end
  discardEncounterCard(cardObj)
  local unlocked = {}
  for _, num in ipairs(erule.unlockNums or {}) do
    if unlockSpecialByNumber(num) then
      table.insert(unlocked, "#" .. tostring(num))
    end
  end
  broadcastToAll(
    string.format("WELCOMED Arrival: %s (%s)! Unlocked Special Tile %s (0 Actions to place)!",
      cardObj.getName(), table.concat(details, ", "), table.concat(unlocked, " & ")),
    {0.72, 0.94, 0.98}
  )
end

function resolveBurdenCard(cardObj)
  local id = cardObj.getGMNotes() or ""
  local erule = CONFIG.encounterRules[id]
  if not erule or erule.type ~= "burden" then return end
  local seasonNum, seasonRoman = getSeason(state.round)
  local amt = seasonNum * 2 + 1
  local costMap = { [erule.res] = amt }
  local ok, details = payCost(costMap)
  if not ok then
    broadcastToAll(
      string.format("Cannot resolve %s (Season %s) — missing: %s", cardObj.getName(), seasonRoman, table.concat(details, ", ")),
      {0.96, 0.48, 0.44}
    )
    return
  end
  discardEncounterCard(cardObj)
  broadcastToAll(
    string.format("RESOLVED Burden: %s (Season %s: %s)!", cardObj.getName(), seasonRoman, table.concat(details, ", ")),
    {0.78, 0.96, 0.78}
  )
end

-- ---------------------------------------------------------------------------
-- Turn & Action Tracker + Live Score Calculator
-- ---------------------------------------------------------------------------
function spendAction(n)
  state.actionsLeft = math.max(0, (state.actionsLeft or 0) - (n or 1))
  refreshHud()
end

function onHudActMinus()
  spendAction(1)
end

function onHudActPlus()
  local maxAct = (SETUP_RULES[state.playerCount] or SETUP_RULES[2]).actions
  state.actionsLeft = math.min(maxAct + 2, (state.actionsLeft or 0) + 1)
  refreshHud()
end

function onHudNextTurn()
  local rules = SETUP_RULES[state.playerCount] or SETUP_RULES[2]
  state.currentTurnIdx = (state.currentTurnIdx % state.playerCount) + 1
  state.actionsLeft = rules.actions
  refreshHud()
  if state.currentTurnIdx == state.firstPlayerIdx then
    broadcastToAll("All players have taken a turn this round! Click END ROUND when ready.", {0.96, 0.86, 0.52})
  else
    local st = CONFIG.stewards[state.currentTurnIdx]
    local stName = st and st.name or ("Seat " .. tostring(state.currentTurnIdx))
    broadcastToAll(string.format("Next Turn: Seat %d (%s) — %d Actions.", state.currentTurnIdx, stName, rules.actions), {0.86, 0.92, 0.98})
  end
end

function getSeatSteward(seatIdx)
  local ord = state.stewardOrder or { 1, 2, 3, 4, 5, 6 }
  local sIdx = ord[seatIdx] or seatIdx
  return CONFIG.stewards[sIdx] or CONFIG.stewards[1], sIdx
end

function onHudUsePower()
  local st, sIdx = getSeatSteward(state.currentTurnIdx)
  if not state.powerUsed then state.powerUsed = { false, false, false, false, false, false } end
  if state.powerUsed[sIdx] then
    broadcastToAll(st.name .. " already used their Once-Per-Season Power this Season (refreshes next Season).", {0.96, 0.72, 0.44})
    return
  end
  state.powerUsed[sIdx] = true
  refreshHud()
  broadcastToAll("STEWARD POWER USED — " .. st.name .. ": " .. (st.powerText or ""), {0.96, 0.86, 0.50})
end

function onHudShuffleStewards()
  local ord = { 1, 2, 3, 4, 5, 6 }
  for i = 6, 2, -1 do
    local j = math.random(1, i)
    ord[i], ord[j] = ord[j], ord[i]
  end
  state.stewardOrder = ord
  local names = {}
  for seat = 1, 6 do
    local st = CONFIG.stewards[ord[seat]]
    local pawn = st and getObjectFromGUID(st.pawnGuid)
    if pawn then
      if seat <= state.playerCount then
        local hp = st.startHexPos
        pawn.setPositionSmooth({hp[1], hp[2] + 0.5, hp[3]}, false, true)
        pawn.setRotationSmooth({0, 180, 0}, false, true)
        table.insert(names, string.format("Seat %d: %s (%s)", seat, st.name, st.startHexId))
      else
        pawn.setPositionSmooth({st.homePawnPos[1], st.homePawnPos[2], st.homePawnPos[3]}, false, true)
      end
    end
  end
  refreshHud()
  broadcastToAll("Shuffled Stewards -> " .. table.concat(names, " | "), {0.86, 0.84, 0.98})
end

function onHudPullTravelExt()
  local bag = getObjectFromGUID(CONFIG.guids.travelExtBag)
  if not bag or bag.getQuantity() == 0 then
    broadcastToAll("No Travel Extensions remain in supply.", {0.95, 0.72, 0.42})
    return
  end
  local sp = CONFIG.positions.coreStaging
  bag.takeObject({
    position = {sp[1] + math.random(-4, 4) * 0.12, sp[2] + 0.6, sp[3] + math.random(-4, 4) * 0.12},
    rotation = {0, 180, 0},
    smooth = true
  })
  broadcastToAll("Pulled Travel Extension hex (Basic side up, press F to flip to Upgraded).", {0.86, 0.94, 0.80})
end

function scanTableScore()
  local popTotal, renownTotal, strainTotal, workingTiles, overstrainedTiles, activeBurdens = 0, 0, 0, 0, 0, 0
  local workingList = {}
  for _, obj in ipairs(getAllObjects()) do
    local p = obj.getPosition()
    local id = obj.getGMNotes() or ""
    if CONFIG.tileRules[id] and isOnMapBoard(p) then
      local rule = CONFIG.tileRules[id]
      local toks = getTokensOnTile(obj)
      if #toks.strain >= 3 then
        overstrainedTiles = overstrainedTiles + 1
      else
        workingTiles = workingTiles + 1
        local upgraded = (rule.kind == "core") and isTileUpgraded(obj)
        local face = upgraded and rule.upgraded or rule.basic
        popTotal = popTotal + ((face and face.pop) or rule.pop or 0)
        renownTotal = renownTotal + ((face and face.renown) or rule.renown or 0)
        table.insert(workingList, { obj = obj, id = id, rule = rule, up = upgraded, p = p })
      end
    elseif obj.getName() == "Strain Token" and not obj.getLock() and isOnMapBoard(p) then
      strainTotal = strainTotal + 1
    elseif CONFIG.encounterRules[id] and CONFIG.encounterRules[id].type == "burden" then
      for _, s in ipairs(CONFIG.positions.inPlaySlots) do
        if math.abs(p.x - s[1]) < 1.8 and math.abs(p.z - s[3]) < 2.2 then
          activeBurdens = activeBurdens + 1
          break
        end
      end
    end
  end

  -- Auto-add Housing cluster Population bonus & Upgraded Housing Travel-adjacent Renown (v7.0)
  local housingBonus = {
    c05_cabin = { bPop = 2, uPop = 3, uRen = 2 },
    c06_cottage = { bPop = 3, uPop = 5, uRen = 3 },
    c07_stedding = { bPop = 5, uPop = 7, uRen = 5 }
  }
  for _, w in ipairs(workingList) do
    local hb = housingBonus[w.id]
    if hb then
      local adjHousing, adjTravel = false, false
      for _, o in ipairs(workingList) do
        if o ~= w then
          local dist = math.sqrt((w.p.x - o.p.x)^2 + (w.p.z - o.p.z)^2)
          if dist <= 2.65 then
            if o.rule.category == "housing" then adjHousing = true end
            if o.rule.category == "travel" then adjTravel = true end
          end
        end
      end
      if adjHousing then popTotal = popTotal + (w.up and hb.uPop or hb.bPop) end
      if w.up and adjTravel then renownTotal = renownTotal + hb.uRen end
    end
  end

  return {
    working = workingTiles, overstrained = overstrainedTiles,
    pop = popTotal, renown = renownTotal,
    strain = strainTotal, burdens = activeBurdens
  }
end

function updateScoreModal()
  local s = scanTableScore()
  local questPts = state.scoreQuest and 20 or 0
  local objPts = (state.scoreObj or 0) * 15
  local goldPts = (state.scoreGold or 0) * 5
  local failPen = (state.scoreFailedArrivals or 0) * 10
  local total = s.pop + s.renown + questPts + objPts + goldPts - (s.strain * 10) - (s.burdens * 10) - failPen
  UI.setAttribute("scMapSummary", "text", string.format("Working Tiles: %d  |  Overstrained: %d", s.working, s.overstrained))
  UI.setAttribute("scAutoLines", "text", string.format("Population: +%d  |  Tile Renown: +%d\nStrain (%d): -%d  |  Active Burdens (%d): -%d", s.pop, s.renown, s.strain, s.strain * 10, s.burdens, s.burdens * 10))
  UI.setAttribute("btnScQuest", "text", state.scoreQuest and "YES (+20)" or "NO (+0)")
  UI.setAttribute("btnScQuest", "color", state.scoreQuest and "#2d5a36" or "#342e26")
  UI.setAttribute("scObjVal", "text", string.format("%d (+%d)", state.scoreObj or 0, objPts))
  UI.setAttribute("scGoldVal", "text", string.format("%d (+%d)", state.scoreGold or 0, goldPts))
  UI.setAttribute("scFailVal", "text", string.format("%d (-%d)", state.scoreFailedArrivals or 0, failPen))
  UI.setAttribute("scTotal", "text", "TOTAL SETTLEMENT SCORE: " .. tostring(total))
  return s, total
end

function onHudOpenScoreSheet()
  updateScoreModal()
  UI.setAttribute("qvScoreModal", "active", "true")
end

function onHudCloseScoreSheet()
  UI.setAttribute("qvScoreModal", "active", "false")
end

function onScoreToggleQuest()
  state.scoreQuest = not state.scoreQuest
  updateScoreModal()
end

function onScoreAdjObj(_, deltaStr)
  local d = tonumber(deltaStr) or 0
  state.scoreObj = math.max(0, math.min(state.playerCount, (state.scoreObj or 0) + d))
  updateScoreModal()
end

function onScoreAdjGold(_, deltaStr)
  local d = tonumber(deltaStr) or 0
  state.scoreGold = math.max(0, math.min(5, (state.scoreGold or 0) + d))
  updateScoreModal()
end

function onScoreAdjFail(_, deltaStr)
  local d = tonumber(deltaStr) or 0
  state.scoreFailedArrivals = math.max(0, (state.scoreFailedArrivals or 0) + d)
  updateScoreModal()
end

function onHudRefreshScore()
  updateScoreModal()
end

function onHudBroadcastScore()
  local s, total = updateScoreModal()
  broadcastToAll(
    string.format(
      "FINAL / LIVE SCORE: %d pts | Pop +%d, Tile Renown +%d, Quest +%d, Stewards +%d, Golden +%d | Strain -%d, Burdens -%d, Failed Arrivals -%d",
      total, s.pop, s.renown, state.scoreQuest and 20 or 0, (state.scoreObj or 0) * 15, (state.scoreGold or 0) * 5,
      s.strain * 10, s.burdens * 10, (state.scoreFailedArrivals or 0) * 10
    ),
    {0.96, 0.88, 0.54}
  )
end

function onHudCalcScore()
  onHudOpenScoreSheet()
end

-- ---------------------------------------------------------------------------
-- XmlUI HUD Handlers
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Interactive 9-Card Encounter Seeding Modal (replaces cramped bottom hand!)
-- ---------------------------------------------------------------------------
local seedSession = {
  active = false,
  playerIdx = 1,
  hands = {},       -- hands[p] = { { guid, gm_notes, name, band=0 }, ... } (9 cards)
  neutral = {},     -- { guid, ... } (3*P cards)
  bands = { {}, {}, {} } -- accumulated { guid, ... } for S1, S2, S3
}

function shuffleList(tbl)
  for i = #tbl, 2, -1 do
    local j = math.random(1, i)
    tbl[i], tbl[j] = tbl[j], tbl[i]
  end
  return tbl
end

function startSeedingSession(encDeck, playerCount)
  if not encDeck or encDeck.tag ~= "Deck" then return end
  local objs = encDeck.getObjects()
  seedSession = {
    active = true,
    season = 1,
    playerIdx = 1,
    hands = {},
    picks = {}
  }
  local cursor = 1
  local dealQueue = {}
  for p = 1, playerCount do
    local hand = {}
    local color = SEAT_COLORS[p]
    local ht = Player[color] and Player[color].getHandTransform()
    local seatFallback = CONFIG.positions.seatMarkers[p] or { 0, 2.0, -21.8 }
    local targetPos = ht and ht.position or { x = seatFallback[1], y = 2.4, z = seatFallback[3] }
    local targetRotY = ht and ht.rotation and ht.rotation.y or 0
    for k = 1, 9 do
      local item = objs[cursor]
      if item then
        table.insert(hand, { guid = item.guid, note = item.gm_notes or "", name = item.name or "Card", band = 0 })
        table.insert(dealQueue, { guid = item.guid, color = color, pos = targetPos, rotY = targetRotY, slot = k })
        cursor = cursor + 1
      end
    end
    seedSession.hands[p] = hand
  end

  -- Physically deal each player's 9 cards into their own hand zone so unseeded cards stay in their hands!
  -- The remaining 3*P neutral cards stay right on the ENCOUNTER draw well as the starting Encounter Deck.
  local idx = 1
  local function dealNext()
    if idx > #dealQueue then
      renderSeedingModal()
      UI.setAttribute("qvSeedingModal", "active", "true")
      return
    end
    local d = dealQueue[idx]
    idx = idx + 1
    local src = findEncounterDrawDeck()
    if src and src.tag == "Deck" and src.getQuantity() > 1 then
      local isSeated = Player[d.color] and Player[d.color].seated
      local spread = (d.slot - 5) * 0.35
      local px = d.pos.x + (isSeated and 0 or spread)
      local py = isSeated and (d.pos.y + 0.2) or (1.35 + d.slot * 0.04)
      local pz = d.pos.z
      local rot = isSeated and { 0, d.rotY + 180, 0 } or { 0, d.rotY + 180, 180 }
      src.takeObject({
        guid = d.guid,
        position = { px, py, pz },
        rotation = rot,
        smooth = false
      })
    end
    Wait.frames(dealNext, 1)
  end
  dealNext()
end

function openSeasonSeeding(seasonNum)
  if not seedSession or not seedSession.hands or not seedSession.hands[1] or #seedSession.hands[1] < 3 then
    return false
  end
  seedSession.active = true
  seedSession.season = seasonNum
  seedSession.playerIdx = 1
  seedSession.picks = {}
  for p = 1, state.playerCount do
    for _, c in ipairs(seedSession.hands[p] or {}) do c.band = 0 end
  end
  renderSeedingModal()
  UI.setAttribute("qvSeedingModal", "active", "true")
  return true
end

function renderSeedingModal()
  local p = seedSession.playerIdx
  local hand = seedSession.hands[p] or {}
  local st = getSeatSteward(p)
  local stName = st and st.name or ("Player " .. tostring(p))
  local romans = { "I", "II", "III" }
  local sRoman = romans[seedSession.season or 1] or "I"
  UI.setAttribute(
    "seedHeader",
    "text",
    string.format("SEASON %s SEEDING — PLAYER %d OF %d (%s)  |  PICK 1 TOP / 1 MID / 1 BOT (%d IN HAND)", sRoman, p, state.playerCount, stName, #hand)
  )

  local counts = { 0, 0, 0 }
  for _, c in ipairs(hand) do
    if c.band >= 1 and c.band <= 3 then counts[c.band] = counts[c.band] + 1 end
  end
  UI.setAttribute(
    "seedCounts",
    "text",
    string.format("Top of Deck: %d/1    |    Middle of Deck: %d/1    |    Bottom of Deck: %d/1   (remaining %d saved for next Season)", counts[1], counts[2], counts[3], math.max(0, #hand - 3))
  )

  for i = 1, 9 do
    local c = hand[i]
    if c then
      UI.setAttribute("seedRow" .. i, "active", "true")
      local er = CONFIG.encounterRules[c.note]
      local t = er and er.type or "boon"
      local tagText = (t == "burden" and "BURDEN") or (t == "arrival" and "ARRIVAL") or "BOON"
      local tagColor = (t == "burden" and "#f08478") or (t == "arrival" and "#82c6f0") or "#9ed68c"
      local summary = (er and er.summary) or ""
      UI.setAttribute("seedTag" .. i, "text", tagText)
      UI.setAttribute("seedTag" .. i, "color", tagColor)
      UI.setAttribute("seedName" .. i, "text", c.name)
      UI.setAttribute("seedDesc" .. i, "text", summary)
      for b = 1, 3 do
        local btnId = "seedBtn" .. i .. "_" .. b
        local activeCol = (b == 1 and "#3b6e3c") or (b == 2 and "#8a6622") or "#523a64"
        UI.setAttribute(btnId, "color", (c.band == b) and activeCol or "#2e2922")
      end
    else
      UI.setAttribute("seedRow" .. i, "active", "false")
    end
  end

  local isLast = (p >= state.playerCount)
  UI.setAttribute(
    "btnSeedConfirm",
    "text",
    isLast and ("CONFIRM & SEED SEASON " .. sRoman .. " DECK") or ("CONFIRM PLAYER " .. p .. " -> PLAYER " .. (p + 1))
  )
end

function onHudOpenSeeding()
  if not seedSession.active then
    local seasonNum = getSeason(state.round)
    if openSeasonSeeding(seasonNum) then return end
    local encDeck = findEncounterDrawDeck()
    if encDeck and encDeck.tag == "Deck" then
      startSeedingSession(encDeck, state.playerCount)
    else
      broadcastToAll("Click 1P–5P Setup first to create the Encounter pool for seeding.", {0.96, 0.78, 0.44})
    end
    return
  end
  renderSeedingModal()
  UI.setAttribute("qvSeedingModal", "active", "true")
end

function onHudCloseSeeding()
  UI.setAttribute("qvSeedingModal", "active", "false")
end

function onSeedPick(_, arg)
  local rowStr, bandStr = string.match(arg or "", "(%d+):(%d+)")
  local row, band = tonumber(rowStr), tonumber(bandStr)
  local hand = seedSession.hands[seedSession.playerIdx]
  if not row or not band or not hand or not hand[row] then return end

  if hand[row].band == band then
    hand[row].band = 0
  else
    -- 1 card per slot (TOP / MID / BOT): moving a slot clears it from any previous row smoothly
    for _, c in ipairs(hand) do
      if c.band == band then c.band = 0 end
    end
    hand[row].band = band
  end
  renderSeedingModal()
end

function onSeedAutoFill()
  local hand = seedSession.hands[seedSession.playerIdx]
  if not hand then return end
  local hasBand = { false, false, false }
  for _, c in ipairs(hand) do
    if c.band >= 1 and c.band <= 3 then hasBand[c.band] = true end
  end
  for b = 1, 3 do
    if not hasBand[b] then
      for _, c in ipairs(hand) do
        if c.band == 0 then
          c.band = b
          hasBand[b] = true
          break
        end
      end
    end
  end
  renderSeedingModal()
end

function onSeedConfirmPlayer()
  local p = seedSession.playerIdx
  local hand = seedSession.hands[p] or {}
  local topGuid, midGuid, botGuid = nil, nil, nil
  for _, c in ipairs(hand) do
    if c.band == 1 then topGuid = c.guid
    elseif c.band == 2 then midGuid = c.guid
    elseif c.band == 3 then botGuid = c.guid end
  end
  if not topGuid or not midGuid or not botGuid then
    broadcastToAll("Pick 1 TOP, 1 MID, and 1 BOT card for this Season (or click AUTO-PICK 1 / 1 / 1).", {0.96, 0.72, 0.42})
    return
  end
  -- Remove the 3 seeded cards from this player's remaining hand (9 -> 6 -> 3 -> 0)
  local remaining = {}
  for _, c in ipairs(hand) do
    if c.guid ~= topGuid and c.guid ~= midGuid and c.guid ~= botGuid then
      c.band = 0
      table.insert(remaining, c)
    end
  end
  seedSession.hands[p] = remaining
  seedSession.picks[p] = { top = topGuid, mid = midGuid, bot = botGuid }

  if p < state.playerCount then
    seedSession.playerIdx = p + 1
    renderSeedingModal()
    broadcastToAll("[AUTO] Player " .. p .. " seeded 3 cards! Now seeding for Player " .. (p + 1) .. ".", {0.82, 0.92, 0.98})
  else
    finalizeModalSeededDeck()
  end
end

function finalizeModalSeededDeck()
  UI.setAttribute("qvSeedingModal", "active", "false")
  seedSession.active = false
  local encDeck = findEncounterDrawDeck()
  local drawPos = CONFIG.positions.encounterDraw

  -- Build exact v7.0 deck order (index 1 = TOP of deck, #order = BOTTOM of deck):
  -- Start with current Encounter Deck cards, then for each player insert TOP at 1, MID at floor(len/2)+1, BOT at end.
  local order = {}
  if encDeck then
    if encDeck.tag == "Deck" then
      for _, o in ipairs(encDeck.getObjects()) do
        table.insert(order, o.guid)
      end
    elseif encDeck.tag == "Card" then
      table.insert(order, encDeck.getGUID())
    end
  end

  for p = 1, state.playerCount do
    local pk = seedSession.picks[p]
    if pk then
      table.insert(order, 1, pk.top)
      table.insert(order, math.floor(#order / 2) + 1, pk.mid)
      table.insert(order, pk.bot)
    end
  end

  -- Move current Encounter Deck temporarily aside so we can re-stack every card cleanly from BOTTOM (#order) to TOP (1)
  -- onto drawPos, while leaving each player's unseeded cards untouched in their hands!
  local tmpPos = { drawPos[1] - 3.8, drawPos[2] + 0.5, drawPos[3] }
  if encDeck then
    encDeck.setPosition(tmpPos)
    encDeck.setRotation({ 0, 180, 180 })
  end

  Wait.time(function()
    local i = #order
    local placed = 0
    local function stackNext()
      if i < 1 then
        Wait.time(function()
          local finalDeck = findEncounterDrawDeck()
          local romans = { "I", "II", "III" }
          local sRoman = romans[seedSession.season or 1] or "I"
          if finalDeck then
            finalDeck.setName("Encounter Deck (Season " .. sRoman .. ")")
          end
          state.activeTab = "play"
          refreshHud()
          broadcastToAll(
            string.format("[AUTO] Season %s Encounter Deck built (%d cards in exact Top/Mid/Bot order; unseeded cards remain in players' hands)! Click REVEAL ENCOUNTERS to begin Round %d.", sRoman, #order, state.round),
            {0.80, 0.96, 0.78}
          )
        end, 0.45)
        return
      end

      local g = order[i]
      i = i - 1
      local targetP = { drawPos[1], drawPos[2] + 0.45 + placed * 0.08, drawPos[3] }
      placed = placed + 1

      -- 1. Live standalone card (in a player's hand, on the table, or last remaining card from tmpPos)
      local liveCard = getObjectFromGUID(g)
      if liveCard then
        liveCard.setRotation({ 0, 180, 180 })
        liveCard.setPosition(targetP)
      else
        -- 2. Card still inside the temporary Encounter Deck at tmpPos (or a seat's unseated stack)
        local src = findDeckOrCardAt(tmpPos)
        if src and src.tag == "Deck" then
          if src.getQuantity() > 1 then
            src.takeObject({ guid = g, position = targetP, rotation = { 0, 180, 180 }, smooth = false })
          else
            src.setRotation({ 0, 180, 180 })
            src.setPosition(targetP)
          end
        elseif src then
          src.setRotation({ 0, 180, 180 })
          src.setPosition(targetP)
        else
          -- Fallback: scan any deck on the table that might hold g (e.g., an unseated player's stacked hand)
          for _, obj in ipairs(getAllObjects()) do
            if obj.tag == "Deck" then
              local found = false
              for _, co in ipairs(obj.getObjects()) do
                if co.guid == g then found = true; break end
              end
              if found then
                if obj.getQuantity() > 1 then
                  obj.takeObject({ guid = g, position = targetP, rotation = { 0, 180, 180 }, smooth = false })
                else
                  obj.setRotation({ 0, 180, 180 })
                  obj.setPosition(targetP)
                end
                break
              end
            end
          end
        end
      end

      -- 2-frame stagger guarantees TTS merges every card cleanly into ONE solid Encounter Deck!
      Wait.frames(stackNext, 2)
    end
    stackNext()
  end, 0.35)
end

function onHudTab(_, tabName)
  state.activeTab = tabName or "play"
  refreshHud()
end

function onHudBuildSeededDeck()
  buildSeededDeck()
end

function seedCardToBand(cardObj, band)
  local posMap = {
    [1] = CONFIG.positions.seedS1,
    [2] = CONFIG.positions.seedS2,
    [3] = CONFIG.positions.seedS3
  }
  local p = posMap[band]
  if not p then return end
  cardObj.setRotation({0, 180, 180})
  cardObj.setPositionSmooth({p[1], p[2] + 0.5, p[3]}, false, true)
  local labels = { "Season I (Top)", "Season II (Middle)", "Season III (Bottom)" }
  broadcastToAll("[AUTO] Seeded a card into " .. labels[band] .. ".", {0.82, 0.90, 0.98})
end

function findDeckOrCardAt(pos)
  local hits = Physics.cast({
    origin = {pos[1], pos[2] + 4, pos[3]},
    direction = {0, -1, 0},
    type = 3,
    size = {2.2, 4, 3.2},
    max_distance = 6
  })
  for _, h in ipairs(hits) do
    local o = h.hit_object
    if o and (o.tag == "Deck" or o.tag == "Card") then return o end
  end
  return nil
end

function buildSeededDeck()
  local drawPos = CONFIG.positions.encounterDraw
  -- Also fold any remaining un-seeded Encounter Deck cards into Season bands or keep at bottom,
  -- then stack Season III (bottom) -> Season II (middle) -> Season I (top) cleanly!
  local bands = {
    { pos = CONFIG.positions.seedS3, label = "Season III" },
    { pos = CONFIG.positions.seedS2, label = "Season II" },
    { pos = CONFIG.positions.seedS1, label = "Season I" }
  }
  local foundAny = false
  local yOffset = 0.5
  for idx, b in ipairs(bands) do
    local stack = findDeckOrCardAt(b.pos)
    if stack then
      foundAny = true
      if stack.tag == "Deck" then stack.shuffle() end
      local delay = (idx - 1) * 0.45
      local myY = yOffset
      yOffset = yOffset + 1.2
      Wait.time(function()
        stack.setRotation({0, 180, 180})
        stack.setPosition({drawPos[1], drawPos[2] + myY, drawPos[3]})
      end, delay)
    end
  end
  if not foundAny then
    broadcastToAll("No cards seeded in Season I/II/III stacks yet — right-click cards in your hand -> Seed -> Season I/II/III (or click QUICK-SEED).", {0.96, 0.78, 0.44})
    return
  end
  state.activeTab = "play"
  refreshHud()
  broadcastToAll("[AUTO] Built Seeded Encounter Deck (Season I on top -> Season II -> Season III on bottom)! Ready for Round 1.", {0.80, 0.96, 0.78})
end

function onHudToggle()
  state.hudCollapsed = not state.hudCollapsed
  refreshHud()
end

function onHudSetup(_, playerCountStr)
  local p = tonumber(playerCountStr)
  if p then runSetup(p) end
end

function onHudQuickSeed() runQuickSeed() end
function onHudRevealEncounters() revealEncounters() end
function onHudDrawTarget() drawTargetCard() end
function onHudEndRound() onEndRound() end
function onHudUnlockPrev() onUnlockPrev(nil, nil, false) end
function onHudUnlockNext() onUnlockNext(nil, nil, false) end
function onHudUnlockTile() onUnlockTile() end
local tileMenuOpen = false

function onHudToggleTileMenu()
  tileMenuOpen = not tileMenuOpen
  UI.setAttribute("qvTileMenuModal", "active", tileMenuOpen and "true" or "false")
end

function onHudPullCoreByIdx(_, idxStr)
  local idx = tonumber(idxStr)
  if idx then pullCoreTile(idx) end
end

function onHudPullCoreTile() pullCoreTile(state.coreIdx) end

function onHudWhPlus(_, idxStr)
  local idx = tonumber(idxStr)
  local c = idx and getObjectFromGUID(CONFIG.guids.warehouseCounters[idx])
  if c then c.call("adjust", 1) end
  syncWarehouseHud()
end

function onHudWhMinus(_, idxStr)
  local idx = tonumber(idxStr)
  local c = idx and getObjectFromGUID(CONFIG.guids.warehouseCounters[idx])
  if c then c.call("adjust", -1) end
  syncWarehouseHud()
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
  local tab = state.activeTab or "play"
  UI.setAttribute("qvHudBody", "active", state.hudCollapsed and "false" or "true")
  UI.setAttribute("qvHudRoot", "height", state.hudCollapsed and "36" or "488")
  UI.setAttribute("qvToggleBtn", "text", state.hudCollapsed and "+" or "-")
  UI.setAttribute("panelPlay", "active", tab == "play" and "true" or "false")
  UI.setAttribute("panelTiles", "active", tab == "tiles" and "true" or "false")
  UI.setAttribute("panelSetup", "active", tab == "setup" and "true" or "false")
  UI.setAttribute("tabPlay", "color", tab == "play" and "#8a6522" or "#2a241d")
  UI.setAttribute("tabTiles", "color", tab == "tiles" and "#8a6522" or "#2a241d")
  UI.setAttribute("tabSetup", "color", tab == "setup" and "#8a6522" or "#2a241d")
  UI.setAttribute(
    "qvStatus",
    "text",
    string.format("Season %s  |  Round %d/12  |  %dP (%d Act)", seasonRoman, state.round, state.playerCount, rules.actions)
  )
  local st, sIdx = getSeatSteward(state.currentTurnIdx)
  local stName = st and st.name or ("Seat " .. tostring(state.currentTurnIdx))
  UI.setAttribute(
    "qvTurnInfo",
    "text",
    string.format("Seat %d (%s) · %d/%d", state.currentTurnIdx, stName, state.actionsLeft or rules.actions, rules.actions)
  )
  local used = state.powerUsed and state.powerUsed[sIdx]
  UI.setAttribute("qvPowerStatus", "text", used and (stName .. " Power: USED (next Season)") or (stName .. " Power: READY (1/Season)"))
  UI.setAttribute("qvPowerStatus", "color", used and "#c89b6e" or "#a8d8a2")
  UI.setAttribute("btnUsePower", "color", used and "#38322a" or "#355844")
  UI.setAttribute("btnUsePower", "text", used and "USED" or "USE POWER")

  if not state.roundRevealed then
    UI.setAttribute("qvPhaseCue", "text", "Step 1: Click REVEAL ENCOUNTERS to start Round " .. tostring(state.round))
    UI.setAttribute("btnRevealEnc", "color", "#b07c24")
    UI.setAttribute("btnEndRound", "color", "#26422c")
  else
    UI.setAttribute("qvPhaseCue", "text", "Step 2: Take Actions -> NEXT TURN -> END ROUND")
    UI.setAttribute("btnRevealEnc", "color", "#6e501c")
    UI.setAttribute("btnEndRound", "color", "#30683c")
  end

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
  if entry then UI.setAttribute("hudCoreName", "text", entry.name) end
  syncWarehouseHud()
end

-- 3D Control Plaque UI removed (replaced by the collapsible XmlUI Control HUD)
function buildControlPlaqueUI() end
function buildUnlockPlaqueUI() end
function noop() end

-- ---------------------------------------------------------------------------
-- 1-5P Automated Setup
-- ---------------------------------------------------------------------------
function runSetup(playerCount)
  local rules = SETUP_RULES[playerCount]
  if not rules then return end
  state.playerCount = playerCount
  state.round = 1
  state.firstPlayerIdx = 1
  state.currentTurnIdx = 1
  state.actionsLeft = rules.actions
  state.roundRevealed = false
  state.powerUsed = { false, false, false, false, false, false }
  state.scoreQuest = false
  state.scoreObj = 0
  state.scoreGold = 0
  state.scoreFailedArrivals = 0
  state.placedTileGuids = {}
  state.pawnLastHex = {}

  for _, guid in ipairs(CONFIG.guids.warehouseCounters) do
    local c = getObjectFromGUID(guid)
    if c then c.call("setValue", rules.warehouse) end
  end

  local placedStewards = {}
  local ord = state.stewardOrder or { 1, 2, 3, 4, 5, 6 }
  for seat = 1, 6 do
    local st = CONFIG.stewards[ord[seat]]
    local pawn = st and getObjectFromGUID(st.pawnGuid)
    if pawn then
      if seat <= playerCount then
        local hp = st.startHexPos
        pawn.setPositionSmooth({hp[1], hp[2] + 0.5, hp[3]}, false, true)
        pawn.setRotationSmooth({0, 180, 0}, false, true)
        state.pawnLastHex[st.id] = st.startHexId
        table.insert(placedStewards, st.name .. " (" .. st.startHexId .. ")")
      else
        local home = st.homePawnPos
        pawn.setPositionSmooth({home[1], home[2], home[3]}, false, true)
      end
    end
  end

  local targetDeck = getObjectFromGUID(CONFIG.guids.targetDeck)
  if targetDeck then targetDeck.shuffle() end

  local questDeck = getObjectFromGUID(CONFIG.guids.questDeck)
  if questDeck then
    questDeck.shuffle()
    questDeck.takeObject({ position = CONFIG.positions.activeQuest, rotation = {0, 180, 0}, smooth = true })
  end

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
          rotation = {0, 180, 180}, smooth = false
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

  Wait.time(function()
    local encDeck = findEncounterDrawDeck()
    if encDeck and encDeck.tag == "Deck" then
      encDeck.setName("Encounter Deck (" .. tostring(playerCount) .. "P)")
      encDeck.shuffle()
      startSeedingSession(encDeck, playerCount)
    end
  end, 1.0)

  moveRoundMarker(1)
  movePlayer1Marker(1)
  buildControlPlaqueUI()
  refreshHud()
  broadcastToAll(
    string.format("Setup %dP complete! Stewards: %s | Actions/turn: %d | Warehouse: %d each.",
      playerCount, table.concat(placedStewards, ", "), rules.actions, rules.warehouse),
    {0.94, 0.84, 0.56}
  )
end

function runQuickSeed()
  if seedSession and seedSession.hands and seedSession.hands[1] and #seedSession.hands[1] >= 3 then
    if not seedSession.active then
      openSeasonSeeding(getSeason(state.round))
    end
    for p = seedSession.playerIdx, state.playerCount do
      seedSession.playerIdx = p
      onSeedAutoFill()
      onSeedConfirmPlayer()
    end
    return
  end
  UI.setAttribute("qvSeedingModal", "active", "false")
  seedSession.active = false
  local encDeck = findEncounterDrawDeck()
  if encDeck and encDeck.tag == "Deck" then
    encDeck.shuffle()
    state.activeTab = "play"
    refreshHud()
    broadcastToAll("[AUTO] Encounter Deck shuffled & ready — click REVEAL ENCOUNTERS.", {0.84, 0.95, 0.78})
  end
end

-- ---------------------------------------------------------------------------
-- Reveal Encounters + Auto-Place 3 Arrival Timers + Attach Context Menus
-- ---------------------------------------------------------------------------
function findEncounterDrawDeck()
  local p = CONFIG.positions.encounterDraw
  local hits = Physics.cast({ origin = {p[1], p[2] + 4, p[3]}, direction = {0, -1, 0}, type = 3, size = {2.4, 4, 3.6}, max_distance = 6 })
  for _, hit in ipairs(hits) do
    local obj = hit.hit_object
    if obj and (obj.tag == "Deck" or obj.tag == "Card") then return obj end
  end
  return nil
end

function isSlotOccupied(pos)
  local hits = Physics.cast({ origin = {pos[1], pos[2] + 3, pos[3]}, direction = {0, -1, 0}, type = 3, size = {1.8, 3, 2.8}, max_distance = 5 })
  for _, hit in ipairs(hits) do
    local obj = hit.hit_object
    if obj and (obj.tag == "Card" or obj.tag == "Deck") then return true end
  end
  return false
end

function spawnArrivalTimers(cardPos)
  local bag = getObjectFromGUID(CONFIG.guids.arrivalTimerBag)
  if not bag then return end
  -- Seated cleanly in the 3 printed circles at the base (-Z) of the Arrival card
  local offsets = { {-0.66, 0.50, -1.78}, {0.0, 0.50, -1.78}, {0.66, 0.50, -1.78} }
  for _, off in ipairs(offsets) do
    bag.takeObject({ position = {cardPos[1] + off[1], cardPos[2] + off[2], cardPos[3] + off[3]}, rotation = {0, 180, 0}, smooth = true })
  end
end

function getEncounterCardType(cardObj)
  if not cardObj then return "boon" end
  local note = cardObj.getGMNotes() or ""
  local er = CONFIG.encounterRules and CONFIG.encounterRules[note]
  if er and er.type then return er.type end
  local desc = cardObj.getDescription() or ""
  if string.sub(desc, 1, 7) == "Arrival" then return "arrival" end
  if string.sub(desc, 1, 6) == "Burden" then return "burden" end
  return "boon"
end

function inspectInPlaySlots()
  local slots = CONFIG.positions.inPlaySlots
  local info = {}
  for idx, s in ipairs(slots) do
    -- Cast slightly wider in -Z to catch 50%-overlapping cascades in this column
    local hits = Physics.cast({
      origin = { s[1], s[2] + 3, s[3] - 1.2 },
      direction = { 0, -1, 0 },
      type = 3,
      size = { 2.0, 3, 5.6 },
      max_distance = 5
    })
    local cards = {}
    local seen = {}
    for _, hit in ipairs(hits) do
      local o = hit.hit_object
      if o and o.tag == "Card" and not seen[o.getGUID()] then
        seen[o.getGUID()] = true
        table.insert(cards, o)
      end
    end
    local kind = "empty"
    if #cards > 0 then
      kind = getEncounterCardType(cards[1])
      for _, c in ipairs(cards) do
        if getEncounterCardType(c) == "arrival" then kind = "arrival"; break end
      end
    end
    info[idx] = { idx = idx, pos = s, kind = kind, cards = cards, count = #cards }
  end
  return info
end

function compactSameTypeSlots(slotInfo, targetKind)
  local matching = {}
  for _, si in ipairs(slotInfo) do
    if si.kind == targetKind then table.insert(matching, si) end
  end
  if #matching < 2 then return nil end
  local dst = matching[1]
  local src = matching[#matching]
  local dzStep = -1.55
  local dyStep = 0.06
  for _, card in ipairs(src.cards) do
    local p = { dst.pos[1], dst.pos[2] + 0.25 + dst.count * dyStep, dst.pos[3] + dst.count * dzStep }
    card.setPositionSmooth(p, false, true)
    card.setRotationSmooth({ 0, 180, 0 }, false, true)
    table.insert(dst.cards, card)
    dst.count = dst.count + 1
  end
  src.cards = {}
  src.count = 0
  src.kind = "empty"
  return src
end

function revealEncounters()
  local encDeck = findEncounterDrawDeck()
  if not encDeck then
    broadcastToAll("No Encounter Deck found in ENCOUNTER well! Click 1P–5P Setup first.", {0.96, 0.52, 0.45})
    return
  end
  local slotInfo = inspectInPlaySlots()
  local seasonNum, seasonRoman = getSeason(state.round)
  local burdenCost = seasonNum * 2 + 1
  local dzStep = -1.55 -- 50% vertical overlap so every stacked card's header & count stay clearly visible
  local dyStep = 0.06

  local function findSlotByKind(kind)
    for _, si in ipairs(slotInfo) do
      if si.kind == kind then return si end
    end
    return nil
  end

  local function pickTargetForCard(cardType)
    -- 1. Arrivals MUST NEVER be stacked (their 3 base Timer tokens must remain unobstructed)
    if cardType == "arrival" then
      local empty = findSlotByKind("empty")
      if not empty then empty = compactSameTypeSlots(slotInfo, "burden") end
      if not empty then empty = compactSameTypeSlots(slotInfo, "boon") end
      if empty then
        empty.kind = "arrival"
        empty.count = 1
        return { empty.pos[1], empty.pos[2] + 0.25, empty.pos[3] }, false
      end
      -- Fallback if all 5 slots already hold Arrivals: place cleanly beside the Encounter Board
      local last = CONFIG.positions.inPlaySlots[5]
      return { last[1] + 5.2, last[2] + 0.25, last[3] }, false
    end

    -- 2. Burdens: take an empty slot if plenty of room, otherwise cascade 50% onto existing Burden stack!
    if cardType == "burden" then
      local empty = findSlotByKind("empty")
      local existing = findSlotByKind("burden")
      local emptyCount = 0
      for _, si in ipairs(slotInfo) do if si.kind == "empty" then emptyCount = emptyCount + 1 end end
      if existing and (not empty or emptyCount <= 1) then
        local pos = { existing.pos[1], existing.pos[2] + 0.25 + existing.count * dyStep, existing.pos[3] + existing.count * dzStep }
        existing.count = existing.count + 1
        return pos, true
      elseif empty then
        empty.kind = "burden"
        empty.count = 1
        return { empty.pos[1], empty.pos[2] + 0.25, empty.pos[3] }, false
      else
        local freed = compactSameTypeSlots(slotInfo, "boon")
        if freed then
          freed.kind = "burden"
          freed.count = 1
          return { freed.pos[1], freed.pos[2] + 0.25, freed.pos[3] }, false
        end
        local last = CONFIG.positions.inPlaySlots[5]
        return { last[1], last[2] + 0.35, last[3] + dzStep }, true
      end
    end

    -- 3. Boons: take an empty slot first; if space is low, compact Burdens first, else cascade 50% onto existing Boon stack
    local empty = findSlotByKind("empty")
    if empty then
      empty.kind = "boon"
      empty.count = 1
      return { empty.pos[1], empty.pos[2] + 0.25, empty.pos[3] }, false
    end
    local freed = compactSameTypeSlots(slotInfo, "burden")
    if freed then
      freed.kind = "boon"
      freed.count = 1
      return { freed.pos[1], freed.pos[2] + 0.25, freed.pos[3] }, false
    end
    local existingBoon = findSlotByKind("boon")
    if existingBoon then
      local pos = { existingBoon.pos[1], existingBoon.pos[2] + 0.25 + existingBoon.count * dyStep, existingBoon.pos[3] + existingBoon.count * dzStep }
      existingBoon.count = existingBoon.count + 1
      return pos, true
    end
    local last = CONFIG.positions.inPlaySlots[5]
    return { last[1] + 5.2, last[2] + 0.25, last[3] }, false
  end

  local function handleRevealed(cardObj, slotPos, stacked)
    attachObjectMenus(cardObj)
    local name = cardObj.getName()
    local cType = getEncounterCardType(cardObj)
    local stackNote = stacked and " (cascaded 50% on stack)" or ""
    if cType == "arrival" then
      Wait.time(function() spawnArrivalTimers(slotPos) end, 0.45)
      broadcastToAll("[AUTO] ARRIVAL: " .. name .. " — placed 3 Timers. (Right-click card -> Welcome Arrival when ready)", {0.68, 0.88, 0.98})
    elseif cType == "burden" then
      broadcastToAll(string.format("[MANUAL] BURDEN: %s%s — Apply Season %s reveal effect now! (Right-click -> Resolve for %d)", name, stackNote, seasonRoman, burdenCost), {0.98, 0.62, 0.56})
    else
      broadcastToAll(string.format("[MANUAL] BOON: %s%s — Apply Season %s text, then right-click -> Discard.", name, stackNote, seasonRoman), {0.78, 0.95, 0.72})
    end
  end

  for i = 1, state.playerCount do
    local peekType = "boon"
    if encDeck.tag == "Deck" then
      local objs = encDeck.getObjects()
      if objs and objs[1] then
        local er = CONFIG.encounterRules and CONFIG.encounterRules[objs[1].gm_notes or ""]
        if er and er.type then peekType = er.type end
      end
    elseif encDeck.tag == "Card" then
      peekType = getEncounterCardType(encDeck)
    end
    local targetPos, stacked = pickTargetForCard(peekType)
    if encDeck.tag == "Deck" then
      if encDeck.getQuantity() > 1 then
        local card = encDeck.takeObject({ position = targetPos, rotation = {0, 180, 0}, smooth = true })
        if card then handleRevealed(card, targetPos, stacked) end
      else
        encDeck.setPositionSmooth(targetPos, false, true)
        encDeck.setRotationSmooth({0, 180, 0}, false, true)
        handleRevealed(encDeck, targetPos, stacked)
        break
      end
    elseif encDeck.tag == "Card" then
      encDeck.setPositionSmooth(targetPos, false, true)
      encDeck.setRotationSmooth({0, 180, 0}, false, true)
      handleRevealed(encDeck, targetPos, stacked)
      break
    end
  end
  state.roundRevealed = true
  refreshHud()
end

-- ---------------------------------------------------------------------------
-- Draw Target Card
-- ---------------------------------------------------------------------------
function drawTargetCard()
  local deck = getObjectFromGUID(CONFIG.guids.targetDeck)
  if not deck then
    local tp = CONFIG.positions.targetWell
    local hits = Physics.cast({ origin = {tp[1], tp[2] + 4, tp[3]}, direction = {0, -1, 0}, type = 3, size = {2.2, 4, 3.2}, max_distance = 6 })
    for _, hit in ipairs(hits) do
      if hit.hit_object and hit.hit_object.tag == "Deck" then
        deck = hit.hit_object
        CONFIG.guids.targetDeck = deck.getGUID()
        break
      end
    end
  end
  if not deck then
    broadcastToAll("Target Deck not found in TARGET CARDS well.", {0.96, 0.52, 0.45})
    return
  end
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
    local card = deck.takeObject({ position = {disp[1], disp[2] + 0.35, disp[3]}, rotation = {0, 180, 0}, smooth = true })
    if card then
      state.activeTargetGuid = card.getGUID()
      broadcastToAll("TARGET: " .. card.getName() .. " — " .. (card.getDescription() or ""), {0.82, 0.90, 0.98})
    end
  end, 0.25)
end

-- ---------------------------------------------------------------------------
-- End-of-Round Cleanup
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

function tickArrivalTimers()
  local slots = CONFIG.positions.inPlaySlots
  local ticked = 0
  local expired = {}
  for _, slot in ipairs(slots) do
    local hits = Physics.cast({ origin = {slot[1], slot[2] + 3, slot[3]}, direction = {0, -1, 0}, type = 3, size = {2.1, 3, 3.2}, max_distance = 5 })
    local timers = {}
    local cardName = "Arrival"
    for _, hit in ipairs(hits) do
      local o = hit.hit_object
      if o and not o.getLock() then
        if o.getName() == "Arrival Timer" then table.insert(timers, o)
        elseif o.tag == "Card" then cardName = o.getName() end
      end
    end
    if #timers > 0 then
      timers[1].destruct()
      ticked = ticked + 1
      if #timers == 1 then table.insert(expired, cardName) end
    end
  end
  return ticked, expired
end

function onEndRound()
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
  local ticked, expired = tickArrivalTimers()
  if state.round < 12 then
    state.round = state.round + 1
    state.roundRevealed = false
    moveRoundMarker(state.round)
    state.firstPlayerIdx = (state.firstPlayerIdx % state.playerCount) + 1
    state.currentTurnIdx = state.firstPlayerIdx
    state.actionsLeft = (SETUP_RULES[state.playerCount] or SETUP_RULES[2]).actions
    movePlayer1Marker(state.firstPlayerIdx)
    local seasonMsg = ""
    if state.round == 5 then
      state.powerUsed = { false, false, false, false, false, false }
      seasonMsg = " — SEASON II BEGINS! All Steward powers refreshed (Burden cost now 5). Opening Season II Seeding!"
      Wait.time(function() openSeasonSeeding(2) end, 0.5)
    elseif state.round == 9 then
      state.powerUsed = { false, false, false, false, false, false }
      seasonMsg = " — SEASON III BEGINS! All Steward powers refreshed (Burden cost now 7). Opening Season III Seeding!"
      Wait.time(function() openSeasonSeeding(3) end, 0.5)
    end
    buildControlPlaqueUI()
    refreshHud()
    broadcastToAll(
      string.format("Round %d begins (cleared %d X, ticked %d timer(s), P1 -> Seat %d)%s",
        state.round, cleared, ticked, state.firstPlayerIdx, seasonMsg),
      {0.84, 0.94, 0.78}
    )
  else
    broadcastToAll(string.format("Round 12 complete (cleared %d X, ticked %d timer(s))! Click CALCULATE LIVE SCORE.", cleared, ticked), {0.98, 0.84, 0.44})
  end
  if #expired > 0 then
    broadcastToAll("ARRIVAL EXPIRED (0 timers left): " .. table.concat(expired, ", ") .. " — Resolve Failure (-10 VP & Strain)!", {0.98, 0.44, 0.40})
  end
end

-- ---------------------------------------------------------------------------
-- Core Tile Quick-Pull & Special Tile Unlock
-- ---------------------------------------------------------------------------
function pullCoreTile(idx)
  local entry = CONFIG.coreCatalog[idx]
  if not entry then return end
  local bag = getObjectFromGUID(entry.bagGuid)
  if not bag then return end
  local prefix = entry.name .. " /"
  local sp = CONFIG.positions.coreStaging
  for _, item in ipairs(bag.getObjects()) do
    if string.sub(item.name, 1, #prefix) == prefix then
      bag.takeObject({
        guid = item.guid,
        position = {sp[1] + math.random(-4, 4) * 0.12, sp[2] + 0.6, sp[3] + math.random(-4, 4) * 0.12},
        rotation = {0, 180, 0}, smooth = true
      })
      broadcastToAll("Pulled Core Tile: " .. entry.name .. " (Right-click tile to Pay, Activate, or Upgrade!).", {0.86, 0.94, 0.80})
      return
    end
  end
  broadcastToAll("No copies of " .. entry.name .. " remain in supply.", {0.95, 0.72, 0.42})
end

function onUnlockPrev(_, _, alt)
  state.unlockNum = ((state.unlockNum - 1 - (alt and 5 or 1)) % 26) + 1
  buildUnlockPlaqueUI()
  refreshHud()
end

function onUnlockNext(_, _, alt)
  state.unlockNum = ((state.unlockNum - 1 + (alt and 5 or 1)) % 26) + 1
  buildUnlockPlaqueUI()
  refreshHud()
end

function unlockSpecialByNumber(num)
  local bag = getObjectFromGUID(CONFIG.guids.specialBag)
  if not bag then return false end
  local prefix = "#" .. tostring(num) .. " "
  local targetPos = CONFIG.positions.unlockedSpecial
  local found = false
  for _, entry in ipairs(bag.getObjects()) do
    if string.sub(entry.name, 1, #prefix) == prefix then
      bag.takeObject({
        guid = entry.guid,
        position = {targetPos[1] + math.random(-6, 6) * 0.08, targetPos[2] + 0.6, targetPos[3] + math.random(-4, 4) * 0.08},
        rotation = {0, 180, 0}, smooth = true
      })
      found = true
      break
    end
  end
  return found
end

function onUnlockTile()
  if unlockSpecialByNumber(state.unlockNum) then
    broadcastToAll("Unlocked Special Tile #" .. tostring(state.unlockNum) .. " (0 Actions to place)!", {0.94, 0.84, 0.52})
  else
    broadcastToAll("Special Tile #" .. tostring(state.unlockNum) .. " is already unlocked.", {0.95, 0.72, 0.42})
  end
end

-- ---------------------------------------------------------------------------
-- Two-Click Full Table Reset (returns all tiles, cards, meeples, tokens & counters)
-- ---------------------------------------------------------------------------
local resetArmed = false
local resetTimerId = nil

function onHudResetClick()
  if not resetArmed then
    resetArmed = true
    UI.setAttribute("btnResetGame", "text", "CONFIRM?")
    UI.setAttribute("btnResetGame", "color", "#b82824")
    broadcastToAll("Click CONFIRM? within 5 seconds to reset the entire table.", {0.98, 0.62, 0.48})
    if resetTimerId then Wait.stop(resetTimerId) end
    resetTimerId = Wait.time(function()
      resetArmed = false
      UI.setAttribute("btnResetGame", "text", "RESET GAME")
      UI.setAttribute("btnResetGame", "color", "#5a2422")
    end, 5.0)
    return
  end
  resetArmed = false
  if resetTimerId then Wait.stop(resetTimerId) end
  UI.setAttribute("btnResetGame", "text", "RESET GAME")
  UI.setAttribute("btnResetGame", "color", "#5a2422")
  resetTable()
end

function resetTable()
  -- Build lookup from core tile basic name -> category bag GUID
  local coreBagById = {}
  for _, entry in ipairs(CONFIG.coreCatalog) do
    for id, r in pairs(CONFIG.tileRules) do
      if r.kind == "core" and r.name == entry.name then
        coreBagById[id] = entry.bagGuid
      end
    end
  end

  local specialBag = getObjectFromGUID(CONFIG.guids.specialBag)
  local goldenBag = getObjectFromGUID(CONFIG.guids.goldenBag)
  local travelExtBag = getObjectFromGUID(CONFIG.guids.travelExtBag)
  local reservePosByType = {
    boon = CONFIG.positions.boonsReserve,
    burden = CONFIG.positions.burdensReserve,
    arrival = CONFIG.positions.arrivalsReserve,
    goldenBoon = CONFIG.positions.goldenBoonsReserve
  }
  local stackBump = { boon = 0, burden = 0, arrival = 0, goldenBoon = 0, quest = 0, target = 0 }

  local function routeCard(cardObj)
    local note = cardObj.getGMNotes() or ""
    local name = cardObj.getName() or ""
    local erule = CONFIG.encounterRules[note]
    if erule and reservePosByType[erule.type] then
      local p = reservePosByType[erule.type]
      stackBump[erule.type] = stackBump[erule.type] + 1
      cardObj.setRotation({0, 180, 180})
      cardObj.setPosition({p[1], p[2] + 0.6 + stackBump[erule.type] * 0.03, p[3]})
      return true
    elseif string.sub(name, 1, 6) == "Quest " then
      local p = CONFIG.positions.questDeckWell
      stackBump.quest = stackBump.quest + 1
      cardObj.setRotation({0, 180, 180})
      cardObj.setPosition({p[1], p[2] + 0.6 + stackBump.quest * 0.03, p[3]})
      return true
    elseif string.sub(name, 1, 12) == "Target Card " then
      local p = CONFIG.positions.targetWell
      stackBump.target = stackBump.target + 1
      cardObj.setRotation({0, 180, 180})
      cardObj.setPosition({p[1], p[2] + 0.6 + stackBump.target * 0.03, p[3]})
      return true
    end
    return false
  end

  -- 1. Sweep loose tokens, return loose tiles to bags, return loose cards & Encounter/Discard decks
  local protectedDeckGuids = {
    [CONFIG.guids.boonsDeck] = true,
    [CONFIG.guids.burdensDeck] = true,
    [CONFIG.guids.arrivalsDeck] = true,
    [CONFIG.guids.goldenBoonsDeck] = true,
    [CONFIG.guids.questDeck] = true,
    [CONFIG.guids.targetDeck] = true
  }

  for _, obj in ipairs(getAllObjects()) do
    if not obj.getLock() then
      local name = obj.getName() or ""
      local note = obj.getGMNotes() or ""
      if name == "Strain Token" or name == "Supported Shield" or name == "Cooldown X" or name == "Arrival Timer" then
        obj.destruct()
      elseif name == "Travel Extension" and travelExtBag then
        if obj.is_face_down then obj.flip() end
        travelExtBag.putObject(obj)
      elseif CONFIG.tileRules[note] then
        local r = CONFIG.tileRules[note]
        if obj.is_face_down then obj.flip() end
        if r.kind == "core" and coreBagById[note] then
          local b = getObjectFromGUID(coreBagById[note])
          if b then b.putObject(obj) end
        elseif r.kind == "special" and specialBag then
          specialBag.putObject(obj)
        elseif r.kind == "golden" and goldenBag then
          goldenBag.putObject(obj)
        end
      elseif obj.tag == "Card" then
        routeCard(obj)
      elseif obj.tag == "Deck" and not protectedDeckGuids[obj.getGUID()] then
        -- Unpack any built Encounter Deck or Discard pile back to its reserve stacks
        local items = obj.getObjects()
        for i = 1, #items do
          local item = items[i]
          local erule = CONFIG.encounterRules[item.gm_notes or ""]
          local dest = erule and reservePosByType[erule.type]
          if dest then
            stackBump[erule.type] = stackBump[erule.type] + 1
            local targetP = {dest[1], dest[2] + 0.6 + stackBump[erule.type] * 0.03, dest[3]}
            if obj.getQuantity() > 1 then
              obj.takeObject({ guid = item.guid, position = targetP, rotation = {0, 180, 180}, smooth = false })
            else
              obj.setRotation({0, 180, 180})
              obj.setPosition(targetP)
              break
            end
          end
        end
      end
    end
  end

  -- 2. Return all Steward Meeples to their home Steward mats
  for _, st in ipairs(CONFIG.stewards) do
    local pawn = getObjectFromGUID(st.pawnGuid)
    if pawn then
      pawn.setPositionSmooth({st.homePawnPos[1], st.homePawnPos[2], st.homePawnPos[3]}, false, true)
      pawn.setRotationSmooth({0, 180, 0}, false, true)
    end
  end

  -- 3. Reset Warehouse counters to 0, Round Marker to 1, P1 Marker to Seat 1
  for _, guid in ipairs(CONFIG.guids.warehouseCounters) do
    local c = getObjectFromGUID(guid)
    if c then c.call("setValue", 0) end
  end
  state.round = 1
  state.firstPlayerIdx = 1
  state.currentTurnIdx = 1
  state.actionsLeft = (SETUP_RULES[state.playerCount] or SETUP_RULES[2]).actions
  state.activeTargetGuid = ""
  state.roundRevealed = false
  state.powerUsed = { false, false, false, false, false, false }
  state.scoreQuest = false
  state.scoreObj = 0
  state.scoreGold = 0
  state.scoreFailedArrivals = 0
  state.placedTileGuids = {}
  state.pawnLastHex = {}
  UI.setAttribute("qvScoreModal", "active", "false")
  UI.setAttribute("qvTileMenuModal", "active", "false")
  UI.setAttribute("qvSeedingModal", "active", "false")
  UI.setAttribute("qvAlertBanner", "active", "false")
  seedSession.active = false
  tileMenuOpen = false
  moveRoundMarker(1)
  movePlayer1Marker(1)
  buildControlPlaqueUI()
  refreshHud()

  broadcastToAll("Table reset complete! Click 1P–5P in the HUD to start a fresh game.", {0.86, 0.94, 0.78})
end
