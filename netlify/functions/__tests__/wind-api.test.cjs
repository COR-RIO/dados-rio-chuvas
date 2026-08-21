const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filePath = path.join(__dirname, '..', 'v1-wind.js');
const code = fs.readFileSync(filePath, 'utf8');
const sandbox = {
  module: { exports: {} },
  exports: {},
  require: (id) => {
    if (id === './redemet-wind') {
      return { handler: async () => ({ body: JSON.stringify({ success: true, data: [] }) }) };
    }
    if (id === './lib/windBelt') {
      return { WIND_BELT_CITIES: [], WIND_BELT_AIRPORTS: [], CORRIDORS: [] };
    }
    return require(id);
  },
  console,
  fetch: async () => ({ ok: true, json: async () => ({ success: true, data: [] }) }),
  process,
  Buffer,
  setTimeout,
  clearTimeout,
};

sandbox.exports = sandbox.module.exports;
sandbox.global = sandbox;
vm.runInNewContext(code, sandbox, { filename: 'v1-wind.js' });
const api = sandbox.module.exports;

test('v1-wind exposes km/h conversion helpers', () => {
  assert.equal(api.msToKmh(10), 36);

  const actual = api.toApiWindStation({
    windSpeedMs: 10,
    windGustMs: 20,
    windDirectionDeg: 90,
  });

  const expected = {
    windSpeedMs: 10,
    windGustMs: 20,
    windDirectionDeg: 90,
    windSpeedKmh: 36,
    windGustKmh: 72,
  };

  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
});
