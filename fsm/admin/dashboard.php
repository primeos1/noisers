<?php
$playerImageBase = '../assets/uploads/players/';
$defaultAvatar   = '/assets/images/default-avatar.png';

require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id = getTeamId();

$stmt = $pdo->prepare("SELECT COUNT(*) as total_players FROM players WHERE team_id = ?");
$stmt->execute([$team_id]);
$total_players = $stmt->fetch()['total_players'];

$stmt = $pdo->prepare("
    SELECT m.*,
           COUNT(DISTINCT s.id) as total_sets,
           MAX(s.end_time) as last_set_time,
           COUNT(DISTINCT pms.id) as total_events,
           COUNT(DISTINCT CASE WHEN s.winner IS NOT NULL THEN s.id END) as completed_sets
    FROM matches m
    LEFT JOIN sets s ON m.id = s.match_id
    LEFT JOIN player_match_stats pms ON m.id = pms.match_id
    WHERE m.team_id = ?
    GROUP BY m.id
    ORDER BY m.match_date DESC, m.created_at DESC
    LIMIT 5
");
$stmt->execute([$team_id]);
$recent_matches = $stmt->fetchAll();

$stmt = $pdo->prepare("
    SELECT p.id, p.full_name, p.player_number, p.position, p.rating, p.profile_image,
           COALESCE(se_g.goals, 0) as goals,
           COALESCE(se_a.assists, 0) as assists,
           COALESCE(SUM(pms.yellow_cards), 0) as yellow_cards,
           COALESCE(SUM(pms.red_cards), 0) as red_cards,
           (COALESCE(se_g.goals, 0) * 3 + COALESCE(se_a.assists, 0) * 2 + p.rating * 5
            - COALESCE(SUM(pms.yellow_cards), 0) * 2 - COALESCE(SUM(pms.red_cards), 0) * 10) as performance_score
    FROM players p
    LEFT JOIN player_match_stats pms ON p.id = pms.player_id
    LEFT JOIN (
        SELECT se.player_id, COUNT(*) as goals
        FROM set_events se
        JOIN sets s ON se.set_id = s.id
        JOIN matches m ON s.match_id = m.id
        WHERE se.event_type = 'goal' AND m.team_id = ?
        GROUP BY se.player_id
    ) se_g ON p.id = se_g.player_id
    LEFT JOIN (
        SELECT se.player_id, COUNT(*) as assists
        FROM set_events se
        JOIN sets s ON se.set_id = s.id
        JOIN matches m ON s.match_id = m.id
        WHERE se.event_type = 'assist' AND m.team_id = ?
        GROUP BY se.player_id
    ) se_a ON p.id = se_a.player_id
    WHERE p.team_id = ?
    GROUP BY p.id, p.full_name, p.player_number, p.position, p.rating, p.profile_image, se_g.goals, se_a.assists
    ORDER BY performance_score DESC
    LIMIT 5
");
$stmt->execute([$team_id, $team_id, $team_id]);
$top_performers = $stmt->fetchAll();

$today     = date('Y-m-d');
$next_week = date('Y-m-d', strtotime('+3 days'));
$stmt = $pdo->prepare("
    SELECT *, DATEDIFF(match_date, CURDATE()) as days_until,
           TIME_FORMAT(TIME(created_at), '%H:%i') as scheduled_time
    FROM matches
    WHERE team_id = ? AND match_date BETWEEN ? AND ? AND status = 'scheduled'
    ORDER BY match_date ASC, created_at ASC
    LIMIT 3
");
$stmt->execute([$team_id, $today, $next_week]);
$upcoming_matches = $stmt->fetchAll();

$stmt = $pdo->prepare("
    SELECT id, full_name, position, player_number, health_issues, blood_type, rating,
           CASE WHEN health_issues LIKE '%asthma%' OR health_issues LIKE '%heart%' THEN 'high'
                WHEN health_issues LIKE '%diabet%' THEN 'medium'
                ELSE 'low' END as severity
    FROM players
    WHERE team_id = ? AND health_issues IS NOT NULL AND health_issues != ''
    ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    LIMIT 5
");
$stmt->execute([$team_id]);
$health_alerts = $stmt->fetchAll();

$stmt = $pdo->prepare("
    SELECT
        (SELECT COUNT(*) FROM players WHERE team_id = ? AND rating >= 4) as high_rated_players,
        (SELECT COUNT(*) FROM players WHERE team_id = ? AND rating = 5) as elite_players,
        (SELECT COUNT(DISTINCT player_id) FROM player_match_stats
         WHERE player_id IN (SELECT id FROM players WHERE team_id = ?) AND yellow_cards > 0) as yellow_card_players,
        (SELECT COUNT(DISTINCT player_id) FROM player_match_stats
         WHERE player_id IN (SELECT id FROM players WHERE team_id = ?) AND red_cards > 0) as red_card_players,
        (SELECT COUNT(*) FROM matches WHERE team_id = ? AND status = 'ongoing') as ongoing_matches,
        (SELECT COUNT(*) FROM matches WHERE team_id = ? AND status = 'scheduled') as scheduled_matches,
        (SELECT COUNT(*) FROM sets WHERE winner IS NOT NULL AND match_id IN (SELECT id FROM matches WHERE team_id = ?)) as completed_sets,
        (SELECT COUNT(*) FROM set_events se
         JOIN sets s ON se.set_id = s.id
         JOIN matches m ON s.match_id = m.id
         WHERE se.event_type = 'goal' AND m.team_id = ?) as total_goals,
        (SELECT COUNT(*) FROM set_events se
         JOIN sets s ON se.set_id = s.id
         JOIN matches m ON s.match_id = m.id
         WHERE se.event_type = 'assist' AND m.team_id = ?) as total_assists,
        (SELECT COUNT(DISTINCT match_id) FROM player_match_stats WHERE player_id IN (SELECT id FROM players WHERE team_id = ?)) as matches_with_stats,
        (SELECT AVG(rating) FROM players WHERE team_id = ?) as avg_rating
");
$stmt->execute([$team_id,$team_id,$team_id,$team_id,$team_id,$team_id,$team_id,$team_id,$team_id,$team_id,$team_id]);
$system_stats = $stmt->fetch();

$stmt = $pdo->prepare("
    (SELECT 'match' as type, id, match_name as title, created_at
     FROM matches WHERE team_id = ? ORDER BY created_at DESC LIMIT 2)
    UNION ALL
    (SELECT 'player' as type, id, full_name as title, created_at
     FROM players WHERE team_id = ? ORDER BY created_at DESC LIMIT 2)
    ORDER BY created_at DESC LIMIT 5
");
$stmt->execute([$team_id, $team_id]);
$recent_activity = $stmt->fetchAll();

$stmt = $pdo->prepare("
    SELECT *, TIME_FORMAT(TIME(created_at), '%H:%i') as match_time,
           (SELECT COUNT(*) FROM sets WHERE match_id = m.id) as sets_count
    FROM matches m
    WHERE team_id = ? AND DATE(match_date) = CURDATE()
    ORDER BY status DESC, created_at DESC
    LIMIT 3
");
$stmt->execute([$team_id]);
$today_matches = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Dashboard — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
</head>
<body>
<div class="page-shell">

    <!-- ── Sidebar (desktop) ────────────────────────── -->
    <aside class="sidebar">
        <div class="sidebar-brand">
            <a href="dashboard.php" class="sidebar-logo">NOISER FC <em>PRO</em></a>
            <div class="sidebar-team-name"><?php echo htmlspecialchars($_SESSION['team_name']); ?></div>
            <div class="sidebar-role-chip">Admin</div>
        </div>

        <nav class="sidebar-nav">
            <a href="dashboard.php"          class="sidebar-link active">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Dashboard
            </a>
            <a href="manage_players.php"     class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Players
            </a>
            <a href="create_match.php"       class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                New Match
            </a>
            <a href="randomize_sets.php"     class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
                Manage Sets
            </a>
            <a href="match_management.php"   class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                Live Matches
            </a>
            <a href="manage_cards.php"       class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
                Cards
            </a>

            <div class="sidebar-divider"></div>

            <a href="reports.php"            class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6"  y1="20" x2="6"  y2="14"/></svg>
                Reports
            </a>
            <a href="settings.php"           class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
            </a>

            <div class="sidebar-divider"></div>

            <a href="../logout.php"          class="sidebar-link" style="color:#f87171;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Logout
            </a>
        </nav>
    </aside>

    <!-- ── Main content ─────────────────────────────── -->
    <main class="main-area">

        <!-- Page header -->
        <div class="page-hd">
            <div class="page-hd-row">
                <div>
                    <div class="page-title">Dashboard</div>
                    <div class="page-sub"><?php echo htmlspecialchars($_SESSION['team_name']); ?> · <?php echo date('l, j M Y'); ?></div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <a href="manage_players.php?action=add" class="btn btn-ghost btn-sm">Add Player</a>
                    <a href="create_match.php"              class="btn btn-primary btn-sm">New Match</a>
                </div>
            </div>
        </div>

        <!-- Stats strip -->
        <div class="stats-strip" style="margin-bottom:24px;">
            <div class="stat-box">
                <div class="stat-num"><?php echo $total_players; ?></div>
                <div class="stat-lbl">Players</div>
            </div>
            <div class="stat-box">
                <div class="stat-num"><?php echo (int)$system_stats['total_goals']; ?></div>
                <div class="stat-lbl">Goals</div>
            </div>
            <div class="stat-box">
                <div class="stat-num"><?php echo number_format((float)$system_stats['avg_rating'], 1); ?></div>
                <div class="stat-lbl">Avg Rating</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:<?php echo ($system_stats['yellow_card_players'] + $system_stats['red_card_players']) > 0 ? '#fbbf24' : 'var(--text-main)'; ?>">
                    <?php echo $system_stats['yellow_card_players'] + $system_stats['red_card_players']; ?>
                </div>
                <div class="stat-lbl">Active Cards</div>
            </div>
        </div>

        <!-- Today's matches -->
        <?php if (!empty($today_matches)): ?>
        <div class="card" style="margin-bottom:20px;">
            <div class="card-hd">
                <span class="card-hd-title">Today's Matches</span>
                <span class="badge badge-live">Live Day</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:0;">
                <?php foreach ($today_matches as $m):
                    $sc = $m['status'] === 'ongoing' ? 'ms-ongoing' : ($m['status'] === 'completed' ? 'ms-completed' : 'ms-scheduled');
                ?>
                <div style="padding:14px 18px;border-bottom:1px solid var(--pitch-700);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div style="min-width:0;">
                        <div style="font-weight:700;font-size:.9rem;"><?php echo htmlspecialchars($m['match_name'] ?: 'Match'); ?></div>
                        <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px;">
                            <?php echo $m['match_time'] ?: date('H:i'); ?>
                            <?php if ($m['location']): ?> · <?php echo htmlspecialchars($m['location']); ?><?php endif; ?>
                            · <?php echo $m['sets_count']; ?> sets
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span class="badge <?php echo $sc; ?>"><?php echo ucfirst($m['status']); ?></span>
                        <a href="match_management.php?match_id=<?php echo $m['id']; ?>" class="btn btn-ghost btn-xs">View</a>
                        <?php if ($m['status'] === 'scheduled'): ?>
                        <a href="randomize_sets.php?match_id=<?php echo $m['id']; ?>" class="btn btn-success btn-xs">Start</a>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

        <!-- Two-column data grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:20px;">

            <!-- Top performers -->
            <div class="card">
                <div class="card-hd">
                    <span class="card-hd-title">Top Performers</span>
                    <a href="manage_players.php" style="font-size:.72rem;font-weight:600;color:var(--text-muted);text-decoration:none;">All Players</a>
                </div>
                <?php if (!empty($top_performers)): ?>
                <div>
                    <?php foreach ($top_performers as $i => $p):
                        $img_path = "../assets/uploads/teams/{$team_id}/players/" . $p['profile_image'];
                        $has_img  = !empty($p['profile_image']) && file_exists($img_path);
                        $pos_cls  = ['Goalkeeper'=>'pos-gk','Defender'=>'pos-df','Midfielder'=>'pos-mf','Forward'=>'pos-fw'][$p['position']] ?? 'badge-muted';
                    ?>
                    <div style="padding:12px 18px;border-bottom:1px solid var(--pitch-700);display:flex;align-items:center;gap:12px;">
                        <span style="font-size:.7rem;font-weight:700;color:var(--text-muted);width:16px;text-align:center;"><?php echo $i+1; ?></span>
                        <div class="p-avatar">
                            <?php if ($has_img): ?>
                            <img src="<?php echo htmlspecialchars($img_path); ?>" alt="">
                            <?php else: ?>
                            <?php echo strtoupper(substr($p['full_name'],0,1)); ?>
                            <?php endif; ?>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                #<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?>
                            </div>
                            <div style="margin-top:2px;">
                                <span class="badge <?php echo $pos_cls; ?>"><?php echo $p['position']; ?></span>
                            </div>
                        </div>
                        <div style="display:flex;gap:10px;font-size:.8rem;font-weight:700;flex-shrink:0;">
                            <span style="color:var(--forest-400);"><?php echo $p['goals']; ?>G</span>
                            <span style="color:var(--pitch-300);"><?php echo $p['assists']; ?>A</span>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php else: ?>
                <div class="empty-state"><p>No players yet</p><a href="manage_players.php?action=add" class="btn btn-primary btn-sm" style="margin-top:12px;">Add First Player</a></div>
                <?php endif; ?>
            </div>

            <!-- Recent matches -->
            <div class="card">
                <div class="card-hd">
                    <span class="card-hd-title">Recent Matches</span>
                    <a href="manage_matches.php" style="font-size:.72rem;font-weight:600;color:var(--text-muted);text-decoration:none;">All</a>
                </div>
                <?php if (!empty($recent_matches)): ?>
                <div>
                    <?php foreach ($recent_matches as $m):
                        $sc = $m['status']==='ongoing' ? 'ms-ongoing' : ($m['status']==='completed' ? 'ms-completed' : 'ms-scheduled');
                    ?>
                    <div style="padding:12px 18px;border-bottom:1px solid var(--pitch-700);">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                            <div style="font-weight:600;font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">
                                <?php echo htmlspecialchars($m['match_name'] ?: date('M j', strtotime($m['match_date']))); ?>
                            </div>
                            <span class="badge <?php echo $sc; ?>"><?php echo ucfirst($m['status']); ?></span>
                        </div>
                        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px;display:flex;align-items:center;gap:12px;">
                            <span><?php echo date('M j, Y', strtotime($m['match_date'])); ?></span>
                            <span><?php echo $m['total_sets']; ?> sets · <?php echo $m['completed_sets']; ?> done</span>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php else: ?>
                <div class="empty-state"><p>No matches yet</p><a href="create_match.php" class="btn btn-primary btn-sm" style="margin-top:12px;">Create Match</a></div>
                <?php endif; ?>
            </div>

            <!-- Upcoming matches -->
            <div class="card">
                <div class="card-hd">
                    <span class="card-hd-title">Upcoming</span>
                </div>
                <?php if (!empty($upcoming_matches)): ?>
                <div>
                    <?php foreach ($upcoming_matches as $m): ?>
                    <div style="padding:12px 18px;border-bottom:1px solid var(--pitch-700);display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:.875rem;">
                                <?php echo htmlspecialchars($m['match_name'] ?: 'Match'); ?>
                            </div>
                            <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px;">
                                <?php
                                if ($m['days_until'] == 0)      echo 'Today';
                                elseif ($m['days_until'] == 1)  echo 'Tomorrow';
                                else echo date('D, M j', strtotime($m['match_date']));
                                ?>
                            </div>
                        </div>
                        <a href="randomize_sets.php?match_id=<?php echo $m['id']; ?>" class="btn btn-success btn-xs">Prepare</a>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php else: ?>
                <div class="empty-state"><p>No upcoming matches</p><a href="create_match.php" class="btn btn-ghost btn-sm" style="margin-top:12px;">Schedule One</a></div>
                <?php endif; ?>
            </div>

            <!-- Health alerts -->
            <div class="card">
                <div class="card-hd">
                    <span class="card-hd-title">Health Alerts</span>
                    <?php if (!empty($health_alerts)): ?>
                    <span class="badge badge-warning"><?php echo count($health_alerts); ?></span>
                    <?php endif; ?>
                </div>
                <?php if (!empty($health_alerts)): ?>
                <div>
                    <?php foreach ($health_alerts as $p):
                        $sev_cls = $p['severity']==='high' ? 'badge-danger' : ($p['severity']==='medium' ? 'badge-warning' : 'badge-forest');
                    ?>
                    <div style="padding:12px 18px;border-bottom:1px solid var(--pitch-700);">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
                            <span style="font-weight:600;font-size:.875rem;">
                                #<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?>
                            </span>
                            <span class="badge <?php echo $sev_cls; ?>"><?php echo $p['severity']; ?></span>
                        </div>
                        <div style="font-size:.78rem;color:var(--text-muted);">
                            <?php echo htmlspecialchars(substr($p['health_issues'], 0, 80)); ?><?php if (strlen($p['health_issues'])>80) echo '…'; ?>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php else: ?>
                <div class="empty-state"><p>All players healthy</p></div>
                <?php endif; ?>
            </div>

        </div>

        <!-- System overview row -->
        <div class="card">
            <div class="card-hd">
                <span class="card-hd-title">Season Overview</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0;">
                <?php
                $overview = [
                    ['Ongoing',     $system_stats['ongoing_matches'],    'var(--burg-400)'],
                    ['Scheduled',   $system_stats['scheduled_matches'],  'var(--forest-400)'],
                    ['Sets Done',   $system_stats['completed_sets'],     'var(--text-main)'],
                    ['With Stats',  $system_stats['matches_with_stats'], 'var(--text-main)'],
                    ['Total Assists',$system_stats['total_assists'],     'var(--pitch-300)'],
                    ['Elite (★5)',  $system_stats['elite_players'],      '#fbbf24'],
                ];
                foreach ($overview as $o): ?>
                <div style="padding:16px;border-right:1px solid var(--pitch-700);border-bottom:1px solid var(--pitch-700);text-align:center;">
                    <div style="font-size:1.5rem;font-weight:800;color:<?php echo $o[2]; ?>;"><?php echo (int)$o[1]; ?></div>
                    <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-top:3px;"><?php echo $o[0]; ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>

        <?php if (!empty($recent_activity)): ?>
        <div class="card" style="margin-top:16px;">
            <div class="card-hd"><span class="card-hd-title">Recent Activity</span></div>
            <div>
                <?php foreach ($recent_activity as $a): ?>
                <div style="padding:10px 18px;border-bottom:1px solid var(--pitch-700);display:flex;align-items:center;gap:12px;">
                    <span style="width:6px;height:6px;border-radius:50%;background:<?php echo $a['type']==='match'?'var(--burg-500)':'var(--forest-500)'; ?>;flex-shrink:0;"></span>
                    <span style="flex:1;font-size:.85rem;font-weight:500;"><?php echo htmlspecialchars($a['title']); ?></span>
                    <span style="font-size:.72rem;color:var(--text-muted);white-space:nowrap;"><?php echo date('M j, H:i', strtotime($a['created_at'])); ?></span>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

    </main>
</div>

<!-- Mobile bottom nav -->
<nav class="mobile-nav" style="font-family:'Jost',sans-serif;">
    <div class="mobile-nav-row">
        <a href="dashboard.php"        class="mobile-nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Home
        </a>
        <a href="manage_players.php"   class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Players
        </a>
        <a href="match_management.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            Matches
        </a>
        <a href="randomize_sets.php"   class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
            Sets
        </a>
        <a href="reports.php"          class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6"  y1="20" x2="6"  y2="14"/></svg>
            Reports
        </a>
    </div>
</nav>

<script>
// Auto-refresh every 2 minutes
setTimeout(() => location.reload(), 120000);
</script>
</body>
</html>
