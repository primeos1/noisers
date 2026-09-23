<?php
// admin/match_history.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id  = getTeamId();
$match_id = $_GET['match_id'] ?? null;

if (!$match_id) { header('Location: manage_matches.php'); exit(); }

$match_stmt = $pdo->prepare("SELECT m.* FROM matches m WHERE m.id = ? AND m.team_id = ?");
$match_stmt->execute([$match_id, $team_id]);
$match = $match_stmt->fetch();
if (!$match) { header('Location: manage_matches.php'); exit(); }

$sets_stmt = $pdo->prepare("
    SELECT s.*,
           t1.team_name as team1_name, t1.color as team1_color,
           t2.team_name as team2_name, t2.color as team2_color
    FROM sets s
    LEFT JOIN match_teams t1 ON s.team1_id = t1.id
    LEFT JOIN match_teams t2 ON s.team2_id = t2.id
    WHERE s.match_id = ? AND s.status = 'completed'
    ORDER BY s.set_number ASC
");
$sets_stmt->execute([$match_id]);
$completed_sets = $sets_stmt->fetchAll();

$players_stmt = $pdo->prepare("
    SELECT p.*, pms.yellow_cards, pms.red_cards, pms.minutes_played,
           (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
            WHERE se.player_id = p.id AND se.event_type = 'goal' AND s.match_id = ?) as goals,
           (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
            WHERE se.player_id = p.id AND se.event_type = 'assist' AND s.match_id = ?) as assists
    FROM players p
    INNER JOIN player_match_stats pms ON p.id = pms.player_id
    WHERE pms.match_id = ? AND p.team_id = ?
    ORDER BY p.player_number ASC
");
$players_stmt->execute([$match_id, $match_id, $match_id, $team_id]);
$players = $players_stmt->fetchAll();

$overall = ['total_sets'=>count($completed_sets),'total_goals'=>0,'team1_wins'=>0,'team2_wins'=>0,'draws'=>0,'total_duration'=>0];
foreach ($completed_sets as $set) {
    $overall['total_goals']    += $set['team1_goals'] + $set['team2_goals'];
    $overall['total_duration'] += $set['duration'] ?? 0;
    if ($set['winner'] === 'team1') $overall['team1_wins']++;
    elseif ($set['winner'] === 'team2') $overall['team2_wins']++;
    elseif ($set['winner'] === 'draw') $overall['draws']++;
}

foreach ($completed_sets as &$set) {
    $ev_stmt = $pdo->prepare("
        SELECT COUNT(CASE WHEN event_type='goal' THEN 1 END) as goals,
               COUNT(CASE WHEN event_type='assist' THEN 1 END) as assists,
               COUNT(CASE WHEN event_type='yellow_card' THEN 1 END) as yellow_cards,
               COUNT(CASE WHEN event_type='red_card' THEN 1 END) as red_cards,
               GROUP_CONCAT(
                   CASE WHEN event_type='goal'
                   THEN CONCAT('#', p.player_number, ' ', p.full_name, ' (', se.minute, \"'\")
                   ELSE NULL END
                   SEPARATOR '; '
               ) as goal_scorers
        FROM set_events se LEFT JOIN players p ON se.player_id = p.id
        WHERE se.set_id = ? GROUP BY se.set_id
    ");
    $ev_stmt->execute([$set['id']]);
    $set['event_stats'] = $ev_stmt->fetch() ?: [];
}
unset($set);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Match History — Noisers Football Pro</title>
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
            <a href="randomize_sets.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
                Manage Sets
            </a>
            <a href="match_management.php" class="sidebar-link active">
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
                    <div class="page-title"><?php echo htmlspecialchars($match['match_name'] ?: 'Match History'); ?></div>
                    <div class="page-sub"><?php echo date('l, j M Y', strtotime($match['match_date'])); ?><?php echo $match['location'] ? ' · ' . htmlspecialchars($match['location']) : ''; ?></div>
                </div>
                <a href="match_detail.php?id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm">Match Detail</a>
            </div>
        </div>

        <!-- Overall stats -->
        <div class="stats-strip" style="margin-bottom:20px;">
            <div class="stat-box">
                <div class="stat-num"><?php echo $overall['total_sets']; ?></div>
                <div class="stat-lbl">Sets Played</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:var(--forest-400);"><?php echo $overall['total_goals']; ?></div>
                <div class="stat-lbl">Total Goals</div>
            </div>
            <div class="stat-box">
                <div class="stat-num"><?php echo floor($overall['total_duration']/60); ?></div>
                <div class="stat-lbl">Minutes Played</div>
            </div>
            <div class="stat-box">
                <div class="stat-num"><?php echo count($players); ?></div>
                <div class="stat-lbl">Players</div>
            </div>
        </div>

        <!-- Sets timeline -->
        <?php if (!empty($completed_sets)): ?>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
            <?php foreach ($completed_sets as $set): ?>
            <div class="card">
                <div class="card-hd">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span class="card-hd-title">Set #<?php echo $set['set_number']; ?></span>
                        <?php if ($set['winner'] === 'draw'): ?>
                        <span class="badge badge-warning">Draw</span>
                        <?php else: ?>
                        <span class="badge badge-forest">Winner: <?php echo $set['winner'] === 'team1' ? htmlspecialchars($set['team1_name'] ?? 'Team 1') : htmlspecialchars($set['team2_name'] ?? 'Team 2'); ?></span>
                        <?php endif; ?>
                    </div>
                    <?php if ($set['start_time']): ?>
                    <span style="font-size:.72rem;color:var(--text-muted);"><?php echo date('g:i A', strtotime($set['start_time'])); ?></span>
                    <?php endif; ?>
                </div>
                <div style="padding:16px;">
                    <!-- Score display -->
                    <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin-bottom:14px;">
                        <div style="text-align:right;">
                            <?php if ($set['team1_color']): ?>
                            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:<?php echo htmlspecialchars($set['team1_color']); ?>;margin-right:6px;vertical-align:middle;"></span>
                            <?php endif; ?>
                            <span style="font-weight:700;font-size:.9rem;"><?php echo htmlspecialchars($set['team1_name'] ?? 'Team 1'); ?></span>
                            <?php if ($set['winner'] === 'team1'): ?>
                            <span style="margin-left:4px;font-size:.75rem;color:var(--forest-400);">★</span>
                            <?php endif; ?>
                        </div>
                        <div style="font-size:1.75rem;font-weight:900;color:var(--text-main);text-align:center;min-width:70px;">
                            <?php echo $set['team1_goals']; ?> – <?php echo $set['team2_goals']; ?>
                        </div>
                        <div style="text-align:left;">
                            <?php if ($set['winner'] === 'team2'): ?>
                            <span style="margin-right:4px;font-size:.75rem;color:var(--forest-400);">★</span>
                            <?php endif; ?>
                            <?php if ($set['team2_color']): ?>
                            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:<?php echo htmlspecialchars($set['team2_color']); ?>;margin-right:6px;vertical-align:middle;"></span>
                            <?php endif; ?>
                            <span style="font-weight:700;font-size:.9rem;"><?php echo htmlspecialchars($set['team2_name'] ?? 'Team 2'); ?></span>
                        </div>
                    </div>
                    <!-- Goal scorers -->
                    <?php if (!empty($set['event_stats']['goal_scorers'])): ?>
                    <div style="font-size:.78rem;color:var(--text-muted);text-align:center;">
                        ⚽ <?php echo htmlspecialchars($set['event_stats']['goal_scorers']); ?>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        <?php else: ?>
        <div class="empty-state"><p>No completed sets yet</p></div>
        <?php endif; ?>

        <!-- Player stats -->
        <?php if (!empty($players)): ?>
        <div class="card">
            <div class="card-hd"><span class="card-hd-title">Player Statistics</span></div>
            <!-- Desktop table -->
            <div class="table-wrap" id="tblDesktop" style="display:none;">
                <table class="data-table">
                    <thead><tr><th>Player</th><th>Goals</th><th>Assists</th><th>Yellow</th><th>Red</th><th>Mins</th></tr></thead>
                    <tbody>
                        <?php foreach ($players as $p): ?>
                        <tr>
                            <td>
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <div class="p-avatar"><?php echo strtoupper(substr($p['full_name'],0,1)); ?></div>
                                    <div>
                                        <div style="font-weight:600;">#<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?></div>
                                        <div style="font-size:.72rem;color:var(--text-muted);"><?php echo $p['position']; ?></div>
                                    </div>
                                </div>
                            </td>
                            <td style="font-weight:700;color:var(--forest-400);"><?php echo $p['goals']; ?></td>
                            <td style="color:var(--pitch-300);"><?php echo $p['assists']; ?></td>
                            <td style="color:#fbbf24;"><?php echo $p['yellow_cards']; ?></td>
                            <td style="color:#f87171;"><?php echo $p['red_cards']; ?></td>
                            <td style="color:var(--text-muted);"><?php echo $p['minutes_played']; ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <!-- Mobile cards -->
            <div id="tblMobile" style="padding:12px;display:flex;flex-direction:column;gap:8px;">
                <?php foreach ($players as $p): ?>
                <div style="background:var(--pitch-700);border:1px solid var(--border);border-radius:7px;padding:12px;display:flex;align-items:center;gap:12px;">
                    <div class="p-avatar md"><?php echo strtoupper(substr($p['full_name'],0,1)); ?></div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;font-size:.875rem;">#<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?></div>
                        <div style="font-size:.72rem;color:var(--text-muted);"><?php echo $p['position']; ?></div>
                    </div>
                    <div style="display:flex;gap:10px;font-size:.85rem;font-weight:700;">
                        <span style="color:var(--forest-400);"><?php echo $p['goals']; ?>G</span>
                        <span style="color:var(--pitch-300);"><?php echo $p['assists']; ?>A</span>
                        <span style="color:#fbbf24;"><?php echo $p['yellow_cards']; ?>Y</span>
                        <span style="color:#f87171;"><?php echo $p['red_cards']; ?>R</span>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
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
        <a href="match_management.php" class="mobile-nav-item active">
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

<script>
function applyView() {
    var w = window.innerWidth;
    var d = document.getElementById('tblDesktop');
    var m = document.getElementById('tblMobile');
    if (d) d.style.display = w >= 640 ? 'block' : 'none';
    if (m) m.style.display = w < 640  ? 'flex'  : 'none';
}
applyView();
window.addEventListener('resize', applyView);
</script>
</body>
</html>
