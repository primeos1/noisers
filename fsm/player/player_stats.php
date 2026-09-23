<?php
// player/player_stats.php
require_once '../includes/auth.php';
requirePlayer();
require_once '../includes/db_connection.php';

$team_id = getTeamId();
$player_id = $_SESSION['player_id'] ?? null;

$team_stats_stmt = $pdo->prepare("
    SELECT
        COUNT(DISTINCT p.id) as total_players,
        (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
         JOIN matches m ON s.match_id = m.id
         WHERE se.event_type = 'goal' AND m.team_id = ?) as total_goals,
        (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
         JOIN matches m ON s.match_id = m.id
         WHERE se.event_type = 'assist' AND m.team_id = ?) as total_assists,
        AVG(p.rating)                       as avg_rating,
        COALESCE(SUM(pms.yellow_cards), 0) as total_yellow_cards,
        COALESCE(SUM(pms.red_cards), 0)    as total_red_cards
    FROM players p
    LEFT JOIN player_match_stats pms ON pms.player_id = p.id
    WHERE p.team_id = ? AND p.is_active = TRUE
");
$team_stats_stmt->execute([$team_id, $team_id, $team_id]);
$team_stats = $team_stats_stmt->fetch();

$top_goals_stmt = $pdo->prepare("
    SELECT p.id, p.full_name, p.player_number, p.position,
           COALESCE(se_g.goals, 0) as goals
    FROM players p
    LEFT JOIN (
        SELECT se.player_id, COUNT(*) as goals
        FROM set_events se JOIN sets s ON se.set_id = s.id JOIN matches m ON s.match_id = m.id
        WHERE se.event_type = 'goal' AND m.team_id = ?
        GROUP BY se.player_id
    ) se_g ON p.id = se_g.player_id
    WHERE p.team_id = ? AND p.is_active = TRUE
    ORDER BY goals DESC
    LIMIT 5
");
$top_goals_stmt->execute([$team_id, $team_id]);
$top_goal_scorers = $top_goals_stmt->fetchAll();

$top_assists_stmt = $pdo->prepare("
    SELECT p.id, p.full_name, p.player_number, p.position,
           COALESCE(se_a.assists, 0) as assists
    FROM players p
    LEFT JOIN (
        SELECT se.player_id, COUNT(*) as assists
        FROM set_events se JOIN sets s ON se.set_id = s.id JOIN matches m ON s.match_id = m.id
        WHERE se.event_type = 'assist' AND m.team_id = ?
        GROUP BY se.player_id
    ) se_a ON p.id = se_a.player_id
    WHERE p.team_id = ? AND p.is_active = TRUE
    ORDER BY assists DESC
    LIMIT 5
");
$top_assists_stmt->execute([$team_id, $team_id]);
$top_assist_makers = $top_assists_stmt->fetchAll();

$top_rating_stmt = $pdo->prepare("
    SELECT p.id, p.full_name, p.player_number, p.position, p.rating
    FROM players p
    WHERE p.team_id = ? AND p.is_active = TRUE AND p.rating > 0
    ORDER BY p.rating DESC
    LIMIT 5
");
$top_rating_stmt->execute([$team_id]);
$top_rated_players = $top_rating_stmt->fetchAll();

$position_stats_stmt = $pdo->prepare("
    SELECT
        p.position,
        COUNT(DISTINCT p.id)                              as player_count,
        AVG(p.rating)                                     as avg_rating,
        COALESCE(SUM(se_g.goals), 0)                      as total_goals,
        COALESCE(SUM(se_a.assists), 0)                    as total_assists,
        COALESCE(SUM(se_g.goals), 0)   / COUNT(DISTINCT p.id) as avg_goals_per_player,
        COALESCE(SUM(se_a.assists), 0) / COUNT(DISTINCT p.id) as avg_assists_per_player
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
    WHERE p.team_id = ? AND p.is_active = TRUE
    GROUP BY p.position
    ORDER BY player_count DESC
");
$position_stats_stmt->execute([$team_id, $team_id, $team_id]);
$position_stats = $position_stats_stmt->fetchAll();

$match_stats_stmt = $pdo->prepare("
    SELECT 
        status,
        COUNT(*) as match_count
    FROM matches
    WHERE team_id = ?
    GROUP BY status
");
$match_stats_stmt->execute([$team_id]);
$match_stats = $match_stats_stmt->fetchAll();

$recent_activity_stmt = $pdo->prepare("
    SELECT 
        se.event_type,
        se.created_at,
        p.full_name,
        p.player_number,
        m.match_name,
        s.set_number
    FROM set_events se
    JOIN players p ON se.player_id = p.id
    JOIN sets s ON se.set_id = s.id
    JOIN matches m ON s.match_id = m.id
    WHERE p.team_id = ?
    ORDER BY se.created_at DESC
    LIMIT 10
");
$recent_activity_stmt->execute([$team_id]);
$recent_activities = $recent_activity_stmt->fetchAll();

$cards_stmt = $pdo->prepare("
    SELECT p.id, p.full_name, p.player_number, p.position,
           COALESCE(SUM(pms.yellow_cards), 0) as yellow_cards,
           COALESCE(SUM(pms.red_cards), 0)    as red_cards,
           COALESCE(SUM(pms.yellow_cards), 0) + (COALESCE(SUM(pms.red_cards), 0) * 2) as card_score
    FROM players p
    LEFT JOIN player_match_stats pms ON pms.player_id = p.id
    WHERE p.team_id = ? AND p.is_active = TRUE
    GROUP BY p.id
    ORDER BY card_score DESC
    LIMIT 5
");
$cards_stmt->execute([$team_id]);
$most_cards = $cards_stmt->fetchAll();

function player_position_badge($position) {
    return match($position ?? '') {
        'Goalkeeper' => 'pos-gk',
        'Defender' => 'pos-df',
        'Midfielder' => 'pos-mf',
        'Forward' => 'pos-fw',
        default => 'badge-muted',
    };
}

function player_event_label($event_type) {
    return match($event_type ?? '') {
        'goal' => 'Goal',
        'assist' => 'Assist',
        'yellow_card' => 'Yellow card',
        'red_card' => 'Red card',
        default => ucwords(str_replace('_', ' ', (string)$event_type)),
    };
}

function player_event_badge($event_type) {
    return match($event_type ?? '') {
        'goal' => 'badge-forest',
        'assist' => 'badge-burg',
        'yellow_card' => 'badge-warning',
        'red_card' => 'badge-danger',
        default => 'badge-muted',
    };
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Team Statistics — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .stats-tab-view { display: none; }
        .stats-tab-view.active { display: block; }
        .activity-row {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 10px;
            align-items: center;
            background: var(--pitch-700);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 11px;
        }
        .activity-time {
            color: var(--text-muted);
            font-size: .72rem;
            white-space: nowrap;
        }
        @media (max-width: 520px) {
            .activity-row { grid-template-columns: auto 1fr; }
            .activity-time { grid-column: 2; }
        }
    </style>
</head>
<body>
<?php include '../includes/player_nav.php'; ?>

<main class="player-content wide">
    <header class="player-page-header">
        <div>
            <div class="player-eyebrow">Performance Room</div>
            <h1 class="player-title">Team Statistics</h1>
            <p class="player-subtitle">Squad totals, leaders, positions, and recent events.</p>
        </div>
        <a href="dashboard.php" class="btn btn-ghost btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Squad
        </a>
    </header>

    <div class="stats-strip">
        <div class="stat-box">
            <div class="stat-num"><?php echo (int)($team_stats['total_players'] ?? 0); ?></div>
            <div class="stat-lbl">Players</div>
        </div>
        <div class="stat-box">
            <div class="stat-num" style="color:var(--forest-400);"><?php echo (int)($team_stats['total_goals'] ?? 0); ?></div>
            <div class="stat-lbl">Goals</div>
        </div>
        <div class="stat-box">
            <div class="stat-num"><?php echo (int)($team_stats['total_assists'] ?? 0); ?></div>
            <div class="stat-lbl">Assists</div>
        </div>
        <div class="stat-box">
            <div class="stat-num" style="color:#fbbf24;"><?php echo number_format((float)($team_stats['avg_rating'] ?? 0), 1); ?></div>
            <div class="stat-lbl">Avg Rating</div>
        </div>
    </div>

    <div class="player-scroll-row" aria-label="Statistics views">
        <button class="player-filter active" type="button" data-view="overview">Overview</button>
        <button class="player-filter" type="button" data-view="performers">Leaders</button>
        <button class="player-filter" type="button" data-view="positions">Positions</button>
        <button class="player-filter" type="button" data-view="activity">Activity</button>
    </div>

    <section class="stats-tab-view active" id="overview">
        <div class="player-card-grid">
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Players by Position</span></div>
                <div class="card-body">
                    <?php if (empty($position_stats)): ?>
                        <div class="empty-state"><p>No position data yet.</p></div>
                    <?php else: ?>
                        <div class="chart-frame"><canvas id="positionDistributionChart"></canvas></div>
                    <?php endif; ?>
                </div>
            </div>
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Match Status</span></div>
                <div class="card-body">
                    <?php if (empty($match_stats)): ?>
                        <div class="empty-state"><p>No match data yet.</p></div>
                    <?php else: ?>
                        <div class="chart-frame"><canvas id="matchStatusChart"></canvas></div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </section>

    <section class="stats-tab-view" id="performers">
        <div class="player-card-grid">
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Top Goal Scorers</span></div>
                <div class="card-body">
                    <?php if (empty($top_goal_scorers)): ?>
                        <div class="empty-state"><p>No goals recorded.</p></div>
                    <?php else: ?>
                        <div class="rank-list">
                            <?php foreach ($top_goal_scorers as $index => $player): ?>
                            <a class="rank-row" href="player_profile.php?id=<?php echo (int)$player['id']; ?>">
                                <span class="rank-number"><?php echo $index + 1; ?></span>
                                <span class="rank-main">
                                    <span class="rank-name"><?php echo htmlspecialchars($player['full_name']); ?></span>
                                    <span class="rank-meta">#<?php echo htmlspecialchars($player['player_number'] ?: 'N/A'); ?> - <?php echo htmlspecialchars($player['position']); ?></span>
                                </span>
                                <span class="rank-value" style="color:var(--forest-400);"><?php echo (int)$player['goals']; ?></span>
                            </a>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>

            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Top Assist Makers</span></div>
                <div class="card-body">
                    <?php if (empty($top_assist_makers)): ?>
                        <div class="empty-state"><p>No assists recorded.</p></div>
                    <?php else: ?>
                        <div class="rank-list">
                            <?php foreach ($top_assist_makers as $index => $player): ?>
                            <a class="rank-row" href="player_profile.php?id=<?php echo (int)$player['id']; ?>">
                                <span class="rank-number"><?php echo $index + 1; ?></span>
                                <span class="rank-main">
                                    <span class="rank-name"><?php echo htmlspecialchars($player['full_name']); ?></span>
                                    <span class="rank-meta">#<?php echo htmlspecialchars($player['player_number'] ?: 'N/A'); ?> - <?php echo htmlspecialchars($player['position']); ?></span>
                                </span>
                                <span class="rank-value"><?php echo (int)$player['assists']; ?></span>
                            </a>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>

            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Top Rated</span></div>
                <div class="card-body">
                    <?php if (empty($top_rated_players)): ?>
                        <div class="empty-state"><p>No player ratings yet.</p></div>
                    <?php else: ?>
                        <div class="rank-list">
                            <?php foreach ($top_rated_players as $index => $player): ?>
                            <a class="rank-row" href="player_profile.php?id=<?php echo (int)$player['id']; ?>">
                                <span class="rank-number"><?php echo $index + 1; ?></span>
                                <span class="rank-main">
                                    <span class="rank-name"><?php echo htmlspecialchars($player['full_name']); ?></span>
                                    <span class="rank-meta">#<?php echo htmlspecialchars($player['player_number'] ?: 'N/A'); ?> - <?php echo htmlspecialchars($player['position']); ?></span>
                                </span>
                                <span class="rank-value" style="color:#fbbf24;"><?php echo number_format((float)$player['rating'], 1); ?></span>
                            </a>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>

            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Cards Watch</span></div>
                <div class="card-body">
                    <?php if (empty($most_cards)): ?>
                        <div class="empty-state"><p>No card records yet.</p></div>
                    <?php else: ?>
                        <div class="rank-list">
                            <?php foreach ($most_cards as $index => $player): ?>
                            <a class="rank-row" href="player_profile.php?id=<?php echo (int)$player['id']; ?>">
                                <span class="rank-number"><?php echo $index + 1; ?></span>
                                <span class="rank-main">
                                    <span class="rank-name"><?php echo htmlspecialchars($player['full_name']); ?></span>
                                    <span class="rank-meta">
                                        <span class="badge badge-warning"><?php echo (int)$player['yellow_cards']; ?>Y</span>
                                        <span class="badge badge-danger"><?php echo (int)$player['red_cards']; ?>R</span>
                                    </span>
                                </span>
                                <span class="rank-value" style="color:#f87171;"><?php echo (int)$player['card_score']; ?></span>
                            </a>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </section>

    <section class="stats-tab-view" id="positions">
        <div class="player-card-grid" style="margin-bottom:14px;">
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Average Rating</span></div>
                <div class="card-body">
                    <?php if (empty($position_stats)): ?>
                        <div class="empty-state"><p>No position data yet.</p></div>
                    <?php else: ?>
                        <div class="chart-frame"><canvas id="positionPerformanceChart"></canvas></div>
                    <?php endif; ?>
                </div>
            </div>
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Goals and Assists</span></div>
                <div class="card-body">
                    <?php if (empty($position_stats)): ?>
                        <div class="empty-state"><p>No position data yet.</p></div>
                    <?php else: ?>
                        <div class="chart-frame"><canvas id="goalsByPositionChart"></canvas></div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-hd"><span class="card-hd-title">Position Detail</span></div>
            <?php if (empty($position_stats)): ?>
                <div class="card-body empty-state"><p>No position data yet.</p></div>
            <?php else: ?>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Position</th>
                                <th style="text-align:center;">Players</th>
                                <th style="text-align:center;">Goals</th>
                                <th style="text-align:center;">Assists</th>
                                <th style="text-align:center;">Avg Rating</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($position_stats as $position): ?>
                            <tr>
                                <td><span class="badge <?php echo player_position_badge($position['position']); ?>"><?php echo htmlspecialchars($position['position']); ?></span></td>
                                <td style="text-align:center;"><?php echo (int)$position['player_count']; ?></td>
                                <td style="text-align:center;color:var(--forest-300);font-weight:700;"><?php echo (int)$position['total_goals']; ?></td>
                                <td style="text-align:center;"><?php echo (int)$position['total_assists']; ?></td>
                                <td style="text-align:center;color:#fbbf24;font-weight:700;"><?php echo number_format((float)$position['avg_rating'], 1); ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </div>
    </section>

    <section class="stats-tab-view" id="activity">
        <div class="card">
            <div class="card-hd"><span class="card-hd-title">Recent Team Activity</span></div>
            <div class="card-body">
                <?php if (empty($recent_activities)): ?>
                    <div class="empty-state"><p>No recent activity yet.</p></div>
                <?php else: ?>
                    <div class="rank-list">
                        <?php foreach ($recent_activities as $activity):
                            $time_ago = time() - strtotime($activity['created_at']);
                            if ($time_ago < 3600) {
                                $time_label = round($time_ago / 60) . ' min ago';
                            } elseif ($time_ago < 86400) {
                                $time_label = round($time_ago / 3600) . ' hours ago';
                            } else {
                                $time_label = round($time_ago / 86400) . ' days ago';
                            }
                        ?>
                        <div class="activity-row">
                            <span class="badge <?php echo player_event_badge($activity['event_type']); ?>"><?php echo player_event_label($activity['event_type']); ?></span>
                            <div class="rank-main">
                                <div class="rank-name">#<?php echo htmlspecialchars($activity['player_number']); ?> <?php echo htmlspecialchars($activity['full_name']); ?></div>
                                <div class="rank-meta"><?php echo htmlspecialchars($activity['match_name'] ?: 'Match'); ?> - Set <?php echo (int)$activity['set_number']; ?></div>
                            </div>
                            <div class="activity-time"><?php echo $time_label; ?></div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </section>
</main>

<script>
const chartText = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim();
const chartGrid = getComputedStyle(document.documentElement).getPropertyValue('--pitch-600').trim();
const positionStats = <?php echo json_encode($position_stats); ?>;
const matchStats = <?php echo json_encode($match_stats); ?>;

document.querySelectorAll('.player-filter[data-view]').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.player-filter[data-view]').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.stats-tab-view').forEach(view => view.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.view).classList.add('active');
    });
});

function chartBaseOptions(extra = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: chartText, boxWidth: 12, font: { family: 'Jost' } }
            }
        },
        ...extra
    };
}

