<?php
// admin/manage_players.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

if (session_status() === PHP_SESSION_NONE) { session_start(); }

$team_id  = getTeamId();
$action   = $_GET['action'] ?? 'list';
$player_id = $_GET['id'] ?? null;

// Handle player deletion
if (isset($_GET['delete']) && $player_id) {
    try {
        $stmt = $pdo->prepare("SELECT profile_image FROM players WHERE id = ? AND team_id = ?");
        $stmt->execute([$player_id, $team_id]);
        $player = $stmt->fetch();
        if ($player && $player['profile_image']) {
            $image_path = "../assets/uploads/teams/$team_id/players/" . $player['profile_image'];
            if (file_exists($image_path)) unlink($image_path);
        }
        $stmt = $pdo->prepare("DELETE FROM players WHERE id = ? AND team_id = ?");
        $stmt->execute([$player_id, $team_id]);
        header('Location: manage_players.php?message=deleted');
        exit();
    } catch (PDOException $e) {
        $error = "Error deleting player: " . $e->getMessage();
    }
}

// Handle bulk actions
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['bulk_action'])) {
    $player_ids = $_POST['player_ids'] ?? [];
    if (!empty($player_ids)) {
        $placeholders = str_repeat('?,', count($player_ids) - 1) . '?';
        switch ($_POST['bulk_action']) {
            case 'activate':
                $stmt = $pdo->prepare("UPDATE players SET is_active = TRUE WHERE id IN ($placeholders) AND team_id = ?");
                $stmt->execute(array_merge($player_ids, [$team_id]));
                $message = "Selected players activated";
                break;
            case 'deactivate':
                $stmt = $pdo->prepare("UPDATE players SET is_active = FALSE WHERE id IN ($placeholders) AND team_id = ?");
                $stmt->execute(array_merge($player_ids, [$team_id]));
                $message = "Selected players deactivated";
                break;
            case 'delete':
                $stmt = $pdo->prepare("SELECT profile_image FROM players WHERE id IN ($placeholders) AND team_id = ?");
                $stmt->execute(array_merge($player_ids, [$team_id]));
                foreach ($stmt->fetchAll() as $p) {
                    if ($p['profile_image']) {
                        $ip = "../assets/uploads/teams/$team_id/players/" . $p['profile_image'];
                        if (file_exists($ip)) unlink($ip);
                    }
                }
                $stmt = $pdo->prepare("DELETE FROM players WHERE id IN ($placeholders) AND team_id = ?");
                $stmt->execute(array_merge($player_ids, [$team_id]));
                $message = "Selected players deleted";
                break;
        }
    }
}

// Redirect to player form for add/edit
if ($action === 'add' || $action === 'edit') {
    include 'player_form.php';
    exit();
}

