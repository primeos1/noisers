<?php
// admin/player_profile.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id = getTeamId();
$player_id = $_GET['id'] ?? null;

if (!$player_id) {
    header('Location: manage_players.php');
    exit();
}

// Get player details
$stmt = $pdo->prepare("SELECT * FROM players WHERE id = ? AND team_id = ?");
$stmt->execute([$player_id, $team_id]);
$player = $stmt->fetch();

if (!$player) {
    header('Location: manage_players.php?error=player_not_found');
    exit();
}

// Get player's match history — goals/assists from set_events (authoritative source)
$match_stmt = $pdo->prepare("
    SELECT m.*, pms.minutes_played, pms.yellow_cards, pms.red_cards,
           (SELECT COUNT(*) FROM set_events se
            JOIN sets s ON se.set_id = s.id
            WHERE se.player_id = ? AND se.event_type = 'goal' AND s.match_id = m.id) as goals,
           (SELECT COUNT(*) FROM set_events se
            JOIN sets s ON se.set_id = s.id
            WHERE se.player_id = ? AND se.event_type = 'assist' AND s.match_id = m.id) as assists
    FROM player_match_stats pms
    JOIN matches m ON pms.match_id = m.id
    WHERE pms.player_id = ? AND m.team_id = ?
    ORDER BY m.match_date DESC
    LIMIT 10
");
$match_stmt->execute([$player_id, $player_id, $player_id, $team_id]);
$matches = $match_stmt->fetchAll();

// Get aggregate career stats — goals/assists from set_events (authoritative source)
$total_stats_stmt = $pdo->prepare("
    SELECT COUNT(*) as total_matches,
           SUM(pms.yellow_cards) as total_yellow_cards,
           SUM(pms.red_cards) as total_red_cards,
           SUM(pms.minutes_played) as total_minutes,
           (SELECT COUNT(*) FROM set_events se
            JOIN sets s ON se.set_id = s.id
            WHERE se.player_id = ? AND se.event_type = 'goal') as total_goals,
           (SELECT COUNT(*) FROM set_events se
            JOIN sets s ON se.set_id = s.id
            WHERE se.player_id = ? AND se.event_type = 'assist') as total_assists
    FROM player_match_stats pms WHERE pms.player_id = ?
");
$total_stats_stmt->execute([$player_id, $player_id, $player_id]);
$total_stats = $total_stats_stmt->fetch();

// Get set events for this player
$set_events_stmt = $pdo->prepare("
    SELECT se.*, m.match_name, s.set_number, m.match_date
    FROM set_events se
    JOIN sets s ON se.set_id = s.id
    JOIN matches m ON s.match_id = m.id
    WHERE se.player_id = ? AND m.team_id = ?
    ORDER BY m.match_date DESC, s.set_number ASC, se.minute ASC
    LIMIT 20
");
$set_events_stmt->execute([$player_id, $team_id]);
$events = $set_events_stmt->fetchAll();

$pos = $player['position'] ?? '';
$pos_class = match($pos) {
    'Goalkeeper' => 'pos-gk',
    'Defender'   => 'pos-df',
    'Midfielder' => 'pos-mf',
    'Forward'    => 'pos-fw',
    default      => 'badge-muted',
};
$rating = (int)($player['rating'] ?? 0);
$total_matches  = (int)($total_stats['total_matches'] ?? 0);
$total_goals    = (int)($total_stats['total_goals'] ?? 0);
$total_assists  = (int)($total_stats['total_assists'] ?? 0);
$total_yellows  = (int)($total_stats['total_yellow_cards'] ?? 0);
$total_reds     = (int)($total_stats['total_red_cards'] ?? 0);
$total_minutes  = (int)($total_stats['total_minutes'] ?? 0);
$avg_minutes    = $total_matches > 0 ? round($total_minutes / $total_matches, 1) : 0;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title><?php echo htmlspecialchars($player['full_name']); ?> — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
    <style>
    .player-hero {
        background: var(--pitch-800);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 24px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
    }
    .player-hero-avatar {
        width: 88px; height: 88px;
        border-radius: 12px;
        background: var(--burg-900);
        color: var(--burg-300);
        display: flex; align-items: center; justify-content: center;
        font-size: 2.4rem; font-weight: 800; letter-spacing: -.02em;
        flex-shrink: 0; overflow: hidden;
    }
    .player-hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .player-hero-info { flex: 1; min-width: 0; }
    .player-hero-name {
        font-size: 1.55rem; font-weight: 800; letter-spacing: -.02em;
        color: var(--text-main); line-height: 1.1;
    }
    .player-hero-meta {
        display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-top: 9px;
    }
    .player-num-chip {
        font-size: 0.72rem; font-weight: 700; color: var(--text-muted);
        background: var(--pitch-700); border: 1px solid var(--border);
        border-radius: 4px; padding: 3px 8px;
    }

    /* Tabs */
    .tab-bar {
        display: flex; gap: 4px;
        background: var(--pitch-800); border: 1px solid var(--border);
        border-radius: 8px; padding: 5px;
        margin-bottom: 20px;
        overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
    .tab-bar::-webkit-scrollbar { height: 0; }
    .tab-btn {
        flex-shrink: 0; padding: 7px 16px; border-radius: 5px;
        background: transparent; border: none;
        color: var(--text-muted); font-family: 'Jost', sans-serif;
        font-size: 0.8rem; font-weight: 600; letter-spacing: .01em;
        cursor: pointer; transition: background .15s, color .15s; white-space: nowrap;
    }
    .tab-btn:hover { background: var(--pitch-700); color: var(--text-main); }
    .tab-btn.active { background: var(--burg-800); color: var(--text-main); }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; }

    /* Info rows */
    .info-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 0; border-bottom: 1px solid var(--pitch-700);
    }
    .info-row:last-child { border-bottom: none; }
    .info-row-lbl { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; }
    .info-row-val { font-size: 0.875rem; color: var(--text-main); font-weight: 600; text-align: right; }

    /* Event timeline */
    .evt-list { display: flex; flex-direction: column; gap: 8px; }
    .evt-group-hd {
        font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: .07em; color: var(--text-muted);
        padding: 14px 0 4px;
    }
    .evt-group-hd:first-child { padding-top: 0; }
    .evt-item {
        display: flex; align-items: flex-start; gap: 11px;
        padding: 10px 12px;
        background: var(--pitch-700); border-radius: 7px;
    }
    .evt-icon {
        width: 30px; height: 30px; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; font-size: 0.85rem; line-height: 1;
    }
    .evt-goal   { background: rgba(45,106,79,.2);   color: var(--forest-300); }
    .evt-assist { background: rgba(59,130,246,.14); color: #93c5fd; }
    .evt-yellow { background: rgba(202,138,4,.14);  color: #fbbf24; }
    .evt-red    { background: rgba(220,38,38,.14);  color: #f87171; }
    .evt-other  { background: var(--pitch-600);     color: var(--text-dim); }
    .evt-type { font-size: 0.825rem; font-weight: 700; color: var(--text-main); }
    .evt-meta { font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; }

    /* Health alert card border */
    .card-health { border-color: rgba(220,38,38,.25) !important; }
    .card-health .card-hd-title { color: #f87171 !important; }

    /* Grid for overview cards */
    .overview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
    }
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
    }

    @media (max-width: 639px) {
        .player-hero { padding: 16px; gap: 14px; }
        .player-hero-name { font-size: 1.25rem; }
        .player-hero-avatar { width: 68px; height: 68px; font-size: 1.8rem; }
    }
    </style>
</head>
<body>
<div class="page-shell">

    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="sidebar-brand">
            <a href="dashboard.php" class="sidebar-logo">NOISER FC <em>PRO</em></a>
            <div class="sidebar-team-name"><?php echo htmlspecialchars($_SESSION['team_name'] ?? ''); ?></div>
            <div class="sidebar-role-chip">Admin</div>
        </div>
        <nav class="sidebar-nav">
            <a href="dashboard.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Dashboard
            </a>
            <a href="manage_players.php" class="sidebar-link active">
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

    <!-- Main -->
    <main class="main-area">

        <!-- Page header -->
        <div class="page-hd">
            <div class="page-hd-row">
                <div>
                    <a href="manage_players.php" class="btn btn-ghost btn-sm" style="margin-bottom:10px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                        Players
                    </a>
                    <div class="page-title"><?php echo htmlspecialchars($player['full_name']); ?></div>
                    <div class="page-sub">Player profile</div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;">
                    <a href="manage_players.php?action=edit&id=<?php echo (int)$player_id; ?>" class="btn btn-ghost btn-sm">Edit Player</a>
                    <a href="manage_players.php?delete=1&id=<?php echo (int)$player_id; ?>"
                       class="btn btn-danger btn-sm"
                       onclick="return confirm('Delete <?php echo htmlspecialchars(addslashes($player['full_name'])); ?>? This cannot be undone.')">Delete</a>
                </div>
            </div>
        </div>

        <!-- Player hero -->
        <div class="player-hero">
            <div class="player-hero-avatar">
                <?php if (!empty($player['profile_image'])): ?>
                    <img src="../assets/uploads/teams/<?php echo $team_id; ?>/players/<?php echo htmlspecialchars($player['profile_image']); ?>"
                         alt=""
                         onerror="this.style.display='none';this.parentElement.textContent='<?php echo strtoupper(substr($player['full_name'],0,1)); ?>';">
                <?php else: ?>
                    <?php echo strtoupper(substr($player['full_name'], 0, 1)); ?>
                <?php endif; ?>
            </div>
            <div class="player-hero-info">
                <div class="player-hero-name"><?php echo htmlspecialchars($player['full_name']); ?></div>
                <div class="player-hero-meta">
                    <?php if ($player['player_number']): ?>
                    <span class="player-num-chip">#<?php echo htmlspecialchars($player['player_number']); ?></span>
                    <?php endif; ?>
                    <?php if ($pos): ?>
                    <span class="badge <?php echo $pos_class; ?>"><?php echo $pos; ?></span>
                    <?php endif; ?>
                    <span class="badge <?php echo $player['is_active'] ? 'badge-forest' : 'badge-muted'; ?>">
                        <?php echo $player['is_active'] ? 'Active' : 'Inactive'; ?>
                    </span>
                    <span class="stars">
                        <?php for ($i = 1; $i <= 5; $i++): ?>
                        <span class="<?php echo $i <= $rating ? 'star-on' : 'star-off'; ?>">★</span>
                        <?php endfor; ?>
                    </span>
                </div>
            </div>
        </div>

        <!-- Stats strip -->
        <div class="stats-strip" style="margin-bottom:20px;">
            <div class="stat-box">
                <div class="stat-num"><?php echo $total_matches; ?></div>
                <div class="stat-lbl">Matches</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:var(--forest-400);"><?php echo $total_goals; ?></div>
                <div class="stat-lbl">Goals</div>
            </div>
            <div class="stat-box">
                <div class="stat-num"><?php echo $total_assists; ?></div>
                <div class="stat-lbl">Assists</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:#fbbf24;"><?php echo $total_yellows; ?></div>
                <div class="stat-lbl">Yellows</div>
            </div>
        </div>

        <!-- Tab bar -->
        <div class="tab-bar">
            <button class="tab-btn active" data-tab="overview">Overview</button>
            <button class="tab-btn" data-tab="matches">Match History</button>
            <button class="tab-btn" data-tab="stats">Statistics</button>
            <button class="tab-btn" data-tab="events">Events</button>
        </div>

        <!-- Overview tab -->
        <div class="tab-pane active" id="overview">
            <div class="overview-grid">
                <div class="card">
                    <div class="card-hd"><span class="card-hd-title">Personal</span></div>
                    <div class="card-body">
                        <?php if ($player['height']): ?>
                        <div class="info-row"><span class="info-row-lbl">Height</span><span class="info-row-val"><?php echo $player['height']; ?> cm</span></div>
                        <?php endif; ?>
                        <?php if ($player['weight']): ?>
                        <div class="info-row"><span class="info-row-lbl">Weight</span><span class="info-row-val"><?php echo $player['weight']; ?> kg</span></div>
                        <?php endif; ?>
                        <?php if (!empty($player['date_of_birth'])): ?>
                        <div class="info-row"><span class="info-row-lbl">Date of Birth</span><span class="info-row-val"><?php echo date('M d, Y', strtotime($player['date_of_birth'])); ?></span></div>
                        <?php endif; ?>
                        <?php if ($player['preferred_foot']): ?>
                        <div class="info-row"><span class="info-row-lbl">Preferred Foot</span><span class="info-row-val"><?php echo htmlspecialchars($player['preferred_foot']); ?></span></div>
                        <?php endif; ?>
                        <?php if ($player['blood_type']): ?>
                        <div class="info-row"><span class="info-row-lbl">Blood Type</span><span class="info-row-val"><?php echo htmlspecialchars($player['blood_type']); ?></span></div>
                        <?php endif; ?>
                        <?php if (!$player['height'] && !$player['weight'] && empty($player['date_of_birth']) && !$player['preferred_foot'] && !$player['blood_type']): ?>
                        <div style="font-size:.825rem;color:var(--text-muted);">No personal information on record.</div>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="card">
                    <div class="card-hd"><span class="card-hd-title">Playing</span></div>
                    <div class="card-body">
                        <div class="info-row">
                            <span class="info-row-lbl">Position</span>
                            <span class="info-row-val"><?php if ($pos): ?><span class="badge <?php echo $pos_class; ?>"><?php echo $pos; ?></span><?php else: ?>—<?php endif; ?></span>
                        </div>
                        <div class="info-row">
                            <span class="info-row-lbl">Number</span>
                            <span class="info-row-val"><?php echo $player['player_number'] ? '#'.htmlspecialchars($player['player_number']) : '—'; ?></span>
                        </div>
                        <div class="info-row">
                            <span class="info-row-lbl">Rating</span>
                            <span class="info-row-val"><span class="stars"><?php for($i=1;$i<=5;$i++) echo '<span class="'.($i<=$rating?'star-on':'star-off').'">★</span>'; ?></span></span>
                        </div>
                        <div class="info-row">
                            <span class="info-row-lbl">Status</span>
                            <span class="info-row-val"><span class="badge <?php echo $player['is_active'] ? 'badge-forest' : 'badge-muted'; ?>"><?php echo $player['is_active'] ? 'Active' : 'Inactive'; ?></span></span>
                        </div>
                        <div class="info-row">
                            <span class="info-row-lbl">Joined</span>
                            <span class="info-row-val"><?php echo date('M d, Y', strtotime($player['created_at'])); ?></span>
                        </div>
                    </div>
                </div>

                <?php if (!empty($player['health_issues'])): ?>
                <div class="card card-health">
                    <div class="card-hd"><span class="card-hd-title">Health Notes</span></div>
                    <div class="card-body" style="font-size:.875rem;color:var(--text-dim);line-height:1.7;">
                        <?php echo nl2br(htmlspecialchars($player['health_issues'])); ?>
                    </div>
                </div>
                <?php endif; ?>

                <?php if (!empty($player['biography'])): ?>
                <div class="card">
                    <div class="card-hd"><span class="card-hd-title">Biography</span></div>
                    <div class="card-body" style="font-size:.875rem;color:var(--text-dim);line-height:1.8;">
                        <?php echo nl2br(htmlspecialchars($player['biography'])); ?>
                    </div>
                </div>
                <?php endif; ?>
            </div>
        </div>

        <!-- Match history tab -->
        <div class="tab-pane" id="matches">
            <?php if (!empty($matches)): ?>
            <div class="card">
                <div class="card-hd">
                    <span class="card-hd-title">Match History</span>
                    <span style="font-size:.72rem;color:var(--text-muted);"><?php echo count($matches); ?> matches</span>
                </div>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Match</th>
                                <th>Location</th>
                                <th style="text-align:center;">G</th>
                                <th style="text-align:center;">A</th>
                                <th style="text-align:center;">Cards</th>
                                <th style="text-align:center;">Min</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($matches as $match): ?>
                            <tr>
                                <td style="white-space:nowrap;font-size:.825rem;"><?php echo date('M d, Y', strtotime($match['match_date'])); ?></td>
                                <td><?php echo htmlspecialchars($match['match_name'] ?? '—'); ?></td>
                                <td style="color:var(--text-muted);font-size:.825rem;"><?php echo htmlspecialchars($match['location'] ?? '—'); ?></td>
                                <td style="text-align:center;font-weight:700;color:<?php echo $match['goals'] > 0 ? 'var(--forest-300)' : 'var(--text-muted)'; ?>;">
                                    <?php echo (int)$match['goals']; ?>
                                </td>
                                <td style="text-align:center;color:var(--text-dim);"><?php echo (int)$match['assists']; ?></td>
                                <td style="text-align:center;">
                                    <?php if ($match['yellow_cards'] > 0): ?>
                                    <span class="badge badge-warning" style="margin-right:3px;"><?php echo (int)$match['yellow_cards']; ?>Y</span>
                                    <?php endif; ?>
                                    <?php if ($match['red_cards'] > 0): ?>
                                    <span class="badge badge-danger"><?php echo (int)$match['red_cards']; ?>R</span>
                                    <?php endif; ?>
                                    <?php if (!$match['yellow_cards'] && !$match['red_cards']): ?>
                                    <span style="color:var(--text-muted);">—</span>
                                    <?php endif; ?>
                                </td>
                                <td style="text-align:center;color:var(--text-dim);"><?php echo (int)$match['minutes_played']; ?>'</td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <?php else: ?>
            <div class="card">
                <div class="card-body" style="text-align:center;padding:52px 20px;">
                    <div style="font-size:.875rem;font-weight:600;color:var(--text-muted);margin-bottom:4px;">No match history</div>
                    <div style="font-size:.8rem;color:var(--text-muted);">This player hasn't participated in any recorded matches yet.</div>
                </div>
            </div>
            <?php endif; ?>
        </div>

        <!-- Statistics tab -->
        <div class="tab-pane" id="stats">
            <div class="stats-grid">
                <div class="card">
                    <div class="card-hd"><span class="card-hd-title">Appearances</span></div>
                    <div class="card-body">
                        <div class="info-row"><span class="info-row-lbl">Matches Played</span><span class="info-row-val"><?php echo $total_matches; ?></span></div>
                        <div class="info-row"><span class="info-row-lbl">Total Minutes</span><span class="info-row-val"><?php echo number_format($total_minutes); ?>'</span></div>
                        <div class="info-row"><span class="info-row-lbl">Avg per Match</span><span class="info-row-val"><?php echo $avg_minutes; ?>'</span></div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-hd"><span class="card-hd-title">Scoring</span></div>
                    <div class="card-body">
                        <div class="info-row">
                            <span class="info-row-lbl">Goals</span>
                            <span class="info-row-val" style="color:var(--forest-300);"><?php echo $total_goals; ?></span>
                        </div>
                        <div class="info-row"><span class="info-row-lbl">Assists</span><span class="info-row-val"><?php echo $total_assists; ?></span></div>
                        <div class="info-row">
                            <span class="info-row-lbl">Contributions</span>
                            <span class="info-row-val"><?php echo $total_goals + $total_assists; ?></span>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-hd"><span class="card-hd-title">Discipline</span></div>
                    <div class="card-body">
                        <div class="info-row">
                            <span class="info-row-lbl">Yellow Cards</span>
                            <span class="info-row-val" style="color:#fbbf24;"><?php echo $total_yellows; ?></span>
                        </div>
                        <div class="info-row">
                            <span class="info-row-lbl">Red Cards</span>
                            <span class="info-row-val" style="color:#f87171;"><?php echo $total_reds; ?></span>
                        </div>
                        <div class="info-row"><span class="info-row-lbl">Total Cards</span><span class="info-row-val"><?php echo $total_yellows + $total_reds; ?></span></div>
                    </div>
                </div>
            </div>

            <?php if (!empty($matches)): ?>
            <div class="card" style="margin-top:16px;">
                <div class="card-hd"><span class="card-hd-title">Recent Performance</span></div>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Match</th>
                                <th>Date</th>
                                <th style="text-align:center;">G</th>
                                <th style="text-align:center;">A</th>
                                <th style="text-align:center;">YC</th>
                                <th style="text-align:center;">RC</th>
                                <th style="text-align:center;">Min</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($matches as $m): ?>
                            <tr>
                                <td><?php echo htmlspecialchars($m['match_name'] ?? '—'); ?></td>
                                <td style="white-space:nowrap;font-size:.825rem;"><?php echo date('M d', strtotime($m['match_date'])); ?></td>
                                <td style="text-align:center;font-weight:700;color:<?php echo $m['goals']>0?'var(--forest-300)':'var(--text-muted)'; ?>"><?php echo (int)$m['goals']; ?></td>
                                <td style="text-align:center;color:var(--text-dim);"><?php echo (int)$m['assists']; ?></td>
                                <td style="text-align:center;color:#fbbf24;"><?php echo (int)$m['yellow_cards']; ?></td>
                                <td style="text-align:center;color:#f87171;"><?php echo (int)$m['red_cards']; ?></td>
                                <td style="text-align:center;color:var(--text-dim);"><?php echo (int)$m['minutes_played']; ?>'</td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <?php endif; ?>
        </div>

        <!-- Events tab -->
        <div class="tab-pane" id="events">
            <?php if (!empty($events)): ?>
            <div class="card">
                <div class="card-hd">
                    <span class="card-hd-title">Match Events</span>
                    <span style="font-size:.72rem;color:var(--text-muted);"><?php echo count($events); ?> events</span>
                </div>
                <div class="card-body">
                    <div class="evt-list">
                        <?php
                        $current_group = null;
                        $event_map = [
                            'goal'             => ['class'=>'evt-goal',   'icon'=>'⚽', 'label'=>'Goal'],
                            'assist'           => ['class'=>'evt-assist', 'icon'=>'🎯', 'label'=>'Assist'],
                            'yellow_card'      => ['class'=>'evt-yellow', 'icon'=>'🟨', 'label'=>'Yellow Card'],
                            'red_card'         => ['class'=>'evt-red',    'icon'=>'🟥', 'label'=>'Red Card'],
                            'substitution_in'  => ['class'=>'evt-other',  'icon'=>'↑',  'label'=>'Sub In'],
                            'substitution_out' => ['class'=>'evt-other',  'icon'=>'↓',  'label'=>'Sub Out'],
                            'injury'           => ['class'=>'evt-red',    'icon'=>'⚕',  'label'=>'Injury'],
                        ];
                        foreach ($events as $ev):
                            $grp = htmlspecialchars($ev['match_name']) . ' — Set ' . (int)$ev['set_number'];
                            if ($current_group !== $grp):
                                $current_group = $grp;
                        ?>
                        <div class="evt-group-hd"><?php echo $grp; ?> · <?php echo date('M d, Y', strtotime($ev['match_date'])); ?></div>
                        <?php
                            endif;
                            $ei = $event_map[$ev['event_type']] ?? ['class'=>'evt-other','icon'=>'●','label'=>ucfirst(str_replace('_',' ',$ev['event_type']))];
                        ?>
                        <div class="evt-item">
                            <div class="evt-icon <?php echo $ei['class']; ?>"><?php echo $ei['icon']; ?></div>
                            <div>
                                <div class="evt-type"><?php echo $ei['label']; ?></div>
                                <div class="evt-meta">
                                    Minute <?php echo (int)$ev['minute']; ?>'<?php if (!empty($ev['notes'])): ?> · <?php echo htmlspecialchars($ev['notes']); ?><?php endif; ?>
                                </div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
            <?php else: ?>
            <div class="card">
                <div class="card-body" style="text-align:center;padding:52px 20px;">
                    <div style="font-size:.875rem;font-weight:600;color:var(--text-muted);margin-bottom:4px;">No events recorded</div>
                    <div style="font-size:.8rem;color:var(--text-muted);">No match events have been logged for this player.</div>
                </div>
            </div>
            <?php endif; ?>
        </div>

    </main>
</div>

<!-- Mobile bottom nav -->
<nav class="mobile-nav" style="font-family:'Jost',sans-serif;">
    <div class="mobile-nav-row">
        <a href="dashboard.php" class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Home
        </a>
        <a href="manage_players.php" class="mobile-nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
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

<script>
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(this.dataset.tab).classList.add('active');
    });
});
</script>
</body>
</html>
