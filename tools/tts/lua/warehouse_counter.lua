-- Clickable 0-15 Warehouse Resource Counter for The Quiet Vale (v7.0)
local MIN_VAL = 0
local MAX_VAL = 15

value = 0
resourceName = ""

function onLoad(saved_data)
  if saved_data and saved_data ~= "" then
    local ok, data = pcall(JSON.decode, saved_data)
    if ok and type(data) == "table" and type(data.value) == "number" then
      value = math.max(MIN_VAL, math.min(MAX_VAL, math.floor(data.value)))
    end
  end
  resourceName = self.getName()
  buildUI()
end

function onSave()
  return JSON.encode({ value = value })
end

function setValue(newVal)
  local n = tonumber(newVal) or 0
  value = math.max(MIN_VAL, math.min(MAX_VAL, math.floor(n)))
  updateDisplay()
  return value
end

function getValue()
  return value
end

function adjust(delta)
  local prev = value
  value = math.max(MIN_VAL, math.min(MAX_VAL, value + delta))
  updateDisplay()
  if value ~= prev then
    broadcastToAll(resourceName .. ": " .. tostring(value) .. " / 15", {0.9, 0.84, 0.68})
  end
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

function buildUI()
  self.clearButtons()
  self.createButton({
    click_function = "onCenterClick",
    function_owner = self,
    label = tostring(value),
    position = {0, 0.25, 0},
    rotation = {0, 0, 0},
    width = 620,
    height = 560,
    font_size = 420,
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
