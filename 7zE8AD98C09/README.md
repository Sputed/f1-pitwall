# F1 Pit Wall — a Claude plugin

Turns Claude into a Formula 1 leaderboard and race analyst. Data comes from the free [Jolpica-F1 API](https://github.com/jolpica/jolpica-f1) (the Ergast successor). No API key needed.

## Install (Claude Code)
```
/plugin marketplace add YOUR_GITHUB_USERNAME/f1-pitwall
/plugin install f1-pitwall@f1-pitwall-marketplace
```
Requires Node 18+.

## Commands
| Command | What it does |
|---|---|
| `/f1-pitwall:standings [year]` | Drivers' + constructors' leaderboards |
| `/f1-pitwall:lastrace` | Latest race + qualifying results |
| `/f1-pitwall:nextrace` | Next GP and session times |
| `/f1-pitwall:driver norris` | Season deep-dive on a driver |
| `/f1-pitwall:versus norris piastri` | Head-to-head comparison |

Or just ask naturally ("who's leading the championship?") and the `f1-leaderboard` skill kicks in.

## MCP tools
`driver_standings`, `constructor_standings`, `race_results`, `qualifying`, `schedule`, `next_race`, `driver_season`, `compare_drivers`.

## Ideas to extend
Add live timing via [OpenF1](https://openf1.org), pit-stop stats, tyre strategy, or fantasy-F1 scoring as new tools in `mcp/server.js`.

## License
MIT
