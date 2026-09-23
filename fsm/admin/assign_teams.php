<?php
// assign_teams.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id = getTeamId();
$set_id = $_GET['set_id'] ?? null;

if (!$set_id) {
    header('Location: manage_matches.php');
    exit();
}

// Get set details
$stmt = $pdo->prepare("
    SELECT s.*, m.match_name
    FROM sets s
    JOIN matches m ON s.match_id = m.id
    WHERE s.id = ? AND m.team_id = ?
");
$stmt->execute([$set_id, $team_id]);
$set = $stmt->fetch();

if (!$set) {
    header('Location: manage_matches.php');
    exit();
}

// Get all teams for this match
$teams_stmt = $pdo->prepare("
    SELECT * FROM match_teams
    WHERE match_id = ?
    ORDER BY team_name ASC
");
$teams_stmt->execute([$set['match_id']]);
$all_teams = $teams_stmt->fetchAll();

// Process form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['assign_teams'])) {
    $team1_id = $_POST['team1_id'] ?? null;
    $team2_id = $_POST['team2_id'] ?? null;

    if ($team1_id && $team2_id && $team1_id != $team2_id) {
        $stmt = $pdo->prepare("
            UPDATE sets
            SET team1_id = ?, team2_id = ?
            WHERE id = ?
        ");
        $stmt->execute([$team1_id, $team2_id, $set_id]);
        header("Location: match_detail.php?id={$set['match_id']}&tab=sets");
        exit();
    } else {
        $error = "Please select two different teams.";
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Assign Teams — Noisers Football Pro</title>
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
                    <div class="page-title">Assign Teams — Set #<?php echo $set['set_number']; ?></div>
                    <div class="page-sub"><?php echo htmlspecialchars($set['match_name']); ?></div>
                </div>
                <a href="match_detail.php?id=<?php echo $set['match_id']; ?>&tab=sets" class="btn btn-ghost btn-sm">Cancel</a>
            </div>
        </div>

        <?php if (!empty($error)): ?>
        <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <?php if (count($all_teams) >= 2): ?>
        <form method="POST">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                <?php foreach (['team1' => 'Team 1', 'team2' => 'Team 2'] as $field => $label): ?>
                <div class="card">
                    <div class="card-hd"><span class="card-hd-title"><?php echo $label; ?></span></div>
                    <div style="padding:12px;display:flex;flex-direction:column;gap:8px;">
                        <?php foreach ($all_teams as $t):
                            $pc = count(json_decode($t['players'], true) ?: []);
                        ?>
                        <label style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:7px;cursor:pointer;transition:background .15s;"
                               onmouseover="this.style.background='var(--pitch-700)'" onmouseout="this.style.background='transparent'">
                            <input type="radio" name="<?php echo $field; ?>_id" value="<?php echo $t['id']; ?>" required class="check" style="border-radius:50%;">
                            <?php if ($t['color']): ?>
                            <span style="width:14px;height:14px;border-radius:50%;background:<?php echo htmlspecialchars($t['color']); ?>;flex-shrink:0;"></span>
                            <?php endif; ?>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:700;font-size:.875rem;"><?php echo htmlspecialchars($t['team_name']); ?></div>
                                <div style="font-size:.72rem;color:var(--text-muted);"><?php echo $pc; ?> players</div>
                            </div>
                        </label>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <a href="match_detail.php?id=<?php echo $set['match_id']; ?>&tab=sets" class="btn btn-ghost btn-sm">Cancel</a>
                <button type="submit" name="assign_teams" class="btn btn-primary btn-sm">Assign Teams</button>
            </div>
        </form>
        <?php else: ?>
        <div class="empty-state">
            <p>Not enough teams created. Create at least 2 teams first.</p>
            <a href="randomize_sets.php?match_id=<?php echo $set['match_id']; ?>" class="btn btn-primary btn-sm" style="margin-top:14px;">Create Teams</a>
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
</body>
</html>
