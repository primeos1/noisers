<?php
// admin/randomize_sets.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id  = getTeamId();
$match_id = $_GET['match_id'] ?? null;
$error    = '';
$success  = '';

if (!$match_id) { header('Location: manage_matches.php'); exit(); }

$match_stmt = $pdo->prepare("SELECT m.*, COUNT(DISTINCT pms.player_id) as total_players FROM matches m LEFT JOIN player_match_stats pms ON m.id=pms.match_id WHERE m.id=? AND m.team_id=? GROUP BY m.id");
$match_stmt->execute([$match_id, $team_id]);
$match = $match_stmt->fetch();
if (!$match) { header('Location: manage_matches.php'); exit(); }

$players_stmt = $pdo->prepare("SELECT p.* FROM players p INNER JOIN player_match_stats pms ON p.id=pms.player_id WHERE pms.match_id=? AND p.team_id=? ORDER BY p.player_number ASC");
$players_stmt->execute([$match_id, $team_id]);
$players = $players_stmt->fetchAll();

$teams_stmt = $pdo->prepare("SELECT * FROM match_teams WHERE match_id=? ORDER BY id ASC");
$teams_stmt->execute([$match_id]);
$existing_teams = $teams_stmt->fetchAll();

$non_roster_stmt = $pdo->prepare("SELECT id,full_name,position,player_number,rating FROM players WHERE team_id=? AND is_active='1' AND id NOT IN (SELECT player_id FROM player_match_stats WHERE match_id=?) ORDER BY player_number ASC");
$non_roster_stmt->execute([$team_id, $match_id]);
$non_roster_players = $non_roster_stmt->fetchAll(PDO::FETCH_ASSOC);

$is_ongoing = $match['status'] === 'ongoing';

$teams = [];
foreach ($existing_teams as $team) {
    $player_ids   = json_decode($team['players'], true);
    $team_players = [];
    foreach ($players as $player) {
        if (in_array($player['id'], $player_ids)) $team_players[] = $player;
    }
    $teams[] = $team_players;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'add_to_roster') {
        header('Content-Type: application/json');
        $player_id = (int)($_POST['player_id'] ?? 0);
        $check = $pdo->prepare("SELECT id,full_name,position,player_number,rating FROM players WHERE id=? AND team_id=?");
        $check->execute([$player_id, $team_id]);
        $p = $check->fetch(PDO::FETCH_ASSOC);
        if (!$p) { echo json_encode(['error'=>'Player not found']); exit(); }
        $dup = $pdo->prepare("SELECT id FROM player_match_stats WHERE player_id=? AND match_id=?");
        $dup->execute([$player_id, $match_id]);
        if ($dup->fetch()) { echo json_encode(['error'=>'Already in match']); exit(); }
        $pdo->prepare("INSERT INTO player_match_stats (player_id,match_id) VALUES (?,?)")->execute([$player_id, $match_id]);
        echo json_encode(['player' => $p]);
        exit();
    } elseif ($action === 'save_teams') {
        $teams_data = json_decode($_POST['teams_data'], true);
        try {
            $pdo->beginTransaction();
            if ($is_ongoing) {
                // Match is live — UPDATE existing team rows by their original IDs so
                // sets.team1_id / team2_id references remain valid.
                $upd = $pdo->prepare("UPDATE match_teams SET players=? WHERE id=? AND match_id=?");
                foreach ($existing_teams as $ti => $existingTeam) {
                    if (isset($teams_data[$ti])) {
                        $upd->execute([json_encode(array_column($teams_data[$ti], 'id')), $existingTeam['id'], $match_id]);
                    }
                }
            } else {
                $pdo->prepare("DELETE FROM match_teams WHERE match_id=?")->execute([$match_id]);
                $colors = ['#FF6B6B','#4ECDC4','#FFD166','#06D6A0','#118AB2','#EF476F','#073B4C'];
                $ins = $pdo->prepare("INSERT INTO match_teams (match_id,team_name,players,color) VALUES (?,?,?,?)");
                foreach ($teams_data as $ti => $tp) {
                    $ins->execute([$match_id, "Team ".($ti+1), json_encode(array_column($tp,'id')), $colors[$ti % count($colors)]]);
                }
                $pdo->prepare("UPDATE matches SET status='ongoing' WHERE id=?")->execute([$match_id]);
            }
            $pdo->commit();
            $_SESSION['success'] = $is_ongoing ? "Team rosters updated!" : "Teams saved!";
            header("Location: match_detail.php?id=$match_id&tab=sets");
            exit();
        } catch (PDOException $e) {
            $pdo->rollBack();
            $error = "Error saving teams: " . $e->getMessage();
        }
    } elseif ($action === 'randomize_teams') {
        if (!$is_ongoing) {
            $ppt    = min((int)$_POST['players_per_team'], 6);
            $method = $_POST['shuffle_method'] ?? 'balanced';
            $teams  = randomizeAllPlayersIntoTeams($players, $ppt, $method);
        }
    }
}

