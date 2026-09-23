<?php
// admin/manage_matches.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id  = getTeamId();
$action   = $_GET['action'] ?? '';
$match_id = $_GET['id'] ?? null;

if ($action === 'delete' && $match_id) {
    try {
        $pdo->prepare("DELETE FROM matches WHERE id=? AND team_id=?")->execute([$match_id, $team_id]);
        header('Location: manage_matches.php?message=deleted');
        exit();
    } catch (PDOException $e) {
        $error = "Error: " . $e->getMessage();
    }
}

$filter_status    = $_GET['status']    ?? '';
$filter_date_from = $_GET['date_from'] ?? '';
$filter_date_to   = $_GET['date_to']   ?? '';
$search           = $_GET['search']    ?? '';

$sql    = "SELECT m.*, COUNT(DISTINCT s.id) as total_sets, COUNT(DISTINCT pms.player_id) as total_players, MAX(s.updated_at) as last_activity FROM matches m LEFT JOIN sets s ON m.id=s.match_id LEFT JOIN player_match_stats pms ON m.id=pms.match_id WHERE m.team_id=?";
$params = [$team_id];
$types  = [PDO::PARAM_INT];

if (!empty($filter_status)) { $sql .= " AND m.status=?"; $params[] = $filter_status; $types[] = PDO::PARAM_STR; }
if (!empty($filter_date_from)) { $sql .= " AND m.match_date>=?"; $params[] = $filter_date_from; $types[] = PDO::PARAM_STR; }
if (!empty($filter_date_to))   { $sql .= " AND m.match_date<=?"; $params[] = $filter_date_to;   $types[] = PDO::PARAM_STR; }
if (!empty($search)) {
    $sql .= " AND (m.match_name LIKE ? OR m.location LIKE ?)";
    $st = "%$search%"; $params[] = $st; $params[] = $st;
    $types[] = PDO::PARAM_STR; $types[] = PDO::PARAM_STR;
}
$sql .= " GROUP BY m.id ORDER BY m.match_date DESC, m.created_at DESC";

$ms = $pdo->prepare($sql);
foreach ($params as $k => $v) $ms->bindValue($k+1, $v, $types[$k] ?? PDO::PARAM_STR);
$ms->execute();
$matches = $ms->fetchAll();

$stats_stmt = $pdo->prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END) as scheduled, SUM(CASE WHEN status='ongoing' THEN 1 ELSE 0 END) as ongoing, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed FROM matches WHERE team_id=?");
$stats_stmt->execute([$team_id]);
$match_stats = $stats_stmt->fetch();

