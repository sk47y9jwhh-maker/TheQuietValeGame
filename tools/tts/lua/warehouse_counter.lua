-- Hybrid Wooden-Disc + Clickable 0-15 Warehouse Resource Counter for The Quiet Vale (v7.0)
-- Displays 0-15 tactile 3D wooden discs in a neat 5x3 grid above the column stitch line,
-- synced automatically with the clickable counter, HUD, and all automated tile/card effects.
local MIN_VAL = 0
local MAX_VAL = 15

local RESOURCE_COLORS = {
  Stone = {0.58, 0.62, 0.65},
  Metal = {0.42, 0.56, 0.65},
  Goods = {0.68, 0.38, 0.26},
  Wood  = {0.36, 0.52, 0.30},
  Food  = {0.72, 0.64, 0.22},
  Herbs = {0.54, 0.38, 0.62}
}

value = 0
resourceName = ""
discGuids = {}

function onLoad(saved_data)
  if saved_data and saved_data ~= "" then
    local ok, data = pcall(JSON.decode, saved_data)
    if ok and type(data) == "table" then
      if type(data.value) == "number" then
        value = math.max(MIN_VAL, math.min(MAX_VAL, math.floor(data.value)))
      end
      if type(data.discGuids) == "table" then
        discGuids = data.discGuids
      end
    end
  end
  resourceName = self.getName()
  buildUI()
  Wait.frames(function() syncWoodenDiscs() end, 4)
end

function onSave()
  return JSON.encode({ value = value, discGuids = discGuids })
end

function setValue(newVal)
  local n = tonumber(newVal) or 0
  value = math.max(MIN_VAL, math.min(MAX_VAL, math.floor(n)))
  updateDisplay()
  syncWoodenDiscs()
  return value
end

function getValue()
  return value
end

function adjust(delta)
  local prev = value
  value = math.max(MIN_VAL, math.min(MAX_VAL, value + delta))
  updateDisplay()
  syncWoodenDiscs()
  if value ~= prev then
    broadcastToAll(resourceName .. ": " .. tostring(value) .. " / 15", {0.9, 0.84, 0.68})
    Global.call("syncWarehouseHud")
  end
  return value
end

function onPlus(_, _, alt)
  adjust(alt and 5 or 1)
end

function onMinus(_, _, alt)
  adjust(alt and -5 or -1)
end

function onCenterClick(_, _, alt)
  adjust(alt and -1 or 1)
end

function updateDisplay()
  self.editButton({ index = 0, label = tostring(value) })
end

function getDiscSlotPos(idx)
  -- 5 columns x 3 rows above the colored stitch line in this Warehouse column
  local base = self.getPosition()
  local col = (idx - 1) % 5       -- 0..4
  local row = math.floor((idx - 1) / 5) -- 0..2 (bottom to top)
  local xOff = (col - 2) * 0.42
  local zOff = 1.25 + row * 0.46
  return { base.x + xOff, 1.15, base.z + zOff }
end

function syncWoodenDiscs()
  -- Prune any missing GUIDs first
  local alive = {}
  for _, g in ipairs(discGuids) do
    local o = getObjectFromGUID(g)
    if o then table.insert(alive, o) end
  end

  -- Destroy excess discs if value decreased
  while #alive > value do
    local removed = table.remove(alive)
    removed.destruct()
  end

  -- Rebuild GUID list from remaining alive discs
  discGuids = {}
  for _, o in ipairs(alive) do
    table.insert(discGuids, o.getGUID())
  end

  -- Spawn additional wooden discs up to value
  local tint = RESOURCE_COLORS[resourceName] or {0.72, 0.66, 0.54}
  local currentCount = #discGuids
  for i = currentCount + 1, value do
    local pos = getDiscSlotPos(i)
    local disc = spawnObject({
      type = "Checker_white",
      position = pos,
      rotation = {0, 180, 0},
      scale = {0.22, 0.35, 0.22},
      sound = false,
      callback_function = function(spawned)
        spawned.setName(resourceName .. " (" .. tostring(i) .. ")")
        spawned.setColorTint(tint)
        spawned.setLock(true)
        spawned.interactable = false
      end
    })
    if disc then
      table.insert(discGuids, disc.getGUID())
    end
  end
end

function buildUI()
  self.clearButtons()
  self.createButton({
    click_function = "onCenterClick",
    function_owner = self,
    label = tostring(value),
    position = {0, 0.25, 0},
    rotation = {0, 0, 0},
    width = 620,
    height = 540,
    font_size = 400,
    color = {0.14, 0.12, 0.10, 0.92},
    font_color = {0.96, 0.90, 0.72},
    tooltip = resourceName .. " (Left-click +1, Right-click -1, Cap 15)"
  })
  self.createButton({
    click_function = "onMinus",
    function_owner = self,
    label = "-",
    position = {-0.72, 0.25, 0},
    rotation = {0, 0, 0},
    width = 240,
    height = 360,
    font_size = 280,
    color = {0.36, 0.22, 0.20},
    font_color = {0.98, 0.92, 0.84},
    tooltip = "-1 (Right-click -5)"
  })
  self.createButton({
    click_function = "onPlus",
    function_owner = self,
    label = "+",
    position = {0.72, 0.25, 0},
    rotation = {0, 0, 0},
    width = 240,
    height = 360,
    font_size = 280,
    color = {0.22, 0.36, 0.24},
    font_color = {0.94, 0.98, 0.90},
    tooltip = "+1 (Right-click +5)"
  })
end
