<?php
// player/match_history.php
require_once '../includes/auth.php';
requirePlayer();
require_once '../includes/db_connection.php';

$team_id = getTeamId();

$matches_stmt = $pdo->prepare("
    SELECT m.id, m.match_date, m.match_name, m.location, m.status, m.notes,
           (SELECT COUNT(*) FROM sets s WHERE s.match_id = m.id) as total_sets,
           (SELECT COUNT(DISTINCT player_id) FROM player_match_stats pms WHERE pms.match_id = m.id) as participant_count,
           (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
            WHERE s.match_id = m.id AND se.event_type = 'goal') as total_match_goals
    FROM matches m
    WHERE m.team_id = ?
    GROUP BY m.id
    ORDER BY m.match_date DESC
");
$matches_stmt->execute([$team_id]);
$all_matches = $matches_stmt->fetchAll();

$match_totals = [
    'all' => count($all_matches),
    'completed' => 0,
    'ongoing' => 0,
    'scheduled' => 0,
];

foreach ($all_matches as $match_row) {
    $status_key = strtolower($match_row['status'] ?? '');
    if (isset($match_totals[$status_key])) {
        $match_totals[$status_key]++;
    }
}

function player_match_status_class($status) {
    return match(strtolower($status ?? '')) {
        'completed' => 'ms-completed',
        'ongoing', 'active', 'live' => 'ms-ongoing',
        'scheduled', 'pending' => 'ms-scheduled',
        default => 'badge-muted',
    };
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Match History — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
</head>
<body>
<?php include '../includes/player_nav.php'; ?>

<main class="player-content">
    <header class="player-page-header">
        <div>
            <div class="player-eyebrow">Team Schedule</div>
            <h1 class="player-title">Match History</h1>
            <p class="player-subtitle">Results, active matches, and upcoming fixtures for your squad.</p>
        </div>
        <a href="dashboard.php" class="btn btn-ghost btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Squad
        </a>
    </header>

    <div class="player-scroll-row" aria-label="Match filters">
        <button class="player-filter active" type="button" onclick="filterMatches('all', this)">All <?php echo $match_totals['all']; ?></button>
        <button class="player-filter" type="button" onclick="filterMatches('completed', this)">Results <?php echo $match_totals['completed']; ?></button>
        <button class="player-filter" type="button" onclick="filterMatches('ongoing', this)">Ongoing <?php echo $match_totals['ongoing']; ?></button>
        <button class="player-filter" type="button" onclick="filterMatches('scheduled', this)">Upcoming <?php echo $match_totals['scheduled']; ?></button>
    </div>

    <?php if (empty($all_matches)): ?>
        <div class="card">
            <div class="card-body empty-state">
                <p>No matches on record yet.</p>
            </div>
        </div>
    <?php else: ?>
        <section id="match-list" class="player-list">
            <?php foreach ($all_matches as $match):
                $date_obj = new DateTime($match['match_date']);
                $status = strtolower($match['status'] ?? '');
                $status_class = player_match_status_class($status);
            ?>
            <article class="player-list-card fade-up" data-status="<?php echo htmlspecialchars($status); ?>">
                <div class="player-list-head">
                    <div>
                        <div class="player-list-title"><?php echo htmlspecialchars($match['match_name'] ?: 'Unnamed Match'); ?></div>
                        <div class="player-list-meta">
                            <?php echo $date_obj->format('D, M j, Y'); ?>
                            <?php if (!empty($match['location'])): ?>
                                - <?php echo htmlspecialchars($match['location']); ?>
                            <?php endif; ?>
                        </div>
                    </div>
                    <span class="badge <?php echo $status_class; ?>"><?php echo htmlspecialchars($match['status'] ?: 'Unknown'); ?></span>
                </div>
                <div class="player-list-body">
                    <div class="mini-stat-grid" style="margin-bottom:14px;">
                        <div class="mini-stat">
                            <span class="mini-stat-value"><?php echo (int)$match['total_sets']; ?></span>
                            <span class="mini-stat-label">Sets</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value"><?php echo (int)$match['participant_count']; ?></span>
                            <span class="mini-stat-label">Players</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" style="color:var(--forest-400);"><?php echo (int)$match['total_match_goals']; ?></span>
                            <span class="mini-stat-label">Goals</span>
                        </div>
                    </div>
                    <?php if (!empty($match['notes'])): ?>
                        <p style="font-size:.82rem;color:var(--text-dim);line-height:1.55;margin-bottom:14px;">
                            <?php echo htmlspecialchars($match['notes']); ?>
                        </p>
                    <?php endif; ?>
                    <a href="match_details.php?id=<?php echo (int)$match['id']; ?>" class="btn btn-ghost" style="width:100%;">View Match Stats</a>
                </div>
            </article>
            <?php endforeach; ?>
        </section>
    <?php endif; ?>
</main>

<script>
function filterMatches(status, button) {
    document.querySelectorAll('.player-filter').forEach(item => item.classList.remove('active'));
    button.classList.add('active');

    document.querySelectorAll('[data-status]').forEach(card => {
        card.style.display = (status === 'all' || card.dataset.status === status) ? '' : 'none';
    });
}
</script>
</body>
</html>
