<?php
// admin/assign_sets.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';
$error   = '';
$success = '';
$team_id  = getTeamId();
$match_id = $_GET['match_id'] ?? null;

if (!$match_id) { header('Location: manage_matches.php'); exit(); }

$match_stmt = $pdo->prepare("SELECT * FROM matches WHERE id = ? AND team_id = ?");
$match_stmt->execute([$match_id, $team_id]);
$match = $match_stmt->fetch();
if (!$match) { header('Location: manage_matches.php'); exit(); }
if ($match['status'] === 'completed') { header('Location: match_detail.php?id='.$match_id.'&tab=sets'); exit(); }

$teams_stmt = $pdo->prepare("SELECT * FROM match_teams WHERE match_id = ? ORDER BY id ASC");
$teams_stmt->execute([$match_id]);
$all_teams = $teams_stmt->fetchAll();

$sets_stmt = $pdo->prepare("SELECT MAX(set_number) as max_set FROM sets WHERE match_id = ?");
$sets_stmt->execute([$match_id]);
$next_set_number = ($sets_stmt->fetch()['max_set'] ?? 0) + 1;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'create_schedule') {
        $schedule_type = $_POST['schedule_type'] ?? 'round_robin';
        try {
            $pdo->beginTransaction();
            $current_set_number = $next_set_number;
            if ($schedule_type === 'round_robin' && count($all_teams) > 1) {
                createRoundRobinSchedule($pdo, $match_id, $all_teams, $current_set_number);
            } elseif ($schedule_type === 'custom') {
                createCustomSets($pdo, $match_id, $all_teams, $_POST, $current_set_number);
            }
            $pdo->commit();
            $_SESSION['success'] = "Matches added successfully! Existing sets preserved.";
            header("Location: match_detail.php?id=$match_id&tab=sets");
            exit();
        } catch (PDOException $e) {
            $pdo->rollBack();
            $error = "Error creating schedule: " . $e->getMessage();
        }
    } elseif ($action === 'clear_and_start_over') {
        try {
            $pdo->beginTransaction();
            $pdo->prepare("DELETE se FROM set_events se JOIN sets s ON se.set_id=s.id WHERE s.match_id=?")->execute([$match_id]);
            $pdo->prepare("DELETE FROM sets WHERE match_id=?")->execute([$match_id]);
            $pdo->commit();
            $_SESSION['warning'] = "All existing sets cleared.";
            header("Location: assign_sets.php?match_id=$match_id");
            exit();
        } catch (PDOException $e) {
            $pdo->rollBack();
            $error = "Error clearing schedule: " . $e->getMessage();
        }
    }
}

function createRoundRobinSchedule($pdo, $match_id, $teams, $start_set_number) {
    $n = count($teams);
    $set_number = $start_set_number;
    for ($i = 0; $i < $n; $i++) {
        for ($j = $i + 1; $j < $n; $j++) {
            $check = $pdo->prepare("SELECT COUNT(*) FROM sets WHERE match_id=? AND team1_id IN(?,?) AND team2_id IN(?,?) AND status='pending'");
            $check->execute([$match_id,$teams[$i]['id'],$teams[$j]['id'],$teams[$i]['id'],$teams[$j]['id']]);
            if (!$check->fetchColumn()) {
                $pdo->prepare("INSERT INTO sets (match_id,set_number,team1_id,team2_id,status,duration,created_at,updated_at) VALUES(?,?,?,?,'pending',600,NOW(),NOW())")
                   ->execute([$match_id,$set_number,$teams[$i]['id'],$teams[$j]['id']]);
                $set_number++;
            }
        }
    }
}

function createCustomSets($pdo, $match_id, $teams, $post_data, $start_set_number) {
    $set_number = $start_set_number;
    if (isset($post_data['fixtures']) && is_array($post_data['fixtures'])) {
        foreach ($post_data['fixtures'] as $fixture) {
            if (!empty($fixture['team1']) && !empty($fixture['team2'])) {
                $c1 = $pdo->prepare("SELECT COUNT(*) FROM sets WHERE match_id=? AND team1_id=? AND team2_id=? AND status='pending'");
                $c1->execute([$match_id,$fixture['team1'],$fixture['team2']]);
                $c2 = $pdo->prepare("SELECT COUNT(*) FROM sets WHERE match_id=? AND team1_id=? AND team2_id=? AND status='pending'");
                $c2->execute([$match_id,$fixture['team2'],$fixture['team1']]);
                if (!$c1->fetchColumn() && !$c2->fetchColumn()) {
                    $pdo->prepare("INSERT INTO sets (match_id,set_number,team1_id,team2_id,status,duration,created_at,updated_at) VALUES(?,?,?,?,'pending',600,NOW(),NOW())")
                       ->execute([$match_id,$set_number,$fixture['team1'],$fixture['team2']]);
                    $set_number++;
                }
            }
        }
    }
}