$message = (($_GET['message'] ?? '') === 'deleted') ? 'Match deleted.' : '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Matches — Noisers Football Pro</title>
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
                    <div class="page-title">Matches</div>
                    <div class="page-sub"><?php echo $match_stats['total']; ?> total · <?php echo $match_stats['ongoing']; ?> ongoing</div>
                </div>
                <a href="create_match.php" class="btn btn-primary btn-sm">New Match</a>
            </div>
        </div>

        <?php if ($message): ?>
        <div class="alert alert-success"><?php echo htmlspecialchars($message); ?></div>
        <?php endif; ?>

        <!-- Stats strip -->
        <div class="stats-strip" style="margin-bottom:16px;">
            <div class="stat-box">
                <div class="stat-num"><?php echo $match_stats['total']; ?></div>
                <div class="stat-lbl">Total</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:var(--forest-400);"><?php echo $match_stats['scheduled']; ?></div>
                <div class="stat-lbl">Scheduled</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:#fbbf24;"><?php echo $match_stats['ongoing']; ?></div>
                <div class="stat-lbl">Ongoing</div>
            </div>
            <div class="stat-box">
                <div class="stat-num"><?php echo $match_stats['completed']; ?></div>
                <div class="stat-lbl">Completed</div>
            </div>
        </div>

        <!-- Filters -->
        <form method="GET" style="margin-bottom:12px;">
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-wrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" name="search" placeholder="Search…" value="<?php echo htmlspecialchars($search); ?>">
                    </div>
                    <select name="status" class="field" style="width:auto;min-width:130px;" onchange="this.form.submit()">
                        <option value="">All Status</option>
                        <?php foreach (['scheduled','ongoing','completed','cancelled'] as $s): ?>
                        <option value="<?php echo $s; ?>" <?php echo $filter_status===$s?'selected':''; ?>><?php echo ucfirst($s); ?></option>
                        <?php endforeach; ?>
                    </select>
                    <input type="date" name="date_from" class="field" style="width:auto;" value="<?php echo htmlspecialchars($filter_date_from); ?>">
                    <input type="date" name="date_to" class="field" style="width:auto;" value="<?php echo htmlspecialchars($filter_date_to); ?>">
                </div>
                <div class="toolbar-right">
                    <button type="submit" class="btn btn-ghost btn-sm">Apply</button>
                    <?php if ($filter_status||$filter_date_from||$filter_date_to||$search): ?>
                    <a href="manage_matches.php" class="btn btn-ghost btn-sm">Clear</a>
                    <?php endif; ?>
                </div>
            </div>
        </form>

        <!-- Quick filters -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
            <a href="?status=ongoing"   class="badge ms-ongoing"   style="padding:5px 10px;text-decoration:none;">Live</a>
            <a href="?status=scheduled" class="badge ms-scheduled" style="padding:5px 10px;text-decoration:none;">Scheduled</a>
            <a href="?status=completed" class="badge ms-completed" style="padding:5px 10px;text-decoration:none;">History</a>
            <a href="?date_from=<?php echo date('Y-m-d'); ?>" class="badge badge-muted" style="padding:5px 10px;text-decoration:none;">Today</a>
        </div>

        <!-- Matches list -->
        <div class="card">
            <div class="card-hd">
                <span class="card-hd-title">
                    <?php echo count($matches); ?> match<?php echo count($matches)!=1?'es':''; ?>
                    <?php if ($filter_status||$filter_date_from||$filter_date_to||$search): ?>
                    <span class="badge badge-warning" style="margin-left:8px;">Filtered</span>
                    <?php endif; ?>
                </span>
            </div>

            <?php if (empty($matches)): ?>
            <div class="empty-state">
                <p><?php echo ($filter_status||$filter_date_from||$filter_date_to||$search)?'No matches match your filters':'No matches yet'; ?></p>
                <a href="create_match.php" class="btn btn-primary btn-sm" style="margin-top:14px;">Create First Match</a>
            </div>
            <?php else: ?>

            <!-- Desktop table -->
            <div class="table-wrap" id="tblDesktop" style="display:none;">
                <table class="data-table">
                    <thead>
                        <tr><th>Match</th><th>Date</th><th>Location</th><th>Status</th><th>Players</th><th>Sets</th><th style="width:170px;"></th></tr>
                    </thead>
                    <tbody>
                        <?php foreach ($matches as $m):
                            $sc = $m['status']==='ongoing'?'ms-ongoing':($m['status']==='completed'?'ms-completed':($m['status']==='scheduled'?'ms-scheduled':'badge-muted'));
                        ?>
                        <tr>
                            <td>
                                <div style="font-weight:700;"><?php echo $m['match_name'] ? htmlspecialchars($m['match_name']) : '<span style="color:var(--text-muted)">Untitled</span>'; ?></div>
                                <?php if ($m['last_activity']): ?><div style="font-size:.7rem;color:var(--text-muted);"><?php echo date('M j, g:i a', strtotime($m['last_activity'])); ?></div><?php endif; ?>
                            </td>
                            <td>
                                <div style="font-weight:600;white-space:nowrap;"><?php echo date('M j, Y', strtotime($m['match_date'])); ?></div>
                                <div style="font-size:.7rem;color:var(--text-muted);"><?php echo date('D', strtotime($m['match_date'])); ?></div>
                            </td>
                            <td style="color:var(--text-muted);font-size:.85rem;"><?php echo $m['location'] ? htmlspecialchars($m['location']) : '—'; ?></td>
                            <td><span class="badge <?php echo $sc; ?>"><?php echo ucfirst($m['status']); ?></span></td>
                            <td style="font-weight:600;"><?php echo $m['total_players']; ?></td>
                            <td style="font-weight:600;"><?php echo $m['total_sets']; ?></td>
                            <td>
                                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                                    <?php if ($m['status']==='scheduled'): ?>
                                    <a href="randomize_sets.php?match_id=<?php echo $m['id']; ?>" class="btn btn-success btn-xs">Prepare</a>
                                    <?php elseif ($m['status']==='ongoing'): ?>
                                    <a href="match_management.php?match_id=<?php echo $m['id']; ?>" class="btn btn-ghost btn-xs" style="color:#fbbf24;border-color:#fbbf2440;">Live</a>
                                    <?php endif; ?>
                                    <a href="match_detail.php?id=<?php echo $m['id']; ?>" class="btn btn-ghost btn-xs">View</a>
                                    <a href="edit_match.php?id=<?php echo $m['id']; ?>" class="btn btn-ghost btn-xs">Edit</a>
                                    <?php if ($m['status']!=='ongoing'): ?>
                                    <a href="manage_matches.php?action=delete&id=<?php echo $m['id']; ?>"
                                       class="btn btn-danger btn-xs"
                                       onclick="return confirm('Delete match &quot;<?php echo htmlspecialchars(addslashes($m['match_name']?:'Untitled')); ?>&quot;? Cannot be undone.')">Del</a>
                                    <?php endif; ?>
                                </div>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <!-- Mobile cards -->
            <div id="tblMobile" style="padding:12px;display:flex;flex-direction:column;gap:10px;">
                <?php foreach ($matches as $m):
                    $sc = $m['status']==='ongoing'?'ms-ongoing':($m['status']==='completed'?'ms-completed':($m['status']==='scheduled'?'ms-scheduled':'badge-muted'));
                ?>
                <div style="background:var(--pitch-700);border:1px solid var(--border);border-radius:8px;padding:14px;">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
                        <div style="min-width:0;flex:1;">
                            <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo $m['match_name'] ? htmlspecialchars($m['match_name']) : 'Untitled Match'; ?></div>
                            <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px;"><?php echo date('D, M j, Y', strtotime($m['match_date'])); ?><?php if ($m['location']): ?> · <?php echo htmlspecialchars($m['location']); ?><?php endif; ?></div>
                        </div>
                        <span class="badge <?php echo $sc; ?>" style="flex-shrink:0;"><?php echo ucfirst($m['status']); ?></span>
                    </div>
                    <div style="display:flex;gap:12px;font-size:.75rem;color:var(--text-muted);margin-bottom:10px;">
                        <span><?php echo $m['total_players']; ?> players</span>
                        <span><?php echo $m['total_sets']; ?> sets</span>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <?php if ($m['status']==='scheduled'): ?>
                        <a href="randomize_sets.php?match_id=<?php echo $m['id']; ?>" class="btn btn-success btn-xs">Prepare</a>
                        <?php elseif ($m['status']==='ongoing'): ?>
                        <a href="match_management.php?match_id=<?php echo $m['id']; ?>" class="btn btn-ghost btn-xs" style="color:#fbbf24;border-color:#fbbf2440;">Live</a>
                        <?php endif; ?>
                        <a href="match_detail.php?id=<?php echo $m['id']; ?>" class="btn btn-ghost btn-xs">View</a>
                        <a href="edit_match.php?id=<?php echo $m['id']; ?>" class="btn btn-ghost btn-xs">Edit</a>
                        <?php if ($m['status']!=='ongoing'): ?>
                        <a href="manage_matches.php?action=delete&id=<?php echo $m['id']; ?>"
                           class="btn btn-danger btn-xs"
                           onclick="return confirm('Delete this match?')">Delete</a>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>

            <?php endif; ?>
        </div>
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
    document.getElementById('tblDesktop').style.display = w >= 768 ? 'block' : 'none';
    document.getElementById('tblMobile').style.display  = w <  768 ? 'flex'  : 'none';
}
applyView();
window.addEventListener('resize', applyView);

<?php if ($match_stats['ongoing'] > 0): ?>
setTimeout(function(){ location.reload(); }, 30000);
<?php endif; ?>
</script>
</body>
</html>