function randomizeAllPlayersIntoTeams($players, $ppt = 6, $method = 'balanced') {
    $ppt   = min($ppt, 6);
    $total = count($players);
    if ($total === 0) return [];

    $shuffled = $players;
    if ($method === 'balanced') {
        usort($shuffled, function($a,$b){ return $b['rating'] - $a['rating']; });
    } elseif ($method === 'position_balanced') {
        $byPos = ['Goalkeeper'=>[],'Defender'=>[],'Midfielder'=>[],'Forward'=>[]];
        foreach ($shuffled as $p) { $byPos[$p['position']][] = $p; }
        $shuffled = array_merge($byPos['Goalkeeper'],$byPos['Defender'],$byPos['Midfielder'],$byPos['Forward']);
    } else {
        shuffle($shuffled);
    }

    // All full teams get exactly $ppt players; only the last team gets the remainder.
    $n_full    = (int)floor($total / $ppt);
    $remainder = $total % $ppt;
    $n_teams   = $n_full + ($remainder > 0 ? 1 : 0);
    if ($n_teams === 0) return [];

    $teams = array_fill(0, $n_teams, []);

    // Round-robin across the full teams so ratings are spread evenly.
    for ($i = 0; $i < $n_full * $ppt; $i++) {
        $teams[$i % $n_full][] = $shuffled[$i];
    }

    // Remaining players go to the last team.
    for ($i = $n_full * $ppt; $i < $total; $i++) {
        $teams[$n_teams - 1][] = $shuffled[$i];
    }

    foreach ($teams as &$t) {
        usort($t, function($a,$b){
            $o = ['Goalkeeper'=>0,'Defender'=>1,'Midfielder'=>2,'Forward'=>3];
            return ($o[$a['position']]??4) - ($o[$b['position']]??4);
        });
    }
    return $teams;
}

if (empty($teams) && !empty($players)) {
    $teams = randomizeAllPlayersIntoTeams($players, 6, 'balanced');
}

