local input = std.extVar('input');

local redact(text) =
  arakoo.native('comprehendRedact')({ text: text });

redact(input)