$existing_sets_stmt = $pdo->prepare("SELECT COUNT(*) as count FROM sets WHERE match_id = ?");
$existing_sets_stmt->execute([$match_id]);
$existing_sets_count = $existing_sets_stmt->fetch()['count'];

foreach ($all_teams as &$team) {
    $ids = json_decode($team['players'], true);
    $team['player_count'] = is_array($ids) ? count($ids) : 0;
}
unset($team);

if (isset($_SESSION['success'])) { $success = $_SESSION['success']; unset($_SESSION['success']); }
if (isset($_SESSION['warning'])) { $error   = $_SESSION['warning']; unset($_SESSION['warning']); }
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Schedule Matches — Noisers Football Pro</title>
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
                    <div class="page-title">Schedule Matches</div>
                    <div class="page-sub"><?php echo htmlspecialchars($match['match_name'] ?? 'Match'); ?> · <?php echo count($all_teams); ?> teams · <?php echo $existing_sets_count; ?> existing sets</div>
                </div>
                <a href="match_detail.php?id=<?php echo $match_id; ?>&tab=sets" class="btn btn-ghost btn-sm">Back to Match</a>
            </div>
        </div>

        <?php if (!empty($error)): ?>
        <div class="alert alert-warning"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        <?php if (!empty($success)): ?>
        <div class="alert alert-success"><?php echo htmlspecialchars($success); ?></div>
        <?php endif; ?>

        <?php if ($existing_sets_count > 0): ?>
        <div class="alert alert-warning" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <span><?php echo $existing_sets_count; ?> existing sets found. New matches will be added starting at set #<?php echo $next_set_number; ?>.</span>
            <form method="POST" onsubmit="return confirm('Clear ALL existing sets? This cannot be undone.')">
                <input type="hidden" name="action" value="clear_and_start_over">
                <button type="submit" class="btn btn-danger btn-xs">Clear All Sets</button>
            </form>
        </div>
        <?php endif; ?>

        <?php if (count($all_teams) < 2): ?>
        <div class="empty-state">
            <p>At least 2 teams required to schedule matches.</p>
            <a href="randomize_sets.php?match_id=<?php echo $match_id; ?>" class="btn btn-primary btn-sm" style="margin-top:14px;">Create Teams First</a>
        </div>
        <?php else: ?>

        <!-- Teams overview -->
        <div class="card" style="margin-bottom:16px;">
            <div class="card-hd"><span class="card-hd-title">Available Teams (<?php echo count($all_teams); ?>)</span></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0;">
                <?php foreach ($all_teams as $t): ?>
                <div style="padding:14px;border-right:1px solid var(--pitch-700);border-bottom:1px solid var(--pitch-700);text-align:center;">
                    <?php if ($t['color']): ?>
                    <div style="width:24px;height:24px;border-radius:50%;background:<?php echo htmlspecialchars($t['color']); ?>;margin:0 auto 8px;"></div>
                    <?php endif; ?>
                    <div style="font-weight:700;font-size:.875rem;"><?php echo htmlspecialchars($t['team_name']); ?></div>
                    <div style="font-size:.72rem;color:var(--text-muted);"><?php echo $t['player_count']; ?> players</div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Schedule type selection -->
        <div id="scheduleTypePicker" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <label id="opt-rr" onclick="selectType('round_robin')"
                   style="display:block;padding:20px;border:2px solid var(--burg-700);border-radius:9px;cursor:pointer;background:rgba(124,29,53,.1);transition:all .15s;">
                <div style="font-weight:800;font-size:.9rem;margin-bottom:4px;color:var(--burg-300);">Round Robin</div>
                <div style="font-size:.78rem;color:var(--text-muted);">Every team plays every other team once. <?php $n=count($all_teams); echo $n*($n-1)/2; ?> matches generated.</div>
            </label>
            <label id="opt-custom" onclick="selectType('custom')"
                   style="display:block;padding:20px;border:2px solid var(--border);border-radius:9px;cursor:pointer;transition:all .15s;">
                <div style="font-weight:800;font-size:.9rem;margin-bottom:4px;">Custom Fixtures</div>
                <div style="font-size:.78rem;color:var(--text-muted);">Manually pick which teams face each other.</div>
            </label>
        </div>

        <!-- Round robin form -->
        <div id="form-round_robin">
            <form method="POST">
                <input type="hidden" name="action" value="create_schedule">
                <input type="hidden" name="schedule_type" value="round_robin">
                <div class="card" style="margin-bottom:16px;">
                    <div class="card-hd"><span class="card-hd-title">Round Robin Preview</span></div>
                    <div style="padding:16px;display:flex;flex-direction:column;gap:8px;">
                        <?php $n = count($all_teams);
                        for ($i = 0; $i < $n; $i++) {
                            for ($j = $i+1; $j < $n; $j++): ?>
                        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--pitch-700);">
                            <?php if ($all_teams[$i]['color']): ?><span style="width:10px;height:10px;border-radius:50%;background:<?php echo htmlspecialchars($all_teams[$i]['color']); ?>;flex-shrink:0;"></span><?php endif; ?>
                            <span style="font-weight:600;font-size:.875rem;"><?php echo htmlspecialchars($all_teams[$i]['team_name']); ?></span>
                            <span style="color:var(--text-muted);font-size:.75rem;">vs</span>
                            <?php if ($all_teams[$j]['color']): ?><span style="width:10px;height:10px;border-radius:50%;background:<?php echo htmlspecialchars($all_teams[$j]['color']); ?>;flex-shrink:0;"></span><?php endif; ?>
                            <span style="font-weight:600;font-size:.875rem;"><?php echo htmlspecialchars($all_teams[$j]['team_name']); ?></span>
                        </div>
                        <?php endfor; } ?>
                    </div>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <a href="match_detail.php?id=<?php echo $match_id; ?>&tab=sets" class="btn btn-ghost btn-sm">Cancel</a>
                    <button type="submit" class="btn btn-primary btn-sm">Generate <?php echo $n*($n-1)/2; ?> Matches</button>
                </div>
            </form>
        </div>

        <!-- Custom form -->
        <div id="form-custom" style="display:none;">
            <form method="POST" id="customForm">
                <input type="hidden" name="action" value="create_schedule">
                <input type="hidden" name="schedule_type" value="custom">
                <div class="card" style="margin-bottom:16px;">
                    <div class="card-hd">
                        <span class="card-hd-title">Custom Fixtures</span>
                        <button type="button" onclick="addFixture()" class="btn btn-ghost btn-xs">+ Add Fixture</button>
                    </div>
                    <div id="fixturesContainer" style="padding:12px;display:flex;flex-direction:column;gap:10px;"></div>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <a href="match_detail.php?id=<?php echo $match_id; ?>&tab=sets" class="btn btn-ghost btn-sm">Cancel</a>
                    <button type="submit" class="btn btn-primary btn-sm">Create Custom Matches</button>
                </div>
            </form>
        </div>

        <?php endif; ?>
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
var teams = <?php echo json_encode(array_map(function($t){ return ['id'=>$t['id'],'name'=>$t['team_name'],'color'=>$t['color']??null]; }, $all_teams)); ?>;
var activeType = 'round_robin';