if (isset($_SESSION['success'])) { $success = $_SESSION['success']; unset($_SESSION['success']); }
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Team Builder — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
</head>
<body>
<div class="page-shell">

    <aside class="sidebar">
        <div class="sidebar-brand">
            <a href="dashboard.php" class="sidebar-logo">NOISER FC <em>PRO</em></a>
            <div class="sidebar-team-name"><?php echo htmlspecialchars($_SESSION['team_name']); ?></div>
            <div class="sidebar-role-chip">Admin</div>
        </div>
        <nav class="sidebar-nav">
            <a href="dashboard.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Dashboard
            </a>
            <a href="manage_players.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Players
            </a>
            <a href="create_match.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                New Match
            </a>
            <a href="randomize_sets.php" class="sidebar-link active">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
                Manage Sets
            </a>
            <a href="match_management.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                Live Matches
            </a>
            <a href="manage_cards.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
                Cards
            </a>
            <div class="sidebar-divider"></div>
            <a href="reports.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Reports
            </a>
            <a href="settings.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
            </a>
            <div class="sidebar-divider"></div>
            <a href="../logout.php" class="sidebar-link" style="color:#f87171;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Logout
            </a>
        </nav>
    </aside>

    <main class="main-area">
        <div class="page-hd">
            <div class="page-hd-row">
                <div>
                    <div class="page-title">Team Builder</div>
                    <div class="page-sub"><?php echo htmlspecialchars($match['match_name'] ?: 'Match'); ?> · <?php echo count($players); ?> players · <?php echo count($teams); ?> teams</div>
                </div>
                <a href="match_detail.php?id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm">Back</a>
            </div>
        </div>

        <?php if ($error): ?><div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div><?php endif; ?>
        <?php if ($success): ?><div class="alert alert-success"><?php echo htmlspecialchars($success); ?></div><?php endif; ?>

        <!-- Stats strip -->
        <div class="stats-strip" style="margin-bottom:16px;">
            <div class="stat-box"><div class="stat-num"><?php echo count($players); ?></div><div class="stat-lbl">Players</div></div>
            <div class="stat-box"><div class="stat-num" style="color:var(--burg-300);"><?php echo count($teams); ?></div><div class="stat-lbl">Teams</div></div>
            <div class="stat-box"><div class="stat-num"><?php echo array_sum(array_map('count',$teams)); ?></div><div class="stat-lbl">Assigned</div></div>
            <div class="stat-box"><div class="stat-num" style="color:#fbbf24;"><?php echo max(0, count($players)-array_sum(array_map('count',$teams))); ?></div><div class="stat-lbl">Unassigned</div></div>
        </div>

        <?php if ($is_ongoing): ?>
        <div class="alert alert-warning" style="margin-bottom:16px;">
            Match is live — team assignments are locked. You can add players to the roster and assign them to a team below, then click <strong>Update Team Rosters</strong>.
        </div>
        <?php else: ?>
        <!-- Redistribute -->
        <div class="card" style="margin-bottom:16px;">
            <div class="card-hd"><span class="card-hd-title">Redistribution</span></div>
            <form method="POST" style="padding:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;align-items:end;">
                <input type="hidden" name="action" value="randomize_teams">
                <div>
                    <label class="field-label">Players / Team</label>
                    <select name="players_per_team" class="field">
                        <option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6" selected>6 (max)</option>
                    </select>
                </div>
                <div>
                    <label class="field-label">Method</label>
                    <select name="shuffle_method" class="field">
                        <option value="balanced" selected>Balanced (rating)</option>
                        <option value="position_balanced">Position balanced</option>
                        <option value="random">Random</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-ghost btn-sm">Redistribute</button>
            </form>
        </div>
        <?php endif; ?>

        <!-- Teams grid (rendered by JS) -->
        <div id="teamsGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:16px;"></div>

        <!-- Add non-roster player -->
        <div id="addRosterPanel" class="card" style="margin-bottom:16px;<?php echo empty($non_roster_players) ? 'display:none;' : ''; ?>">
            <div class="card-hd"><span class="card-hd-title">Add Player to Match</span></div>
            <div style="padding:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <select id="nonRosterSelect" class="field" style="flex:1;min-width:180px;">
                    <option value="">Select a player…</option>
                    <?php foreach ($non_roster_players as $nr): ?>
                    <option value="<?php echo $nr['id']; ?>"
                            data-name="<?php echo htmlspecialchars($nr['full_name']); ?>"
                            data-position="<?php echo htmlspecialchars($nr['position']); ?>"
                            data-number="<?php echo (int)$nr['player_number']; ?>"
                            data-rating="<?php echo (int)$nr['rating']; ?>">
                        #<?php echo (int)$nr['player_number']; ?> <?php echo htmlspecialchars($nr['full_name']); ?> — <?php echo htmlspecialchars($nr['position']); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
                <button type="button" onclick="addToRoster()" class="btn btn-primary btn-sm">Add to Match</button>
                <span id="rosterAddMsg" style="font-size:.8rem;color:var(--forest-400);display:none;">Added!</span>
            </div>
        </div>

        <!-- Available players -->
        <div id="availablePanel" class="card" style="margin-bottom:16px;display:none;">
            <div class="card-hd">
                <span class="card-hd-title">Unassigned Players</span>
                <button onclick="autoFill()" class="btn btn-ghost btn-xs">Auto-assign all</button>
            </div>
            <div id="availablePlayers" style="padding:10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;"></div>
        </div>

        <!-- Save -->
        <form method="POST" id="saveForm">
            <input type="hidden" name="action" value="save_teams">
            <input type="hidden" name="teams_data" id="teamsData">
            <div class="card">
                <div style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                    <div id="saveStatus" style="font-size:.875rem;color:var(--text-muted);">Review teams above</div>
                    <div style="display:flex;gap:8px;">
                        <a href="match_detail.php?id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm">Cancel</a>
                        <button type="submit" onclick="return prepareAndSave()" class="btn btn-primary btn-sm">
                            <?php echo $is_ongoing ? 'Update Team Rosters' : 'Save &amp; Start Match'; ?>
                        </button>
                    </div>
                </div>
            </div>
        </form>
    </main>
</div>

<nav class="mobile-nav" style="font-family:'Jost',sans-serif;">
    <div class="mobile-nav-row">
        <a href="dashboard.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Home
        </a>
        <a href="manage_players.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            Players
        </a>
        <a href="match_management.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            Matches
        </a>
        <a href="randomize_sets.php" class="mobile-nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
            Sets
        </a>
        <a href="reports.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Reports
        </a>
    </div>
