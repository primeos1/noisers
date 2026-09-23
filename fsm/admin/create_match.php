<?php
// admin/create_match.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id = getTeamId();
$success = '';
$error   = '';

// AJAX: add player on the fly
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'add_player') {
    header('Content-Type: application/json');
    $player_number = $_POST['player_number'] ?? null;
    $full_name     = trim($_POST['full_name'] ?? '');
    $position      = $_POST['position'] ?? 'Midfielder';
    if (empty($full_name)) { echo json_encode(['success'=>false,'message'=>'Player name required']); exit; }
    try {
        if ($player_number) {
            $chk = $pdo->prepare("SELECT id FROM players WHERE team_id=? AND player_number=?");
            $chk->execute([$team_id, $player_number]);
            if ($chk->fetch()) { echo json_encode(['success'=>false,'message'=>'Jersey number already exists']); exit; }
        }
        $pdo->prepare("INSERT INTO players (team_id,player_number,full_name,position,rating,goals,assists,yellow_cards,red_cards,is_active,created_at) VALUES (?,?,?,?,3,0,0,0,0,1,NOW())")
           ->execute([$team_id, $player_number ?: null, $full_name, $position]);
        $pid = $pdo->lastInsertId();
        $profile_image = null;
        if (isset($_FILES['profile_image']) && $_FILES['profile_image']['error'] === UPLOAD_ERR_OK) {
            $dir = "../assets/uploads/teams/$team_id/players/";
            if (!file_exists($dir)) mkdir($dir, 0777, true);
            $ext = strtolower(pathinfo($_FILES['profile_image']['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ['jpg','jpeg','png','gif'])) {
                $fn = 'player_'.$pid.'_'.time().'.'.$ext;
                if (move_uploaded_file($_FILES['profile_image']['tmp_name'], $dir.$fn)) {
                    $profile_image = $fn;
                    $pdo->prepare("UPDATE players SET profile_image=? WHERE id=?")->execute([$fn, $pid]);
                }
            }
        }
        $np = $pdo->prepare("SELECT id,player_number,full_name,position,rating,profile_image FROM players WHERE id=?");
        $np->execute([$pid]);
        echo json_encode(['success'=>true,'message'=>'Player added!','player'=>$np->fetch(),'profile_image'=>$profile_image]);
    } catch (PDOException $e) {
        echo json_encode(['success'=>false,'message'=>'Error: '.$e->getMessage()]);
    }
    exit;
}

// Get active players
$players_stmt = $pdo->prepare("SELECT id,player_number,full_name,position,rating,profile_image FROM players WHERE team_id=? AND is_active=TRUE ORDER BY full_name ASC");
$players_stmt->execute([$team_id]);
$active_players = $players_stmt->fetchAll();

// Create match
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !isset($_POST['action'])) {
    $match_date       = $_POST['match_date'];
    $match_name       = trim($_POST['match_name']);
    $location         = trim($_POST['location']);
    $notes            = trim($_POST['notes']);
    $selected_players = array_unique($_POST['players'] ?? []);
    if (empty($match_date)) {
        $error = "Match date is required";
    } elseif (count($selected_players) < 10) {
        $error = "Minimum 10 players required";
    } else {
        try {
            $pdo->beginTransaction();
            $pdo->prepare("INSERT INTO matches (team_id,match_date,match_name,location,notes,status) VALUES (?,?,?,?,?,'scheduled')")
               ->execute([$team_id, $match_date, $match_name, $location, $notes]);
            $match_id = $pdo->lastInsertId();
            $ins = $pdo->prepare("INSERT INTO player_match_stats (player_id,match_id) VALUES (?,?)");
            foreach ($selected_players as $pid) $ins->execute([$pid, $match_id]);
            $pdo->commit();
            $success = "Match created!";
            header("refresh:2;url=match_detail.php?id=$match_id");
        } catch (PDOException $e) {
            $pdo->rollBack();
            $error = "Error: " . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>New Match — Noisers Football Pro</title>
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
            <a href="create_match.php" class="sidebar-link active">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                New Match
            </a>
            <a href="randomize_sets.php" class="sidebar-link">
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
                    <div class="page-title">New Match</div>
                    <div class="page-sub"><?php echo count($active_players); ?> active players available</div>
                </div>
                <a href="manage_matches.php" class="btn btn-ghost btn-sm">All Matches</a>
            </div>
        </div>

        <?php if ($error): ?>
        <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        <?php if ($success): ?>
        <div class="alert alert-success"><?php echo htmlspecialchars($success); ?> Redirecting…</div>
        <?php endif; ?>

        <form method="POST" action="" id="matchForm">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:16px;">

                <!-- Match details -->
                <div class="card">
                    <div class="card-hd"><span class="card-hd-title">Match Details</span></div>
                    <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
                        <div>
                            <label class="field-label">Date <span style="color:#f87171;">*</span></label>
                            <input type="date" name="match_date" class="field" value="<?php echo date('Y-m-d'); ?>" required>
                        </div>
                        <div>
                            <label class="field-label">Match Name</label>
                            <input type="text" name="match_name" class="field" placeholder="e.g. Weekly Friendly"
                                   value="<?php echo isset($_POST['match_name']) ? htmlspecialchars($_POST['match_name']) : ''; ?>">
                        </div>
                        <div>
                            <label class="field-label">Location</label>
                            <input type="text" name="location" class="field" placeholder="e.g. Main Pitch"
                                   value="<?php echo isset($_POST['location']) ? htmlspecialchars($_POST['location']) : ''; ?>">
                        </div>
                        <div>
                            <label class="field-label">Notes</label>
                            <textarea name="notes" class="field" rows="3" placeholder="Any notes…"><?php echo isset($_POST['notes']) ? htmlspecialchars($_POST['notes']) : ''; ?></textarea>
                        </div>
                    </div>
                </div>

                <!-- Squad selection -->
                <div class="card">
                    <div class="card-hd">
                        <span class="card-hd-title">Squad <span id="selectedBadge" class="badge badge-muted" style="margin-left:6px;">0</span></span>
                        <div style="display:flex;gap:6px;">
                            <button type="button" onclick="selectAll()" class="btn btn-ghost btn-xs">All</button>
                            <button type="button" onclick="deselectAll()" class="btn btn-ghost btn-xs">None</button>
                            <button type="button" onclick="document.getElementById('addPlayerModal').style.display='flex'" class="btn btn-ghost btn-xs">+ Add</button>
                        </div>
                    </div>

                    <?php if (empty($active_players)): ?>
                    <div class="empty-state">
                        <p>No active players yet.</p>
                        <a href="manage_players.php?action=add" class="btn btn-primary btn-sm" style="margin-top:12px;">Add First Player</a>
                    </div>
                    <?php else: ?>

                    <!-- Position filter -->
                    <div style="padding:8px 12px;display:flex;gap:5px;flex-wrap:wrap;border-bottom:1px solid var(--border);align-items:center;">
                        <?php foreach (['All','Goalkeeper','Defender','Midfielder','Forward'] as $pos): ?>
                        <button type="button" onclick="filterPos('<?php echo $pos; ?>')" id="pill-<?php echo $pos; ?>"
                                class="btn btn-ghost btn-xs"
                                style="<?php echo $pos==='All'?'background:var(--burg-800);color:var(--text-main);':''; ?>">
                            <?php echo $pos==='All'?'All':substr($pos,0,2); ?>
                        </button>
                        <?php endforeach; ?>
                        <div class="search-wrap" style="flex:1;min-width:90px;min-height:32px;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="playerSearch" placeholder="Search…" oninput="applyFilters()">
                        </div>
                    </div>

                    <div id="playersGrid" style="padding:10px 12px;display:flex;flex-direction:column;gap:5px;max-height:380px;overflow-y:auto;">
                        <?php foreach ($active_players as $p):
                            $pos_cls = ['Goalkeeper'=>'pos-gk','Defender'=>'pos-df','Midfielder'=>'pos-mf','Forward'=>'pos-fw'][$p['position']] ?? 'badge-muted';
                            $img = "../assets/uploads/teams/{$team_id}/players/" . $p['profile_image'];
                            $has_img = !empty($p['profile_image']) && file_exists($img);
                        ?>
                        <label class="pcl" data-pos="<?php echo $p['position']; ?>" data-name="<?php echo strtolower(htmlspecialchars($p['full_name'])); ?>"
                               style="display:flex;align-items:center;gap:10px;padding:9px;border:1px solid var(--border);border-radius:6px;cursor:pointer;transition:all .12s;">
                            <input type="checkbox" value="<?php echo $p['id']; ?>" class="check player-cb" onchange="onToggle(this)">
                            <div class="p-avatar">
                                <?php if ($has_img): ?><img src="<?php echo htmlspecialchars($img); ?>" alt=""><?php else: ?><?php echo strtoupper(substr($p['full_name'],0,1)); ?><?php endif; ?>
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                    #<?php echo $p['player_number']?:'-'; ?> <?php echo htmlspecialchars($p['full_name']); ?>
                                </div>
                                <span class="badge <?php echo $pos_cls; ?>" style="margin-top:2px;"><?php echo substr($p['position'],0,3); ?></span>
                            </div>
                            <span class="stars" style="font-size:.7rem;flex-shrink:0;">
                                <?php for($i=1;$i<=5;$i++): ?><span class="<?php echo $i<=$p['rating']?'star-on':'star-off'; ?>">★</span><?php endfor; ?>
                            </span>
                        </label>
                        <?php endforeach; ?>
                    </div>

                    <div style="padding:8px 14px;border-top:1px solid var(--border);display:flex;gap:10px;font-size:.72rem;font-weight:700;color:var(--text-muted);">
                        <span id="statGK">GK:0</span><span id="statDF">DF:0</span><span id="statMF">MF:0</span><span id="statFW">FW:0</span>
                    </div>
                    <div id="selectedInputs"></div>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Submit bar -->
            <div class="card">
                <div style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                    <div id="submitStatus" style="font-size:.875rem;color:var(--text-muted);flex:1;min-width:0;">Select at least 10 players</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:220px;">
                        <a href="manage_matches.php" class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;">Cancel</a>
                        <button type="submit" class="btn btn-primary btn-sm" id="submitBtn" disabled style="width:100%;justify-content:center;">Create Match</button>
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
        <a href="randomize_sets.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
            Sets
        </a>
        <a href="reports.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Reports
        </a>
    </div>
</nav>

<!-- Add Player Modal -->
<div id="addPlayerModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100;align-items:center;justify-content:center;padding:16px;">
    <div style="background:var(--pitch-800);border:1px solid var(--border);border-radius:10px;width:100%;max-width:380px;">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;">Quick Add Player</span>
            <button onclick="document.getElementById('addPlayerModal').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.3rem;">×</button>
        </div>
        <form id="addPlayerForm" style="padding:16px;display:flex;flex-direction:column;gap:12px;">
            <div class="form-grid form-grid-2">
                <div>
                    <label class="field-label">Jersey #</label>
                    <input type="number" name="player_number" class="field" min="1" max="99" placeholder="7">
                </div>
                <div>
                    <label class="field-label">Position</label>
                    <select name="position" class="field">
                        <option value="Goalkeeper">GK</option>
                        <option value="Defender">DF</option>
                        <option value="Midfielder" selected>MF</option>
                        <option value="Forward">FW</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="field-label">Full Name <span style="color:#f87171;">*</span></label>
                <input type="text" name="full_name" class="field" required placeholder="Player name">
            </div>
            <div id="addPlayerMsg" style="display:none;font-size:.8rem;padding:8px;border-radius:5px;"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button type="button" onclick="document.getElementById('addPlayerModal').style.display='none'" class="btn btn-ghost btn-sm">Cancel</button>
                <button type="submit" id="apSubmit" class="btn btn-primary btn-sm">Add &amp; Select</button>
            </div>
        </form>
    </div>
</div>

<script>
var selectedIds = new Set();
var currentFilter = 'All';

function onToggle(cb) {
    var label = cb.closest('.pcl');
    if (cb.checked) {
        selectedIds.add(cb.value);
        label.style.background = 'rgba(124,29,53,.12)';
        label.style.borderColor = 'var(--burg-700)';
    } else {
        selectedIds.delete(cb.value);
        label.style.background = '';
        label.style.borderColor = 'var(--border)';
    }
    updateStatus();
}

function updateStatus() {
    var n = selectedIds.size;
    var badge = document.getElementById('selectedBadge');
    badge.textContent = n;
    badge.className = 'badge ' + (n >= 10 ? 'badge-forest' : 'badge-muted');

    var counts = {Goalkeeper:0,Defender:0,Midfielder:0,Forward:0};
    document.querySelectorAll('.player-cb:checked').forEach(function(cb){
        var pos = cb.closest('.pcl').dataset.pos;
        if (counts[pos] !== undefined) counts[pos]++;
    });
    document.getElementById('statGK').textContent = 'GK:'+counts.Goalkeeper;
    document.getElementById('statDF').textContent = 'DF:'+counts.Defender;
    document.getElementById('statMF').textContent = 'MF:'+counts.Midfielder;
    document.getElementById('statFW').textContent = 'FW:'+counts.Forward;

    var btn = document.getElementById('submitBtn');
    btn.disabled = n < 10;
    var note = document.getElementById('submitStatus');
    note.textContent = n >= 10 ? n + ' players selected — ready' : 'Select at least 10 players (' + n + '/10)';
    note.style.color = n >= 10 ? 'var(--forest-400)' : 'var(--text-muted)';

    var cont = document.getElementById('selectedInputs');
    cont.innerHTML = '';
    selectedIds.forEach(function(id) {
        var i = document.createElement('input');
        i.type='hidden'; i.name='players[]'; i.value=id;
        cont.appendChild(i);
    });
}

function selectAll() {
    document.querySelectorAll('.pcl').forEach(function(label) {
        if (label.style.display !== 'none') {
            var cb = label.querySelector('.player-cb');
            if (!cb.checked) { cb.checked=true; onToggle(cb); }
        }
    });
}
function deselectAll() {
    document.querySelectorAll('.player-cb:checked').forEach(function(cb){ cb.checked=false; onToggle(cb); });
}

function filterPos(pos) {
    currentFilter = pos;
    document.querySelectorAll('[id^="pill-"]').forEach(function(b){ b.style.background=''; b.style.color=''; });
    document.getElementById('pill-'+pos).style.background='var(--burg-800)';
    document.getElementById('pill-'+pos).style.color='var(--text-main)';
    applyFilters();
}

function applyFilters() {
    var q = document.getElementById('playerSearch').value.toLowerCase();
    document.querySelectorAll('.pcl').forEach(function(label) {
        var showPos  = currentFilter==='All' || label.dataset.pos===currentFilter;
        var showName = !q || label.dataset.name.includes(q);
        label.style.display = (showPos && showName) ? '' : 'none';
    });
}

document.getElementById('matchForm').addEventListener('submit', function(e) {
    if (selectedIds.size < 10) { e.preventDefault(); alert('Select at least 10 players.'); }
});

document.getElementById('addPlayerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var fd = new FormData(this);
    fd.append('action','add_player');
    var btn = document.getElementById('apSubmit');
    btn.textContent='Adding…'; btn.disabled=true;
    fetch('',{method:'POST',body:fd})
        .then(function(r){return r.json();})
        .then(function(data){
            btn.textContent='Add & Select'; btn.disabled=false;
            var msg = document.getElementById('addPlayerMsg');
            msg.style.display='block';
            if (data.success) {
                msg.style.background='rgba(45,106,79,.15)'; msg.style.color='var(--forest-300)';
                msg.textContent=data.message;
                addPlayerCard(data.player);
                document.getElementById('addPlayerForm').reset();
                setTimeout(function(){ document.getElementById('addPlayerModal').style.display='none'; msg.style.display='none'; },1500);
            } else {
                msg.style.background='rgba(220,38,38,.12)'; msg.style.color='#f87171';
                msg.textContent=data.message;
            }
        })
        .catch(function(){ btn.textContent='Add & Select'; btn.disabled=false; });
});

function addPlayerCard(p) {
    var posCls = {Goalkeeper:'pos-gk',Defender:'pos-df',Midfielder:'pos-mf',Forward:'pos-fw'}[p.position]||'badge-muted';
    var label = document.createElement('label');
    label.className = 'pcl';
    label.dataset.pos  = p.position;
    label.dataset.name = p.full_name.toLowerCase();
    label.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px;border:1px solid var(--burg-700);border-radius:6px;cursor:pointer;transition:all .12s;background:rgba(124,29,53,.12);';
    label.innerHTML =
        '<input type="checkbox" value="'+p.id+'" class="check player-cb" onchange="onToggle(this)" checked>'+
        '<div class="p-avatar">'+p.full_name.charAt(0).toUpperCase()+'</div>'+
        '<div style="flex:1;min-width:0;">'+
            '<div style="font-weight:600;font-size:.85rem;">#'+(p.player_number||'-')+' '+p.full_name+'</div>'+
            '<span class="badge '+posCls+'">'+p.position.substring(0,3)+'</span>'+
        '</div>';
    var grid = document.getElementById('playersGrid');
    grid.insertBefore(label, grid.firstChild);
    selectedIds.add(String(p.id));
    updateStatus();
    label.scrollIntoView({behavior:'smooth',block:'nearest'});
}

window.addEventListener('click',function(e){ if(e.target===document.getElementById('addPlayerModal')) document.getElementById('addPlayerModal').style.display='none'; });
document.addEventListener('keydown',function(e){ if(e.key==='Escape') document.getElementById('addPlayerModal').style.display='none'; });
</script>
</body>
</html>