function selectType(type) {
    activeType = type;
    document.getElementById('form-round_robin').style.display = type === 'round_robin' ? 'block' : 'none';
    document.getElementById('form-custom').style.display      = type === 'custom'      ? 'block' : 'none';

    var rrStyle  = type === 'round_robin' ? 'rgba(124,29,53,.1)' : 'transparent';
    var cstStyle = type === 'custom'      ? 'rgba(124,29,53,.1)' : 'transparent';
    document.getElementById('opt-rr').style.background     = rrStyle;
    document.getElementById('opt-rr').style.borderColor    = type === 'round_robin' ? 'var(--burg-700)' : 'var(--border)';
    document.getElementById('opt-custom').style.background  = cstStyle;
    document.getElementById('opt-custom').style.borderColor = type === 'custom' ? 'var(--burg-700)' : 'var(--border)';

    if (type === 'custom' && document.getElementById('fixturesContainer').children.length === 0) {
        addFixture();
    }
}

var fixtureCount = 0;
function addFixture() {
    var id = ++fixtureCount;
    var opts = teams.map(function(t){ return '<option value="'+t.id+'">'+t.name+'</option>'; }).join('');
    var row = document.createElement('div');
    row.id = 'fixture-'+id;
    row.style.cssText = 'display:grid;grid-template-columns:1fr auto 1fr auto;gap:10px;align-items:center;background:var(--pitch-700);border:1px solid var(--border);border-radius:7px;padding:12px;';
    row.innerHTML =
        '<select name="fixtures['+id+'][team1]" class="field">'+opts+'</select>'+
        '<span style="font-size:.75rem;color:var(--text-muted);font-weight:700;">vs</span>'+
        '<select name="fixtures['+id+'][team2]" class="field">'+opts+'</select>'+
        '<button type="button" onclick="removeFixture('+id+')" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:1.1rem;padding:4px;">×</button>';
    document.getElementById('fixturesContainer').appendChild(row);
}

function removeFixture(id) {
    var el = document.getElementById('fixture-'+id);
    if (el) el.remove();
}
</script>
</body>
</html>
