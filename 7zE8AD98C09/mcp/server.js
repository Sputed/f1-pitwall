#!/usr/bin/env node
// Zero-dependency MCP server (stdio, newline-delimited JSON-RPC) for F1 data.
// Data: Jolpica-F1 (Ergast-compatible) -> https://api.jolpi.ca/ergast/f1/
// Requires Node 18+ (built-in fetch).

const BASE = "https://api.jolpi.ca/ergast/f1";

async function api(path) {
  const res = await fetch(`${BASE}/${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`F1 API ${res.status} for ${path}`);
  return (await res.json()).MRData;
}

const pad = (s, n) => String(s ?? "").padEnd(n);
const rpad = (s, n) => String(s ?? "").padStart(n);
const season = (s) => (s ? String(s) : "current");
const round = (r) => (r ? String(r) : "last");
const name = (d) => `${d.givenName} ${d.familyName}`;

const tools = {
  driver_standings: {
    description: "Current (or given season) World Drivers' Championship leaderboard.",
    schema: { season: "string?" },
    async run({ season: s }) {
      const d = await api(`${season(s)}/driverStandings.json`);
      const list = d.StandingsTable.StandingsLists[0];
      if (!list) return "No standings available.";
      const rows = list.DriverStandings.map(
        (x) => `${rpad(x.position, 2)}  ${pad(name(x.Driver), 22)} ${pad(x.Constructors?.[0]?.name, 18)} ${rpad(x.points, 5)} pts  ${rpad(x.wins, 2)} wins`
      );
      return `Drivers' Championship ${list.season} (after round ${list.round})\n\n${rows.join("\n")}`;
    },
  },
  constructor_standings: {
    description: "Constructors' Championship leaderboard.",
    schema: { season: "string?" },
    async run({ season: s }) {
      const d = await api(`${season(s)}/constructorStandings.json`);
      const list = d.StandingsTable.StandingsLists[0];
      if (!list) return "No standings available.";
      const rows = list.ConstructorStandings.map(
        (x) => `${rpad(x.position, 2)}  ${pad(x.Constructor.name, 22)} ${rpad(x.points, 5)} pts  ${rpad(x.wins, 2)} wins`
      );
      return `Constructors' Championship ${list.season} (after round ${list.round})\n\n${rows.join("\n")}`;
    },
  },
  race_results: {
    description: "Race classification. Defaults to the most recent race. Provide season+round for a specific one.",
    schema: { season: "string?", round: "string?" },
    async run({ season: s, round: r }) {
      const d = await api(`${season(s)}/${round(r)}/results.json`);
      const race = d.RaceTable.Races[0];
      if (!race) return "No results found.";
      const rows = race.Results.map(
        (x) => `${rpad(x.positionText, 2)}  ${pad(name(x.Driver), 22)} ${pad(x.Constructor.name, 18)} grid ${rpad(x.grid, 2)}  ${pad(x.Time?.time ?? x.status, 14)} +${x.points}${x.FastestLap?.rank === "1" ? "  fastest lap" : ""}`
      );
      return `${race.season} ${race.raceName} - Round ${race.round} (${race.date})\n${race.Circuit.circuitName}, ${race.Circuit.Location.locality}\n\n${rows.join("\n")}`;
    },
  },
  qualifying: {
    description: "Qualifying classification (Q1/Q2/Q3). Defaults to most recent race weekend.",
    schema: { season: "string?", round: "string?" },
    async run({ season: s, round: r }) {
      const d = await api(`${season(s)}/${round(r)}/qualifying.json`);
      const race = d.RaceTable.Races[0];
      if (!race) return "No qualifying data found.";
      const rows = race.QualifyingResults.map(
        (x) => `${rpad(x.position, 2)}  ${pad(name(x.Driver), 22)} ${pad(x.Constructor.name, 18)} Q1 ${pad(x.Q1, 9)} Q2 ${pad(x.Q2, 9)} Q3 ${x.Q3 ?? ""}`
      );
      return `${race.season} ${race.raceName} - Qualifying\n\n${rows.join("\n")}`;
    },
  },
  schedule: {
    description: "Full race calendar for a season.",
    schema: { season: "string?" },
    async run({ season: s }) {
      const d = await api(`${season(s)}.json`);
      const rows = d.RaceTable.Races.map(
        (x) => `R${rpad(x.round, 2)}  ${x.date}  ${pad(x.raceName, 34)} ${x.Circuit.Location.locality}, ${x.Circuit.Location.country}`
      );
      return `${d.RaceTable.season} calendar\n\n${rows.join("\n")}`;
    },
  },
  next_race: {
    description: "The next upcoming race with session dates/times (UTC).",
    schema: {},
    async run() {
      const d = await api("current/next.json");
      const r = d.RaceTable.Races[0];
      if (!r) return "No upcoming race found (season may be over).";
      const sess = [
        ["Practice 1", r.FirstPractice], ["Practice 2", r.SecondPractice], ["Practice 3", r.ThirdPractice],
        ["Sprint Quali", r.SprintQualifying], ["Sprint", r.Sprint], ["Qualifying", r.Qualifying],
        ["Race", { date: r.date, time: r.time }],
      ].filter(([, v]) => v).map(([k, v]) => `${pad(k, 13)} ${v.date} ${v.time ?? ""}`);
      return `Next: ${r.season} ${r.raceName} (Round ${r.round})\n${r.Circuit.circuitName}, ${r.Circuit.Location.locality}, ${r.Circuit.Location.country}\n\n${sess.join("\n")}`;
    },
  },
  driver_season: {
    description: "A driver's race-by-race results for a season. driver_id is the Ergast id, e.g. 'max_verstappen', 'norris', 'leclerc', 'hamilton'.",
    schema: { driver_id: "string", season: "string?" },
    async run({ driver_id, season: s }) {
      const d = await api(`${season(s)}/drivers/${driver_id}/results.json?limit=100`);
      const races = d.RaceTable.Races;
      if (!races.length) return `No results for '${driver_id}'. Use the Ergast-style id (e.g. max_verstappen).`;
      const rows = races.map((x) => {
        const r = x.Results[0];
        return `R${rpad(x.round, 2)}  ${pad(x.raceName, 32)} grid ${rpad(r.grid, 2)} -> P${pad(r.positionText, 3)} +${r.points}`;
      });
      const pts = races.reduce((a, x) => a + Number(x.Results[0].points), 0);
      return `${name(races[0].Results[0].Driver)} - ${races[0].season}\n\n${rows.join("\n")}\n\nTotal race points: ${pts}`;
    },
  },
  compare_drivers: {
    description: "Head-to-head comparison of two drivers over a season (race finish, points, wins, podiums, DNFs).",
    schema: { driver_a: "string", driver_b: "string", season: "string?" },
    async run({ driver_a, driver_b, season: s }) {
      const get = async (id) => (await api(`${season(s)}/drivers/${id}/results.json?limit=100`)).RaceTable.Races;
      const [A, B] = await Promise.all([get(driver_a), get(driver_b)]);
      if (!A.length || !B.length) return "One of the driver ids returned no results. Use Ergast-style ids.";
      const byRound = (R) => Object.fromEntries(R.map((x) => [x.round, x.Results[0]]));
      const a = byRound(A), b = byRound(B);
      let aAhead = 0, bAhead = 0;
      for (const r of Object.keys(a)) {
        if (!b[r]) continue;
        const pa = Number(a[r].position), pb = Number(b[r].position);
        if (pa < pb) aAhead++; else if (pb < pa) bAhead++;
      }
      const stats = (R) => ({
        points: R.reduce((t, x) => t + Number(x.Results[0].points), 0),
        wins: R.filter((x) => x.Results[0].position === "1").length,
        podiums: R.filter((x) => Number(x.Results[0].position) <= 3).length,
        dnfs: R.filter((x) => !/^(Finished|\+\d+ Lap)/.test(x.Results[0].status)).length,
      });
      const sa = stats(A), sb = stats(B);
      const na = name(A[0].Results[0].Driver), nb = name(B[0].Results[0].Driver);
      return [
        `${na} vs ${nb} - ${A[0].season}`, "",
        `${pad("", 10)}${pad(na, 22)}${nb}`,
        `${pad("Points", 10)}${pad(sa.points, 22)}${sb.points}`,
        `${pad("Wins", 10)}${pad(sa.wins, 22)}${sb.wins}`,
        `${pad("Podiums", 10)}${pad(sa.podiums, 22)}${sb.podiums}`,
        `${pad("DNFs", 10)}${pad(sa.dnfs, 22)}${sb.dnfs}`, "",
        `Head-to-head (race finish): ${na} ${aAhead} - ${bAhead} ${nb}`,
      ].join("\n");
    },
  },
};

// ---- minimal MCP over stdio ----
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");

function toolList() {
  return Object.entries(tools).map(([n, t]) => {
    const properties = {}, required = [];
    for (const [k, v] of Object.entries(t.schema)) {
      properties[k] = { type: "string" };
      if (!v.endsWith("?")) required.push(k);
    }
    return { name: n, description: t.description, inputSchema: { type: "object", properties, required } };
  });
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return send({ jsonrpc: "2.0", id, result: {
      protocolVersion: params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "f1-pitwall", version: "1.0.0" },
    }});
  }
  if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
  if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools: toolList() } });
  if (method === "tools/call") {
    const tool = tools[params?.name];
    if (!tool) return send({ jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool ${params?.name}` } });
    try {
      const text = await tool.run(params.arguments ?? {});
      return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } });
    } catch (e) {
      return send({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: String(e.message ?? e) }] } });
    }
  }
  if (id !== undefined) send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) { try { handle(JSON.parse(line)); } catch { /* ignore malformed */ } }
  }
});