</nav>

<script>
var teams  = <?php echo json_encode($teams); ?>;
var allPlayers = <?php echo json_encode($players); ?>;
var nonRosterPlayers = <?php echo json_encode($non_roster_players); ?>;
var matchId = <?php echo (int)$match_id; ?>;
var isOngoing = <?php echo $is_ongoing ? 'true' : 'false'; ?>;

var posMap = {Goalkeeper:'pos-gk',Defender:'pos-df',Midfielder:'pos-mf',Forward:'pos-fw'};

function getUsedIds() {
    var used = new Set();
    teams.forEach(function(t){ t.forEach(function(p){ used.add(p.id); }); });
    return used;
}
function getAvailable() {
    var used = getUsedIds();
    return allPlayers.filter(function(p){ return !used.has(p.id); });
}

function renderTeams() {
    var grid = document.getElementById('teamsGrid');
    grid.innerHTML = '';
    var avail = getAvailable();

    teams.forEach(function(tp, ti) {
        var n = tp.length;
        var badgeCls = n >= 6 ? 'badge-forest' : 'badge-warning';
        var playersHtml = n === 0
            ? '<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:.8rem;">No players</div>'
            : tp.map(function(p){
                var pcls = posMap[p.position]||'badge-muted';
                return '<div style="display:flex;align-items:center;gap:8px;padding:7px;background:var(--pitch-700);border:1px solid var(--border);border-radius:6px;">'+
                    '<div class="p-avatar" style="width:32px;height:32px;font-size:.75rem;">'+p.full_name.charAt(0).toUpperCase()+'</div>'+
                    '<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+p.full_name+'</div>'+
                    '<div style="display:flex;gap:4px;margin-top:1px;"><span class="badge '+pcls+'">'+p.position.substring(0,2)+'</span><span style="font-size:.65rem;color:var(--text-muted);">#'+p.player_number+'</span></div></div>'+
                    '<button type="button" onclick="movePlayer('+p.id+','+ti+')" style="background:none;border:1px solid var(--border);color:var(--text-muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:.7rem;">⇄</button>'+
                '</div>';
            }).join('');

        var addHtml = (n < 6 && avail.length > 0)
            ? '<div style="margin-top:8px;display:flex;gap:5px;"><select id="add-to-'+ti+'" class="field" style="flex:1;font-size:.78rem;"><option value="">+ Add player</option>'+
              avail.map(function(p){ return '<option value="'+p.id+'">'+p.full_name+'</option>'; }).join('')+
              '</select><button type="button" onclick="addToTeam('+ti+')" class="btn btn-ghost btn-xs">+</button></div>'
            : '';

        var card = document.createElement('div');
        card.className = 'card';
        card.innerHTML =
            '<div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">'+
                '<div style="display:flex;align-items:center;gap:8px;"><div style="width:26px;height:26px;border-radius:50%;background:var(--burg-800);color:var(--burg-300);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.8rem;">'+(ti+1)+'</div><span style="font-weight:700;font-size:.85rem;">Team '+(ti+1)+'</span></div>'+
                '<span class="badge '+badgeCls+'">'+n+'/6</span>'+
            '</div>'+
            '<div style="padding:8px;display:flex;flex-direction:column;gap:5px;">'+playersHtml+addHtml+'</div>';
        grid.appendChild(card);
    });

    var avPanel = document.getElementById('availablePanel');
    var apDiv   = document.getElementById('availablePlayers');
    if (avail.length === 0) {
        avPanel.style.display = 'none';
    } else {
        avPanel.style.display = '';
        apDiv.innerHTML = avail.map(function(p){
            var pcls = posMap[p.position]||'badge-muted';
            var btns = teams.map(function(_,i){ return '<button type="button" onclick="quickAdd('+p.id+','+i+')" style="background:var(--pitch-600);border:none;color:var(--text-dim);cursor:pointer;font-size:.68rem;padding:2px 6px;border-radius:3px;">T'+(i+1)+'</button>'; }).join('');
            return '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--pitch-700);border:1px solid var(--border);border-radius:6px;">'+
                '<div class="p-avatar" style="width:32px;height:32px;font-size:.75rem;">'+p.full_name.charAt(0).toUpperCase()+'</div>'+
                '<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+p.full_name+'</div><span class="badge '+pcls+'">'+p.position.substring(0,3)+'</span></div>'+
                '<div style="display:flex;gap:3px;flex-wrap:wrap;">'+btns+'</div>'+
            '</div>';
        }).join('');
    }

    var total = teams.reduce(function(s,t){return s+t.length;},0);
    var note = document.getElementById('saveStatus');
    note.textContent = total+' of '+allPlayers.length+' players assigned across '+teams.length+' teams.';
    note.style.color = total >= allPlayers.length ? 'var(--forest-400)' : 'var(--text-muted)';
}