function chartScaleOptions() {
    return {
        y: {
            beginAtZero: true,
            ticks: { color: chartText },
            grid: { color: chartGrid }
        },
        x: {
            ticks: { color: chartText },
            grid: { color: 'transparent' }
        }
    };
}

if (positionStats.length && document.getElementById('positionDistributionChart')) {
    new Chart(document.getElementById('positionDistributionChart'), {
        type: 'doughnut',
        data: {
            labels: positionStats.map(item => item.position),
            datasets: [{
                data: positionStats.map(item => Number(item.player_count) || 0),
                backgroundColor: ['#7c1d35', '#2d6a4f', '#fbbf24', '#93c5fd'],
                borderColor: '#1e1e24',
                borderWidth: 3
            }]
        },
        options: chartBaseOptions()
    });
}

if (matchStats.length && document.getElementById('matchStatusChart')) {
    new Chart(document.getElementById('matchStatusChart'), {
        type: 'bar',
        data: {
            labels: matchStats.map(item => item.status),
            datasets: [{
                label: 'Matches',
                data: matchStats.map(item => Number(item.match_count) || 0),
                backgroundColor: '#7c1d35',
                borderRadius: 6
            }]
        },
        options: chartBaseOptions({ scales: chartScaleOptions() })
    });
}

if (positionStats.length && document.getElementById('positionPerformanceChart')) {
    new Chart(document.getElementById('positionPerformanceChart'), {
        type: 'bar',
        data: {
            labels: positionStats.map(item => item.position),
            datasets: [{
                label: 'Average rating',
                data: positionStats.map(item => Number(item.avg_rating) || 0),
                backgroundColor: '#fbbf24',
                borderRadius: 6
            }]
        },
        options: chartBaseOptions({ scales: chartScaleOptions() })
    });
}

if (positionStats.length && document.getElementById('goalsByPositionChart')) {
    new Chart(document.getElementById('goalsByPositionChart'), {
        type: 'bar',
        data: {
            labels: positionStats.map(item => item.position),
            datasets: [
                {
                    label: 'Goals',
                    data: positionStats.map(item => Number(item.total_goals) || 0),
                    backgroundColor: '#2d6a4f',
                    borderRadius: 6
                },
                {
                    label: 'Assists',
                    data: positionStats.map(item => Number(item.total_assists) || 0),
                    backgroundColor: '#7c1d35',
                    borderRadius: 6
                }
            ]
        },
        options: chartBaseOptions({ scales: chartScaleOptions() })
    });
}
</script>
</body>
</html>
