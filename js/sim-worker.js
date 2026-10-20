/* Background simulator: measures a setup's village win chance off the main
 * thread so taps never wait on it. Message in: {k, setup, opts, games}. */
self.window = self;
importScripts("engine.js");
self.onmessage = function (e) {
  const d = e.data;
  const rng = self.WW.mulberry32(20261019);
  let wins = 0;
  for (let i = 0; i < d.games; i++) if (self.WW.simulateGame(d.setup, { rng, opts: d.opts }) === "village") wins++;
  self.postMessage({ k: d.k, village: wins / d.games, games: d.games });
};