function movePlayer(playerId, fromTeam) {
    if (teams.length <= 1) { alert('No other teams.'); return; }
    var msg = 'Move to:\n'; teams.forEach(function(t,i){ if(i!==fromTeam) msg+=(i+1)+'. Team '+(i+1)+' ('+t.length+'/6)\n'; });
    var input = prompt(msg+'\nEnter team number:');
    if (!input) return;
    var toTeam = parseInt(input)-1;
    if (isNaN(toTeam)||toTeam<0||toTeam>=teams.length||toTeam===fromTeam){alert('Invalid.');return;}
    if (teams[toTeam].length>=6){alert('Team full.');return;}
    var idx = teams[fromTeam].findIndex(function(p){return p.id===playerId;});
    if (idx===-1) return;
    teams[toTeam].push(teams[fromTeam].splice(idx,1)[0]);
    renderTeams();
}
function addToTeam(ti) {
    var sel=document.getElementById('add-to-'+ti);
    var pid=parseInt(sel.value); if(!pid) return;
    if(teams[ti].length>=6){alert('Team full.');return;}
    var p=allPlayers.find(function(x){return x.id===pid;}); if(!p) return;
    teams[ti].push(p); renderTeams();
}
function quickAdd(pid,ti) {
    if(teams[ti].length>=6){alert('Team full.');return;}
    var p=allPlayers.find(function(x){return x.id===pid;}); if(!p) return;
    teams[ti].push(p); renderTeams();
}
function autoFill() {
    var avail=getAvailable();
    teams.forEach(function(t){ while(t.length<6&&avail.length>0) t.push(avail.shift()); });
    while(avail.length>0){ var nt=[]; for(var i=0;i<6&&avail.length>0;i++) nt.push(avail.shift()); teams.push(nt); }
    renderTeams();
}
function prepareAndSave() {
    var used=getUsedIds(); var un=allPlayers.filter(function(p){return !used.has(p.id);});
    if(un.length>0){
        if(isOngoing){
            // During a live match only add to existing teams, never create new ones
            if(!confirm(un.length+' player(s) still unassigned and will not be saved. Continue?')) return false;
        } else {
            if(!confirm(un.length+' unassigned players. Auto-assign?')) return false;
            autoFill();
        }
    }
    document.getElementById('teamsData').value = JSON.stringify(teams);
    var msg = isOngoing ? 'Update team rosters? This will not affect completed sets.' : 'Save '+teams.length+' teams and start match?';
    return confirm(msg);
}
function addToRoster() {
    var sel = document.getElementById('nonRosterSelect');
    var pid = parseInt(sel.value);
    if (!pid) return;
    var opt = sel.options[sel.selectedIndex];
    var btn = document.querySelector('[onclick="addToRoster()"]');
    btn.disabled = true;
    fetch('randomize_sets.php?match_id=' + matchId, {
        method: 'POST',
        headers: {'Content-Type':'application/x-www-form-urlencoded'},
        body: 'action=add_to_roster&player_id=' + pid
    })
    .then(function(r){ return r.json(); })
    .then(function(data) {
        btn.disabled = false;
        if (data.error) { alert(data.error); return; }
        var p = data.player;
        p.id = parseInt(p.id);
        p.player_number = parseInt(p.player_number);
        p.rating = parseInt(p.rating);
        allPlayers.push(p);
        // remove from non-roster select
        sel.remove(sel.selectedIndex);
        sel.value = '';
        if (sel.options.length <= 1) {
            document.getElementById('addRosterPanel').style.display = 'none';
        }
        var msg = document.getElementById('rosterAddMsg');
        msg.style.display = '';
        setTimeout(function(){ msg.style.display = 'none'; }, 2000);
        renderTeams();
    })
    .catch(function(){ btn.disabled = false; alert('Request failed.'); });
}
document.addEventListener('DOMContentLoaded', function(){ renderTeams(); });
</script>
</body>
</html>
