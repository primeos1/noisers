<?php
// admin/reports.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id = getTeamId();

$start_date  = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-01');
$end_date    = isset($_GET['end_date'])   ? $_GET['end_date']   : date('Y-m-t');
$time_period = isset($_GET['time_period']) ? $_GET['time_period'] : 'monthly';

if ($time_period === 'weekly') {
    $start_date = date('Y-m-d', strtotime('monday this week'));
    $end_date   = date('Y-m-d', strtotime('sunday this week'));
} elseif ($time_period === 'yearly') {
    $start_date = date('Y-01-01');
    $end_date   = date('Y-12-31');
}

// Team stats
$stmt = $pdo->prepare("
    SELECT COUNT(DISTINCT p.id) as total_players, COUNT(DISTINCT m.id) as total_matches,
           (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
            JOIN matches mx ON s.match_id = mx.id
            WHERE se.event_type = 'goal' AND mx.team_id = ?) as total_goals,
           (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
            JOIN matches mx ON s.match_id = mx.id
            WHERE se.event_type = 'assist' AND mx.team_id = ?) as total_assists,
           SUM(p.yellow_cards) as total_yellow_cards, SUM(p.red_cards) as total_red_cards,
           AVG(p.rating) as avg_rating
    FROM players p LEFT JOIN matches m ON m.team_id = ?
    WHERE p.team_id = ?
");
$stmt->execute([$team_id, $team_id, $team_id, $team_id]);
$team_stats = $stmt->fetch();

// Top scorers
$top_scorers_stmt = $pdo->prepare("
    SELECT p.id, p.full_name, p.player_number, p.rating, p.profile_image,
           COALESCE(se_g.goals, 0) as goals,
           COALESCE(se_a.assists, 0) as assists
    FROM players p
    LEFT JOIN (
        SELECT se.player_id, COUNT(*) as goals
        FROM set_events se JOIN sets s ON se.set_id = s.id JOIN matches m ON s.match_id = m.id
        WHERE se.event_type = 'goal' AND m.team_id = ?
        GROUP BY se.player_id
    ) se_g ON p.id = se_g.player_id
    LEFT JOIN (
        SELECT se.player_id, COUNT(*) as assists
        FROM set_events se JOIN sets s ON se.set_id = s.id JOIN matches m ON s.match_id = m.id
        WHERE se.event_type = 'assist' AND m.team_id = ?
        GROUP BY se.player_id
    ) se_a ON p.id = se_a.player_id
    WHERE p.team_id = ? ORDER BY goals DESC LIMIT 10
");
$top_scorers_stmt->execute([$team_id, $team_id, $team_id]);
$top_scorers = $top_scorers_stmt->fetchAll();

// Top assists
$top_assists_stmt = $pdo->prepare("
    SELECT p.id, p.full_name, p.player_number, p.rating, p.profile_image,
           COALESCE(se_g.goals, 0) as goals,
           COALESCE(se_a.assists, 0) as assists
    FROM players p
    LEFT JOIN (
        SELECT se.player_id, COUNT(*) as goals
        FROM set_events se JOIN sets s ON se.set_id = s.id JOIN matches m ON s.match_id = m.id
        WHERE se.event_type = 'goal' AND m.team_id = ?
        GROUP BY se.player_id
    ) se_g ON p.id = se_g.player_id
    LEFT JOIN (
        SELECT se.player_id, COUNT(*) as assists
        FROM set_events se JOIN sets s ON se.set_id = s.id JOIN matches m ON s.match_id = m.id
        WHERE se.event_type = 'assist' AND m.team_id = ?
        GROUP BY se.player_id
    ) se_a ON p.id = se_a.player_id
    WHERE p.team_id = ? ORDER BY assists DESC LIMIT 10
");
$top_assists_stmt->execute([$team_id, $team_id, $team_id]);
$top_assists = $top_assists_stmt->fetchAll();

// Match stats
$match_stats_stmt = $pdo->prepare("
    SELECT COUNT(*) as total_matches,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_matches,
           SUM(CASE WHEN status = 'ongoing'   THEN 1 ELSE 0 END) as ongoing_matches,
           AVG((SELECT COUNT(*) FROM sets WHERE match_id = m.id)) as avg_sets_per_match
    FROM matches m WHERE team_id = ? AND match_date BETWEEN ? AND ?
");
$match_stats_stmt->execute([$team_id, $start_date, $end_date]);
$match_stats = $match_stats_stmt->fetch();

// Goals by position
$gbp_stmt = $pdo->prepare("
    SELECT p.position, COUNT(DISTINCT p.id) as player_count,
           COALESCE(SUM(se_g.goals), 0)   as total_goals,
           COALESCE(SUM(se_g.goals), 0) / COUNT(DISTINCT p.id) as avg_goals,
           COALESCE(SUM(se_a.assists), 0) as total_assists
    FROM players p
    LEFT JOIN (
        SELECT se.player_id, COUNT(*) as goals
        FROM set_events se JOIN sets s ON se.set_id = s.id JOIN matches m ON s.match_id = m.id
        WHERE se.event_type = 'goal' AND m.team_id = ?
        GROUP BY se.player_id
    ) se_g ON p.id = se_g.player_id
    LEFT JOIN (
        SELECT se.player_id, COUNT(*) as assists
        FROM set_events se JOIN sets s ON se.set_id = s.id JOIN matches m ON s.match_id = m.id
        WHERE se.event_type = 'assist' AND m.team_id = ?
        GROUP BY se.player_id
    ) se_a ON p.id = se_a.player_id
    WHERE p.team_id = ? GROUP BY p.position ORDER BY total_goals DESC
");
$gbp_stmt->execute([$team_id, $team_id, $team_id]);
$goals_by_position = $gbp_stmt->fetchAll();

// Cards
$cards_stmt = $pdo->prepare("
    SELECT SUM(yellow_cards) as yellow_cards, SUM(red_cards) as red_cards,
           COUNT(CASE WHEN yellow_cards > 0 THEN 1 END) as players_with_yellow,
           COUNT(CASE WHEN red_cards > 0 THEN 1 END) as players_with_red
    FROM players WHERE team_id = ?
");
$cards_stmt->execute([$team_id]);
$cards_stats = $cards_stmt->fetch();

// Rating distribution
$rating_stmt = $pdo->prepare("
    SELECT rating, COUNT(*) as player_count FROM players
    WHERE team_id = ? GROUP BY rating ORDER BY rating DESC
");
$rating_stmt->execute([$team_id]);
$rating_distribution = $rating_stmt->fetchAll();

// Financial
$financial_stmt = $pdo->prepare("
    SELECT cp.card_type, COUNT(*) as card_count, SUM(cp.amount) as total_amount,
           SUM(CASE WHEN cp.status='paid' THEN cp.amount ELSE 0 END) as paid_amount
    FROM card_payments cp JOIN players p ON cp.player_id = p.id
    WHERE p.team_id = ? GROUP BY cp.card_type
");
$financial_stmt->execute([$team_id]);
$financial_data = $financial_stmt->fetchAll();

// Monthly data
$monthly_stmt = $pdo->prepare("
    SELECT DATE_FORMAT(m.match_date, '%Y-%m') as month,
           COUNT(DISTINCT m.id) as match_count,
           (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
            WHERE se.event_type = 'goal' AND s.match_id = m.id) as total_goals,
           (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
            WHERE se.event_type = 'assist' AND s.match_id = m.id) as total_assists
    FROM matches m
    WHERE m.team_id = ? AND m.match_date BETWEEN ? AND ?
    GROUP BY month ORDER BY month
");
$monthly_stmt->execute([$team_id, $start_date, $end_date]);
$monthly_data = $monthly_stmt->fetchAll();

// Prepare chart data
$monthly_labels = [];
$monthly_goals  = [];
foreach ($monthly_data as $md) {
    $monthly_labels[] = date('M Y', strtotime($md['month'].'-01'));
    $monthly_goals[]  = (int)($md['total_goals'] ?? 0);
}

$pos_labels = [];
$pos_data   = [];
foreach ($goals_by_position as $gp) {
    $pos_labels[] = $gp['position'];
    $pos_data[]   = (int)$gp['total_goals'];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Reports — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
            <a href="match_management.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                Live Matches
            </a>
            <a href="manage_cards.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
                Cards
            </a>
            <div class="sidebar-divider"></div>
            <a href="reports.php" class="sidebar-link active">
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
                    <div class="page-title">Reports</div>
                    <div class="page-sub"><?php echo date('M j', strtotime($start_date)); ?> – <?php echo date('M j, Y', strtotime($end_date)); ?></div>
                </div>
                <form method="GET" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <select name="time_period" class="field" style="width:auto;min-width:130px;" onchange="this.form.submit()">
                        <option value="weekly"  <?php echo $time_period==='weekly'?'selected':'';  ?>>This Week</option>
                        <option value="monthly" <?php echo $time_period==='monthly'?'selected':''; ?>>This Month</option>
                        <option value="yearly"  <?php echo $time_period==='yearly'?'selected':'';  ?>>This Year</option>
                        <option value="custom"  <?php echo $time_period==='custom'?'selected':'';  ?>>Custom</option>
                    </select>
                    <?php if ($time_period === 'custom'): ?>
                    <input type="date" name="start_date" class="field" style="width:auto;" value="<?php echo $start_date; ?>">
                    <input type="date" name="end_date"   class="field" style="width:auto;" value="<?php echo $end_date; ?>">
                    <button type="submit" class="btn btn-primary btn-sm">Apply</button>
                    <?php endif; ?>
                </form>
            </div>
        </div>

        <!-- Team stats strip -->
        <div class="stats-strip" style="margin-bottom:20px;">
            <div class="stat-box">
                <div class="stat-num"><?php echo (int)$team_stats['total_players']; ?></div>
                <div class="stat-lbl">Players</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:var(--forest-400);"><?php echo (int)$team_stats['total_goals']; ?></div>
                <div class="stat-lbl">Total Goals</div>
            </div>
            <div class="stat-box">
                <div class="stat-num"><?php echo (int)$team_stats['total_assists']; ?></div>
                <div class="stat-lbl">Assists</div>
            </div>
            <div class="stat-box">
                <div class="stat-num"><?php echo number_format((float)$team_stats['avg_rating'], 1); ?></div>
                <div class="stat-lbl">Avg Rating</div>
            </div>
        </div>

        <!-- Charts row -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px;">
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Goals by Month</span></div>
                <div style="padding:16px;">
                    <canvas id="monthlyChart" height="160"></canvas>
                </div>
            </div>
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Goals by Position</span></div>
                <div style="padding:16px;">
                    <canvas id="positionChart" height="160"></canvas>
                </div>
            </div>
        </div>

        <!-- Top performers -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:20px;">
            <!-- Top scorers -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Top Scorers</span></div>
                <?php if (!empty($top_scorers)): ?>
                <div>
                    <?php foreach (array_slice($top_scorers, 0, 7) as $i => $p): ?>
                    <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--pitch-700);">
                        <span style="font-size:.7rem;font-weight:700;color:var(--text-muted);width:16px;text-align:center;"><?php echo $i+1; ?></span>
                        <div class="p-avatar"><?php echo strtoupper(substr($p['full_name'],0,1)); ?></div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                #<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?>
                            </div>
                        </div>
                        <div style="font-size:1rem;font-weight:800;color:var(--forest-400);"><?php echo $p['goals']; ?><span style="font-size:.65rem;color:var(--text-muted);font-weight:700;"> G</span></div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php else: ?><div class="empty-state"><p>No data yet</p></div><?php endif; ?>
            </div>

            <!-- Top assists -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Top Assists</span></div>
                <?php if (!empty($top_assists)): ?>
                <div>
                    <?php foreach (array_slice($top_assists, 0, 7) as $i => $p): ?>
                    <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--pitch-700);">
                        <span style="font-size:.7rem;font-weight:700;color:var(--text-muted);width:16px;text-align:center;"><?php echo $i+1; ?></span>
                        <div class="p-avatar"><?php echo strtoupper(substr($p['full_name'],0,1)); ?></div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                #<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?>
                            </div>
                        </div>
                        <div style="font-size:1rem;font-weight:800;color:var(--pitch-300);"><?php echo $p['assists']; ?><span style="font-size:.65rem;color:var(--text-muted);font-weight:700;"> A</span></div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php else: ?><div class="empty-state"><p>No data yet</p></div><?php endif; ?>
            </div>
        </div>

        <!-- Goals by position + Cards overview -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:20px;">
            <!-- By position -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Goals by Position</span></div>
                <?php if (!empty($goals_by_position)): ?>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Position</th><th>Players</th><th>Goals</th><th>Assists</th></tr></thead>
                        <tbody>
                            <?php foreach ($goals_by_position as $gp): ?>
                            <tr>
                                <td style="font-weight:600;"><?php echo $gp['position']; ?></td>
                                <td><?php echo $gp['player_count']; ?></td>
                                <td style="color:var(--forest-400);font-weight:700;"><?php echo $gp['total_goals']; ?></td>
                                <td style="color:var(--pitch-300);font-weight:600;"><?php echo $gp['total_assists']; ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <?php else: ?><div class="empty-state"><p>No data</p></div><?php endif; ?>
            </div>

            <!-- Cards overview -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Disciplinary Overview</span></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
                    <?php
                    $disc = [
                        ['Yellow Cards', $cards_stats['yellow_cards'] ?? 0, '#fbbf24'],
                        ['Red Cards', $cards_stats['red_cards'] ?? 0, '#f87171'],
                        ['Players (Yellow)', $cards_stats['players_with_yellow'] ?? 0, '#fbbf24'],
                        ['Players (Red)', $cards_stats['players_with_red'] ?? 0, '#f87171'],
                    ];
                    foreach ($disc as $d): ?>
                    <div style="padding:16px;border-right:1px solid var(--pitch-700);border-bottom:1px solid var(--pitch-700);text-align:center;">
                        <div style="font-size:1.5rem;font-weight:800;color:<?php echo $d[2]; ?>;"><?php echo $d[1]; ?></div>
                        <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-top:3px;"><?php echo $d[0]; ?></div>
                    </div>
                    <?php endforeach; ?>
                </div>

                <?php if (!empty($financial_data)): ?>
                <div style="padding:14px 18px;border-top:1px solid var(--border);">
                    <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:10px;">Fine Collections</div>
                    <?php foreach ($financial_data as $fd): ?>
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--pitch-700);">
                        <span style="font-size:.8rem;font-weight:600;text-transform:capitalize;"><?php echo $fd['card_type']; ?> Card</span>
                        <span style="font-size:.85rem;font-weight:700;color:var(--forest-400);">₦<?php echo number_format($fd['paid_amount']); ?></span>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php endif; ?>
            </div>
        </div>

        <!-- Rating distribution -->
        <?php if (!empty($rating_distribution)): ?>
        <div class="card">
            <div class="card-hd"><span class="card-hd-title">Player Rating Distribution</span></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:0;">
                <?php foreach ($rating_distribution as $rd): ?>
                <div style="padding:16px;border-right:1px solid var(--pitch-700);text-align:center;">
                    <div style="font-size:1.25rem;font-weight:800;color:var(--text-main);"><?php echo $rd['player_count']; ?></div>
                    <div style="margin-top:4px;">
                        <?php for ($i=1;$i<=5;$i++): ?>
                        <span style="color:<?php echo $i<=$rd['rating']?'#fbbf24':'var(--pitch-500)'; ?>;font-size:.75rem;">★</span>
                        <?php endfor; ?>
                    </div>
                    <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-top:3px;">Rating <?php echo $rd['rating']; ?></div>
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
        <a href="match_management.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            Matches
        </a>
        <a href="randomize_sets.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
            Sets
        </a>
        <a href="reports.php" class="mobile-nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Reports
        </a>
    </div>
</nav>

<script>
var chartDefaults = {
    color: '#8a8a96',
    plugins: { legend: { display: false } },
    scales: {
        x: { grid: { color: '#26262e' }, ticks: { color: '#4a4a54', font: { size: 11 } } },
        y: { grid: { color: '#26262e' }, ticks: { color: '#4a4a54', font: { size: 11 } } }
    }
};

// Monthly goals chart
new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: {
        labels: <?php echo json_encode($monthly_labels); ?>,
        datasets: [{
            label: 'Goals',
            data: <?php echo json_encode($monthly_goals); ?>,
            backgroundColor: 'rgba(40,106,79,.6)',
            borderColor: '#52b788',
            borderWidth: 1,
            borderRadius: 4,
        }]
    },
    options: Object.assign({}, chartDefaults, { maintainAspectRatio: true })
});

// Position chart
new Chart(document.getElementById('positionChart'), {
    type: 'doughnut',
    data: {
        labels: <?php echo json_encode($pos_labels); ?>,
        datasets: [{
            data: <?php echo json_encode($pos_data); ?>,
            backgroundColor: ['rgba(202,138,4,.7)','rgba(40,106,79,.7)','rgba(59,130,246,.7)','rgba(124,29,53,.7)'],
            borderColor: ['#fbbf24','#52b788','#93c5fd','#d94f70'],
            borderWidth: 1,
        }]
    },
    options: {
        plugins: { legend: { position: 'bottom', labels: { color: '#8a8a96', font: { size: 11 } } } },
        maintainAspectRatio: true
    }
});
</script>
</body>
</html>