// Stats
$stats_stmt = $pdo->prepare("
    SELECT COUNT(*) as total_players,
           SUM(CASE WHEN is_active = TRUE OR is_active = '1' THEN 1 ELSE 0 END) as active_players,
           AVG(rating) as avg_rating,
           (SELECT COUNT(*) FROM set_events se
            JOIN sets s ON se.set_id = s.id
            JOIN matches m ON s.match_id = m.id
            WHERE se.event_type = 'goal' AND m.team_id = ?) as total_goals,
           (SELECT COUNT(*) FROM set_events se
            JOIN sets s ON se.set_id = s.id
            JOIN matches m ON s.match_id = m.id
            WHERE se.event_type = 'assist' AND m.team_id = ?) as total_assists,
           COALESCE(SUM(yellow_cards), 0) as total_yellow_cards,
           COALESCE(SUM(red_cards), 0) as total_red_cards
    FROM players WHERE team_id = ?
");
$stats_stmt->execute([$team_id, $team_id, $team_id]);
$stats = array_merge(
    ['total_players'=>0,'active_players'=>0,'avg_rating'=>0,'total_goals'=>0,'total_assists'=>0,'total_yellow_cards'=>0,'total_red_cards'=>0],
    (array)$stats_stmt->fetch()
);

$position_stmt = $pdo->prepare("
    SELECT position, COUNT(*) as count
    FROM players WHERE team_id = ? AND (is_active = TRUE OR is_active = '1')
    GROUP BY position
    ORDER BY FIELD(position, 'Goalkeeper', 'Defender', 'Midfielder', 'Forward')
");
$position_stmt->execute([$team_id]);
$positions = $position_stmt->fetchAll();

$search          = $_GET['search'] ?? '';
$filter_position = $_GET['position'] ?? '';
$filter_status   = $_GET['status'] ?? '';

$sql    = "SELECT p.*,
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
           WHERE p.team_id = ?";
$params = [$team_id, $team_id, $team_id];
$types  = [PDO::PARAM_INT, PDO::PARAM_INT, PDO::PARAM_INT];

if (!empty($search)) {
    $sql   .= " AND (p.full_name LIKE ? OR p.player_number LIKE ?)";
    $st     = "%$search%";
    $params[] = $st; $params[] = $st;
    $types[]  = PDO::PARAM_STR; $types[] = PDO::PARAM_STR;
}
if (!empty($filter_position)) {
    $sql .= " AND p.position = ?"; $params[] = $filter_position; $types[] = PDO::PARAM_STR;
}
if ($filter_status === 'active')   $sql .= " AND (p.is_active = TRUE OR p.is_active = '1')";
if ($filter_status === 'inactive') $sql .= " AND (p.is_active = FALSE OR p.is_active = '0')";

$sql .= " ORDER BY p.player_number ASC";
$players_stmt = $pdo->prepare($sql);
foreach ($params as $k => $v) $players_stmt->bindValue($k+1, $v, $types[$k] ?? PDO::PARAM_STR);
$players_stmt->execute();
$players = $players_stmt->fetchAll();

$active_percentage = $stats['total_players'] > 0
    ? round(($stats['active_players'] / $stats['total_players']) * 100) : 0;

$message = $message ?? (($_GET['message'] ?? '') === 'deleted' ? 'Player deleted' : '');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Players — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
</head>
<body>
<div class="page-shell">

    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="sidebar-brand">
            <a href="dashboard.php" class="sidebar-logo">NOISER FC <em>PRO</em></a>
            <div class="sidebar-team-name"><?php echo htmlspecialchars($_SESSION['team_name']); ?></div>
            <div class="sidebar-role-chip">Admin</div>
        </div>
        <nav class="sidebar-nav">
            <a href="dashboard.php"        class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Dashboard
            </a>
            <a href="manage_players.php"   class="sidebar-link active">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Players
            </a>
            <a href="create_match.php"     class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                New Match
            </a>
            <a href="randomize_sets.php"   class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
                Manage Sets
            </a>
            <a href="match_management.php" class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                Live Matches
            </a>
            <div class="sidebar-divider"></div>
            <a href="reports.php"          class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Reports
            </a>
            <a href="settings.php"         class="sidebar-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
            </a>
            <div class="sidebar-divider"></div>
            <a href="../logout.php"        class="sidebar-link" style="color:#f87171;">
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
                    <div class="page-title">Players</div>
                    <div class="page-sub"><?php echo $stats['total_players']; ?> players · <?php echo $stats['active_players']; ?> active</div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <a href="export_players.php" class="btn btn-ghost btn-sm">Export</a>
                    <a href="manage_players.php?action=add" class="btn btn-primary btn-sm">Add Player</a>
                </div>
            </div>
        </div>

        <?php if (!empty($message)): ?>
        <div class="alert alert-success" style="margin-bottom:16px;"><?php echo htmlspecialchars($message); ?></div>
        <?php endif; ?>
        <?php if (!empty($error)): ?>
        <div class="alert alert-error" style="margin-bottom:16px;"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <!-- Stats strip -->
        <div class="stats-strip" style="margin-bottom:20px;">
            <div class="stat-box">
                <div class="stat-num"><?php echo $stats['total_players']; ?></div>
                <div class="stat-lbl">Total</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:var(--forest-400);"><?php echo $stats['active_players']; ?></div>
                <div class="stat-lbl">Active</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:var(--forest-400);"><?php echo (int)$stats['total_goals']; ?></div>
                <div class="stat-lbl">Goals</div>
            </div>
            <div class="stat-box">
                <div class="stat-num"><?php echo (int)$stats['total_assists']; ?></div>
                <div class="stat-lbl">Assists</div>
            </div>
        </div>

        <!-- Toolbar: search + filters + bulk -->
        <form method="GET" id="filterForm">
            <div class="toolbar" style="margin-bottom:14px;">
                <div class="toolbar-left">
                    <div class="search-wrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" name="search" placeholder="Search name or number…"
                               value="<?php echo htmlspecialchars($search); ?>">
                    </div>
                    <select name="position" class="field" style="width:auto;min-width:130px;" onchange="this.form.submit()">
                        <option value="">All Positions</option>
                        <?php foreach (['Goalkeeper','Defender','Midfielder','Forward'] as $pos): ?>
                        <option value="<?php echo $pos; ?>" <?php echo $filter_position===$pos?'selected':''; ?>><?php echo $pos; ?></option>
                        <?php endforeach; ?>
                    </select>
                    <select name="status" class="field" style="width:auto;min-width:120px;" onchange="this.form.submit()">
                        <option value="">All Status</option>
                        <option value="active"   <?php echo $filter_status==='active'?'selected':''; ?>>Active</option>
                        <option value="inactive" <?php echo $filter_status==='inactive'?'selected':''; ?>>Inactive</option>
                    </select>
                    <?php if ($search || $filter_position || $filter_status): ?>
                    <a href="manage_players.php" class="btn btn-ghost btn-sm">Clear</a>
                    <?php endif; ?>
                </div>
                <div class="toolbar-right">
                    <select id="bulkActionSelect" class="field" style="width:auto;min-width:150px;">
                        <option value="">Bulk action…</option>
                        <option value="activate">Activate</option>
                        <option value="deactivate">Deactivate</option>
                        <option value="delete">Delete</option>
                    </select>
                    <button type="button" onclick="runBulkAction()" class="btn btn-ghost btn-sm">Apply</button>
                </div>
            </div>
        </form>

        <!-- Player table -->
        <div class="card">
            <div class="card-hd">
                <span class="card-hd-title">
                    Roster — <?php echo count($players); ?> of <?php echo $stats['total_players']; ?>
                    <?php if ($search || $filter_position || $filter_status): ?>
                    <span class="badge badge-warning" style="margin-left:8px;">Filtered</span>
                    <?php endif; ?>
                </span>
                <label style="display:flex;align-items:center;gap:7px;font-size:.78rem;color:var(--text-muted);cursor:pointer;">
                    <input type="checkbox" class="check" id="selectAll" onchange="toggleAll(this.checked)">
                    Select all
                </label>
            </div>

            <?php if (empty($players)): ?>
            <div class="empty-state">
                <p><?php echo ($search || $filter_position || $filter_status) ? 'No players match your filters' : 'No players yet'; ?></p>
                <a href="manage_players.php?action=add" class="btn btn-primary btn-sm" style="margin-top:14px;">Add First Player</a>
            </div>
            <?php else: ?>

            <form method="POST" id="bulkForm">
                <input type="hidden" name="bulk_action" id="bulkActionInput">

                <!-- Desktop table -->
                <div class="table-wrap" style="display:none;" id="tableDesktop">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width:40px;"></th>
                                <th>Player</th>
                                <th>Position</th>
                                <th>Rating</th>
                                <th>G</th>
                                <th>A</th>
                                <th>YC</th>
                                <th>RC</th>
                                <th>Status</th>
                                <th style="width:110px;"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($players as $p):
                                $ip = "../assets/uploads/teams/{$team_id}/players/" . $p['profile_image'];
                                $has_img = !empty($p['profile_image']) && file_exists($ip);
                                $pos_cls = ['Goalkeeper'=>'pos-gk','Defender'=>'pos-df','Midfielder'=>'pos-mf','Forward'=>'pos-fw'][$p['position']] ?? 'badge-muted';
                            ?>
                            <tr>
                                <td><input type="checkbox" class="check player-cb" name="player_ids[]" value="<?php echo $p['id']; ?>" onchange="updateCount()"></td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:10px;">
                                        <div class="p-avatar">
                                            <?php if ($has_img): ?><img src="<?php echo htmlspecialchars($ip); ?>" alt=""><?php else: ?><?php echo strtoupper(substr($p['full_name'],0,1)); ?><?php endif; ?>
                                        </div>
                                        <div>
                                            <div style="font-weight:600;font-size:.875rem;"><?php echo htmlspecialchars($p['full_name']); ?></div>
                                            <div style="font-size:.72rem;color:var(--text-muted);">#<?php echo $p['player_number'] ?: '—'; ?></div>
                                        </div>
                                    </div>
                                </td>
                                <td><span class="badge <?php echo $pos_cls; ?>"><?php echo $p['position']; ?></span></td>
                                <td>
                                    <span class="stars">
                                        <?php for($i=1;$i<=5;$i++): ?><span class="<?php echo $i<=$p['rating']?'star-on':'star-off'; ?>">★</span><?php endfor; ?>
                                    </span>
                                </td>
                                <td style="font-weight:700;color:var(--forest-400);"><?php echo $p['goals']; ?></td>
                                <td style="font-weight:600;color:var(--pitch-300);"><?php echo $p['assists']; ?></td>
                                <td style="font-weight:600;color:#fbbf24;"><?php echo $p['yellow_cards']; ?></td>
                                <td style="font-weight:600;color:#f87171;"><?php echo $p['red_cards']; ?></td>
                                <td>
                                    <span style="display:inline-flex;align-items:center;gap:5px;font-size:.72rem;font-weight:700;">
                                        <span style="width:6px;height:6px;border-radius:50%;background:<?php echo $p['is_active']?'var(--forest-500)':'var(--pitch-500)'; ?>;"></span>
                                        <?php echo $p['is_active'] ? 'Active' : 'Inactive'; ?>
                                    </span>
                                </td>
                                <td>
                                    <div style="display:flex;gap:4px;">
                                        <a href="player_profile.php?id=<?php echo $p['id']; ?>" class="btn btn-ghost btn-xs" title="View">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </a>
                                        <a href="manage_players.php?action=edit&id=<?php echo $p['id']; ?>" class="btn btn-ghost btn-xs" title="Edit">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </a>
                                        <a href="manage_players.php?delete=1&id=<?php echo $p['id']; ?>"
                                           class="btn btn-danger btn-xs" title="Delete"
                                           onclick="return confirm('Delete <?php echo htmlspecialchars(addslashes($p['full_name'])); ?>? This cannot be undone.')">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                        </a>
                                    </div>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>

                <!-- Mobile cards -->
                <div id="tableMobile" style="padding:12px;display:flex;flex-direction:column;gap:8px;">
                    <?php foreach ($players as $p):
                        $ip = "../assets/uploads/teams/{$team_id}/players/" . $p['profile_image'];
                        $has_img = !empty($p['profile_image']) && file_exists($ip);
                        $pos_cls = ['Goalkeeper'=>'pos-gk','Defender'=>'pos-df','Midfielder'=>'pos-mf','Forward'=>'pos-fw'][$p['position']] ?? 'badge-muted';
                    ?>
                    <div style="background:var(--pitch-700);border:1px solid var(--border);border-radius:8px;padding:14px;">
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                            <input type="checkbox" class="check player-cb" name="player_ids[]" value="<?php echo $p['id']; ?>" onchange="updateCount()">
                            <div class="p-avatar md">
                                <?php if ($has_img): ?><img src="<?php echo htmlspecialchars($ip); ?>" alt=""><?php else: ?><?php echo strtoupper(substr($p['full_name'],0,1)); ?><?php endif; ?>
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo htmlspecialchars($p['full_name']); ?></div>
                                <div style="font-size:.72rem;color:var(--text-muted);">#<?php echo $p['player_number'] ?: '—'; ?></div>
                            </div>
                            <span class="badge <?php echo $pos_cls; ?>"><?php echo substr($p['position'],0,2); ?></span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
                            <?php foreach ([['G',$p['goals'],'var(--forest-400)'],['A',$p['assists'],'var(--pitch-300)'],['YC',$p['yellow_cards'],'#fbbf24'],['RC',$p['red_cards'],'#f87171']] as $s): ?>
                            <div style="text-align:center;background:var(--pitch-800);border-radius:5px;padding:8px 4px;">
                                <div style="font-size:1rem;font-weight:800;color:<?php echo $s[2]; ?>;"><?php echo $s[1]; ?></div>
                                <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);"><?php echo $s[0]; ?></div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                        <div style="display:flex;align-items:center;justify-content:space-between;">
                            <span style="display:inline-flex;align-items:center;gap:5px;font-size:.72rem;font-weight:700;color:var(--text-muted);">
                                <span style="width:6px;height:6px;border-radius:50%;background:<?php echo $p['is_active']?'var(--forest-500)':'var(--pitch-500)'; ?>;"></span>
                                <?php echo $p['is_active']?'Active':'Inactive'; ?>
                            </span>
                            <div style="display:flex;gap:6px;">
                                <a href="player_profile.php?id=<?php echo $p['id']; ?>"           class="btn btn-ghost btn-xs">View</a>
                                <a href="manage_players.php?action=edit&id=<?php echo $p['id']; ?>" class="btn btn-ghost btn-xs">Edit</a>
                                <a href="manage_players.php?delete=1&id=<?php echo $p['id']; ?>"
                                   class="btn btn-danger btn-xs"
                                   onclick="return confirm('Delete <?php echo htmlspecialchars(addslashes($p['full_name'])); ?>?')">Del</a>
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>

            </form>
            <?php endif; ?>
        </div><!-- /card -->

    </main>
</div><!-- /page-shell -->

<!-- Mobile bottom nav -->
<nav class="mobile-nav" style="font-family:'Jost',sans-serif;">
    <div class="mobile-nav-row">
        <a href="dashboard.php"        class="mobile-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Home
        </a>
        <a href="manage_players.php"   class="mobile-nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
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
// Show desktop table or mobile cards based on screen width
function applyView() {
    var w = window.innerWidth;
    document.getElementById('tableDesktop').style.display = w >= 768 ? 'block' : 'none';
    document.getElementById('tableMobile').style.display  = w <  768 ? 'flex'  : 'none';
}
applyView();
window.addEventListener('resize', applyView);

// Checkbox helpers
function toggleAll(checked) {
    document.querySelectorAll('.player-cb').forEach(cb => cb.checked = checked);
    updateCount();
}
function updateCount() {
    var n = document.querySelectorAll('.player-cb:checked').length;
    document.getElementById('selectAll').indeterminate = n > 0 && n < document.querySelectorAll('.player-cb').length;
}

// Bulk action
function runBulkAction() {
    var action = document.getElementById('bulkActionSelect').value;
    if (!action) return;
    var checked = document.querySelectorAll('.player-cb:checked');
    if (!checked.length) { alert('Select at least one player'); return; }
    if (action === 'delete' && !confirm('Delete ' + checked.length + ' player(s)? This cannot be undone.')) return;
    document.getElementById('bulkActionInput').value = action;
    document.getElementById('bulkForm').submit();
}
</script>
</body>
</html>
