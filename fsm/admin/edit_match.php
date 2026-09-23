<?php
// admin/edit_match.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id = getTeamId();
$match_id = $_GET['id'] ?? null;

if (!$match_id) {
    header('Location: manage_matches.php');
    exit();
}

// Get match details
$match_stmt = $pdo->prepare("SELECT * FROM matches WHERE id = ? AND team_id = ?");
$match_stmt->execute([$match_id, $team_id]);
$match = $match_stmt->fetch();

if (!$match) {
    header('Location: manage_matches.php');
    exit();
}

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $match_name = trim($_POST['match_name']);
    $match_date = $_POST['match_date'];
    $location = trim($_POST['location']);
    $notes = trim($_POST['notes']);
    $status = $_POST['status'];

    try {
        $update_stmt = $pdo->prepare("
            UPDATE matches
            SET match_name = ?, match_date = ?, location = ?, notes = ?, status = ?
            WHERE id = ? AND team_id = ?
        ");
        $update_stmt->execute([$match_name, $match_date, $location, $notes, $status, $match_id, $team_id]);
        header('Location: match_detail.php?id=' . $match_id);
        exit();
    } catch (PDOException $e) {
        $error = "Error updating match: " . $e->getMessage();
    }
}

// Get match players
$players_stmt = $pdo->prepare("
    SELECT p.*
    FROM players p
    INNER JOIN player_match_stats pms ON p.id = pms.player_id
    WHERE pms.match_id = ? AND p.team_id = ?
    ORDER BY p.player_number ASC
");
$players_stmt->execute([$match_id, $team_id]);
$players = $players_stmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Edit Match — Noisers Football Pro</title>
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
                    <div class="page-title">Edit Match</div>
                    <div class="page-sub"><?php echo htmlspecialchars($match['match_name'] ?: 'Untitled Match'); ?> · <?php echo date('M j, Y', strtotime($match['match_date'])); ?></div>
                </div>
                <a href="match_detail.php?id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm">Back to Match</a>
            </div>
        </div>

        <?php if (!empty($error)): ?>
        <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <div class="card" style="max-width:680px;">
            <div class="card-hd"><span class="card-hd-title">Match Details</span></div>
            <form method="POST" style="padding:20px;display:flex;flex-direction:column;gap:16px;">
                <div>
                    <label class="field-label">Match Name</label>
                    <input type="text" name="match_name" class="field"
                           value="<?php echo htmlspecialchars($match['match_name']); ?>"
                           placeholder="e.g., Weekly Friendly">
                </div>
                <div class="form-grid form-grid-2">
                    <div>
                        <label class="field-label">Match Date <span style="color:#f87171;">*</span></label>
                        <input type="date" name="match_date" class="field"
                               value="<?php echo $match['match_date']; ?>" required>
                    </div>
                    <div>
                        <label class="field-label">Status</label>
                        <select name="status" class="field">
                            <?php foreach (['scheduled','ongoing','completed','cancelled'] as $s): ?>
                            <option value="<?php echo $s; ?>" <?php echo $match['status']===$s?'selected':''; ?>>
                                <?php echo ucfirst($s); ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="field-label">Location</label>
                    <input type="text" name="location" class="field"
                           value="<?php echo htmlspecialchars($match['location']); ?>"
                           placeholder="e.g., Main pitch">
                </div>
                <div>
                    <label class="field-label">Notes</label>
                    <textarea name="notes" class="field" rows="3"
                              placeholder="Any additional notes..."><?php echo htmlspecialchars($match['notes']); ?></textarea>
                </div>

                <?php if (!empty($players)): ?>
                <div>
                    <label class="field-label">Players in this match (<?php echo count($players); ?>)</label>
                    <div style="background:var(--pitch-700);border:1px solid var(--border);border-radius:6px;max-height:220px;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;">
                        <?php foreach ($players as $p): ?>
                        <div style="display:flex;align-items:center;gap:10px;font-size:.85rem;">
                            <div class="p-avatar"><?php echo strtoupper(substr($p['full_name'],0,1)); ?></div>
                            <span style="font-weight:600;">#<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?></span>
                            <span style="color:var(--text-muted);font-size:.75rem;"><?php echo $p['position']; ?></span>
                        </div>
                        <?php endforeach; ?>
                    </div>
                    <p style="font-size:.75rem;color:var(--text-muted);margin-top:6px;">Players are managed from the match detail page.</p>
                </div>
                <?php endif; ?>

                <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:4px;border-top:1px solid var(--border);">
                    <a href="match_detail.php?id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm">Cancel</a>
                    <button type="submit" class="btn btn-primary btn-sm">Save Changes</button>
                </div>
            </form>
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
</body>
</html>
