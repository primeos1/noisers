<?php
// player/match_details.php
require_once '../includes/auth.php';
requirePlayer();
require_once '../includes/db_connection.php';

$team_id = getTeamId();
$match_id = $_GET['id'] ?? null;

if (!$match_id) {
    header('Location: match_history.php');
    exit();
}

$fines_stmt = $pdo->query("SELECT card_type, amount FROM card_fines WHERE is_active = 1");
$fine_rates = $fines_stmt->fetchAll(PDO::FETCH_KEY_PAIR);
$yellow_fine = $fine_rates['yellow'] ?? 5000;
$red_fine = $fine_rates['red'] ?? 10000;

$match_stmt = $pdo->prepare("
    SELECT m.*, 
           (SELECT COUNT(DISTINCT id) FROM sets WHERE match_id = m.id) as total_sets,
           (SELECT SUM(team1_goals + team2_goals) FROM sets WHERE match_id = m.id) as total_goals
    FROM matches m
    WHERE m.id = ? AND m.team_id = ?
");
$match_stmt->execute([$match_id, $team_id]);
$match = $match_stmt->fetch();

if (!$match) {
    header('Location: match_history.php');
    exit();
}

$stats_stmt = $pdo->prepare("
    SELECT 
        p.id, p.full_name, p.player_number, p.position, p.profile_image,
        COALESCE((
            SELECT COUNT(*) 
            FROM set_events se 
            INNER JOIN sets s ON se.set_id = s.id 
            WHERE s.match_id = ? 
            AND se.player_id = p.id 
            AND se.event_type = 'goal'
        ), 0) as goals,
        COALESCE((
            SELECT COUNT(*) 
            FROM set_events se 
            INNER JOIN sets s ON se.set_id = s.id 
            WHERE s.match_id = ? 
            AND se.player_id = p.id 
            AND se.event_type = 'assist'
        ), 0) as assists,
        COALESCE((
            SELECT COUNT(*) 
            FROM set_events se 
            INNER JOIN sets s ON se.set_id = s.id 
            WHERE s.match_id = ? 
            AND se.player_id = p.id 
            AND se.event_type = 'yellow_card'
        ), 0) as yellow_cards,
        COALESCE((
            SELECT COUNT(*) 
            FROM set_events se 
            INNER JOIN sets s ON se.set_id = s.id 
            WHERE s.match_id = ? 
            AND se.player_id = p.id 
            AND se.event_type = 'red_card'
        ), 0) as red_cards
    FROM players p
    WHERE p.team_id = ? AND p.is_active = 1
    HAVING goals > 0 OR assists > 0 OR yellow_cards > 0 OR red_cards > 0
    ORDER BY goals DESC, assists DESC, red_cards ASC, yellow_cards ASC
");
$stats_stmt->execute([$match_id, $match_id, $match_id, $match_id, $team_id]);
$player_stats = $stats_stmt->fetchAll();

$sets_stmt = $pdo->prepare("
    SELECT s.*,
           mt1.team_name as t1_name,
           mt1.color as t1_color,
           mt2.team_name as t2_name,
           mt2.color as t2_color,
           mt1.players as team1_player_ids,
           mt2.players as team2_player_ids
    FROM sets s
    LEFT JOIN match_teams mt1 ON s.team1_id = mt1.id
    LEFT JOIN match_teams mt2 ON s.team2_id = mt2.id
    WHERE s.match_id = ?
    ORDER BY s.set_number ASC
");
$sets_stmt->execute([$match_id]);
$sets = $sets_stmt->fetchAll();

// Fetch all match teams with full player rosters
$rosters_stmt = $pdo->prepare("SELECT * FROM match_teams WHERE match_id = ? ORDER BY id ASC");
$rosters_stmt->execute([$match_id]);
$match_rosters = $rosters_stmt->fetchAll();

foreach ($match_rosters as &$mt) {
    $ids = json_decode($mt['players'] ?? '[]', true);
    if (!empty($ids) && is_array($ids)) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $ps = $pdo->prepare("
            SELECT id, full_name, player_number, position
            FROM players WHERE id IN ($ph) AND team_id = ?
            ORDER BY player_number ASC
        ");
        $ps->execute(array_merge($ids, [$team_id]));
        $mt['roster'] = $ps->fetchAll();
    } else {
        $mt['roster'] = [];
    }
}
unset($mt);

function getPlayerNamesFromJSON($pdo, $player_ids_json, $team_id) {
    if (!$player_ids_json || $player_ids_json === 'null' || $player_ids_json === '[]') {
        return [];
    }

    $player_ids = json_decode($player_ids_json, true);
    if (!is_array($player_ids) || empty($player_ids)) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($player_ids), '?'));
    $stmt = $pdo->prepare("
        SELECT full_name 
        FROM players 
        WHERE id IN ($placeholders) AND team_id = ?
    ");

    $params = array_merge($player_ids, [$team_id]);
    $stmt->execute($params);

    return $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
}

foreach ($sets as &$set) {
    $set['team1_players'] = getPlayerNamesFromJSON($pdo, $set['team1_player_ids'] ?? null, $team_id);
    $set['team2_players'] = getPlayerNamesFromJSON($pdo, $set['team2_player_ids'] ?? null, $team_id);
}
unset($set);

$total_yellows = 0;
$total_reds = 0;
$total_fines = 0;

foreach($player_stats as $stat) {
    $total_yellows += $stat['yellow_cards'];
    $total_reds += $stat['red_cards'];
    $total_fines += ($stat['yellow_cards'] * $yellow_fine) + ($stat['red_cards'] * $red_fine);
}

function player_detail_status_class($status) {
    return match(strtolower($status ?? '')) {
        'completed' => 'ms-completed',
        'ongoing', 'active', 'live' => 'ms-ongoing',
        'scheduled', 'pending' => 'ms-scheduled',
        default => 'badge-muted',
    };
}

function player_detail_position_badge($position) {
    return match($position ?? '') {
        'Goalkeeper' => 'pos-gk',
        'Defender' => 'pos-df',
        'Midfielder' => 'pos-mf',
        'Forward' => 'pos-fw',
        default => 'badge-muted',
    };
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title><?php echo htmlspecialchars($match['match_name'] ?: 'Match'); ?> — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
    <style>
        .detail-top-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 280px;
            gap: 14px;
            margin-bottom: 18px;
        }
        .fine-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid var(--pitch-700);
        }
        .fine-row:last-child { border-bottom: none; }
        .score-pair {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-top: 12px;
        }
        .event-row {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 10px;
            align-items: center;
            background: var(--pitch-700);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 11px;
        }
        @media (max-width: 800px) {
            .detail-top-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 520px) {
            .score-pair { grid-template-columns: 1fr; }
            .event-row { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
<?php include '../includes/player_nav.php'; ?>

<main class="player-content wide">
    <header class="player-page-header">
        <div>
            <div class="player-eyebrow">Match Sheet</div>
            <h1 class="player-title"><?php echo htmlspecialchars($match['match_name'] ?: 'Unnamed Match'); ?></h1>
            <p class="player-subtitle">
                <?php echo date('D, M j, Y', strtotime($match['match_date'])); ?>
                <?php if (!empty($match['location'])): ?>
                    - <?php echo htmlspecialchars($match['location']); ?>
                <?php endif; ?>
            </p>
        </div>
        <a href="match_history.php" class="btn btn-ghost btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            History
        </a>
    </header>

    <div class="stats-strip">
        <div class="stat-box">
            <div class="stat-num"><?php echo (int)$match['total_sets']; ?></div>
            <div class="stat-lbl">Sets</div>
        </div>
        <div class="stat-box">
            <div class="stat-num" style="color:var(--forest-400);"><?php echo (int)($match['total_goals'] ?? 0); ?></div>
            <div class="stat-lbl">Goals</div>
        </div>
        <div class="stat-box">
            <div class="stat-num"><?php echo count($player_stats); ?></div>
            <div class="stat-lbl">Active</div>
        </div>
        <div class="stat-box">
            <div class="stat-num" style="color:#f87171;">NGN <?php echo number_format($total_fines); ?></div>
            <div class="stat-lbl">Fines</div>
        </div>
    </div>

    <section class="detail-top-grid">
        <div class="card">
            <div class="card-hd">
                <span class="card-hd-title">Overview</span>
                <span class="badge <?php echo player_detail_status_class($match['status']); ?>"><?php echo htmlspecialchars($match['status']); ?></span>
            </div>
            <div class="card-body">
                <div class="mini-stat-grid">
                    <div class="mini-stat">
                        <span class="mini-stat-value"><?php echo (int)$total_yellows; ?></span>
                        <span class="mini-stat-label">Yellows</span>
                    </div>
                    <div class="mini-stat">
                        <span class="mini-stat-value" style="color:#f87171;"><?php echo (int)$total_reds; ?></span>
                        <span class="mini-stat-label">Reds</span>
                    </div>
                    <div class="mini-stat">
                        <span class="mini-stat-value"><?php echo count($sets); ?></span>
                        <span class="mini-stat-label">Set Cards</span>
                    </div>
                </div>
                <?php if (!empty($match['notes'])): ?>
                    <div class="divider"></div>
                    <p style="font-size:.86rem;color:var(--text-dim);line-height:1.65;"><?php echo nl2br(htmlspecialchars($match['notes'])); ?></p>
                <?php endif; ?>
            </div>
        </div>

        <div class="card">
            <div class="card-hd"><span class="card-hd-title">Card Fines</span></div>
            <div class="card-body">
                <div class="fine-row">
                    <span class="badge badge-warning">Yellow</span>
                    <strong>NGN <?php echo number_format($yellow_fine); ?></strong>
                </div>
                <div class="fine-row">
                    <span class="badge badge-danger">Red</span>
                    <strong>NGN <?php echo number_format($red_fine); ?></strong>
                </div>
                <div class="fine-row">
                    <span style="font-size:.8rem;color:var(--text-muted);">Match total</span>
                    <strong style="color:#f87171;">NGN <?php echo number_format($total_fines); ?></strong>
                </div>
            </div>
        </div>
    </section>

    <?php if (!empty($match_rosters)): ?>
    <section style="margin-bottom:18px;">
        <div class="section-label">Teams &amp; Rosters</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;">
            <?php
            $pos_abbr = ['Goalkeeper'=>'GK','Defender'=>'DF','Midfielder'=>'MF','Forward'=>'FW'];
            foreach ($match_rosters as $mt):
                $tc = htmlspecialchars($mt['color'] ?? '#888');
            ?>
            <div class="card" style="overflow:hidden;">
                <div style="background:<?php echo $tc; ?>1a;border-bottom:2px solid <?php echo $tc; ?>;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                        <span style="width:10px;height:10px;border-radius:50%;background:<?php echo $tc; ?>;flex-shrink:0;"></span>
                        <span style="font-weight:700;font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo htmlspecialchars($mt['team_name'] ?? 'Team'); ?></span>
                    </div>
                    <span style="font-size:.68rem;font-weight:700;color:var(--text-muted);white-space:nowrap;"><?php echo count($mt['roster']); ?> players</span>
                </div>
                <?php if (empty($mt['roster'])): ?>
                <div style="padding:14px;font-size:.8rem;color:var(--text-muted);">No players assigned</div>
                <?php else: ?>
                <?php foreach ($mt['roster'] as $rp):
                    $pos_cls = player_detail_position_badge($rp['position'] ?? '');
                    $abbr    = $pos_abbr[$rp['position'] ?? ''] ?? '—';
                ?>
                <div style="display:flex;align-items:center;gap:9px;padding:8px 14px;border-bottom:1px solid var(--pitch-700);">
                    <span style="font-size:.68rem;font-weight:800;color:<?php echo $tc; ?>;width:28px;flex-shrink:0;text-align:right;">#<?php echo htmlspecialchars($rp['player_number'] ?? '—'); ?></span>
                    <span style="flex:1;font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo htmlspecialchars($rp['full_name']); ?></span>
                    <span class="badge <?php echo $pos_cls; ?>" style="font-size:.58rem;padding:2px 5px;"><?php echo $abbr; ?></span>
                </div>
                <?php endforeach; ?>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

    <section class="card" style="margin-bottom:18px;">
        <div class="card-hd">
            <span class="card-hd-title">Player Contributions</span>
            <span style="font-size:.72rem;color:var(--text-muted);"><?php echo count($player_stats); ?> players</span>
        </div>
        <?php if (empty($player_stats)): ?>
            <div class="card-body empty-state"><p>No player events recorded for this match.</p></div>
        <?php else: ?>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Position</th>
                            <th style="text-align:center;">G</th>
                            <th style="text-align:center;">A</th>
                            <th style="text-align:center;">Cards</th>
                            <th style="text-align:right;">Fine</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach($player_stats as $stat):
                            $player_fine = ($stat['yellow_cards'] * $yellow_fine) + ($stat['red_cards'] * $red_fine);
                            $initial = strtoupper(substr($stat['full_name'], 0, 1));
                        ?>
                        <tr>
                            <td>
                                <div class="flex-center gap-12">
                                    <div class="p-avatar">
                                        <?php if (!empty($stat['profile_image'])): ?>
                                            <img src="../assets/uploads/teams/<?php echo (int)$team_id; ?>/players/<?php echo htmlspecialchars($stat['profile_image']); ?>" alt="">
                                        <?php else: ?>
                                            <?php echo $initial; ?>
                                        <?php endif; ?>
                                    </div>
                                    <div style="min-width:0;">
                                        <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo htmlspecialchars($stat['full_name']); ?></div>
                                        <div style="font-size:.72rem;color:var(--text-muted);">#<?php echo htmlspecialchars($stat['player_number'] ?: 'N/A'); ?></div>
                                    </div>
                                </div>
                            </td>
                            <td><span class="badge <?php echo player_detail_position_badge($stat['position']); ?>"><?php echo htmlspecialchars($stat['position']); ?></span></td>
                            <td style="text-align:center;color:var(--forest-300);font-weight:800;"><?php echo (int)$stat['goals']; ?></td>
                            <td style="text-align:center;font-weight:700;"><?php echo (int)$stat['assists']; ?></td>
                            <td style="text-align:center;">
                                <?php if ($stat['yellow_cards'] > 0): ?><span class="badge badge-warning"><?php echo (int)$stat['yellow_cards']; ?>Y</span><?php endif; ?>
                                <?php if ($stat['red_cards'] > 0): ?><span class="badge badge-danger"><?php echo (int)$stat['red_cards']; ?>R</span><?php endif; ?>
                                <?php if (!$stat['yellow_cards'] && !$stat['red_cards']): ?><span style="color:var(--text-muted);">-</span><?php endif; ?>
                            </td>
                            <td style="text-align:right;font-weight:800;color:<?php echo $player_fine > 0 ? '#f87171' : 'var(--forest-300)'; ?>;">
                                NGN <?php echo number_format($player_fine); ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </section>

    <section>
        <div class="section-label">Sets Timeline</div>
        <?php if (empty($sets)): ?>
            <div class="card">
                <div class="card-body empty-state"><p>No sets created yet.</p></div>
            </div>
        <?php else: ?>
            <div class="player-list">
                <?php foreach($sets as $set):
                    $team1_color = htmlspecialchars($set['t1_color'] ?: '#2d6a4f');
                    $team2_color = htmlspecialchars($set['t2_color'] ?: '#7c1d35');
                ?>
                <article class="set-card">
                    <div class="set-card-row">
                        <div>
                            <span class="badge <?php echo player_detail_status_class($set['status']); ?>">Set <?php echo (int)$set['set_number']; ?> - <?php echo htmlspecialchars($set['status']); ?></span>
                            <?php if (!empty($set['start_time'])): ?>
                                <div class="player-list-meta"><?php echo date('H:i', strtotime($set['start_time'])); ?></div>
                            <?php endif; ?>
                        </div>
                        <div class="set-score">
                            <span style="color:<?php echo $team1_color; ?>"><?php echo (int)$set['team1_goals']; ?></span>
                            <span style="color:var(--text-muted);">:</span>
                            <span style="color:<?php echo $team2_color; ?>"><?php echo (int)$set['team2_goals']; ?></span>
                        </div>
                    </div>

                    <div class="team-pair">
                        <div class="team-box">
                            <div class="team-box-name">
                                <span class="team-dot" style="background:<?php echo $team1_color; ?>"></span>
                                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo htmlspecialchars($set['t1_name'] ?: 'Team 1'); ?></span>
                            </div>
                            <div class="team-box-copy"><?php echo !empty($set['team1_players']) ? htmlspecialchars(implode(', ', $set['team1_players'])) : 'No players assigned'; ?></div>
                        </div>
                        <div class="team-box">
                            <div class="team-box-name">
                                <span class="team-dot" style="background:<?php echo $team2_color; ?>"></span>
                                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo htmlspecialchars($set['t2_name'] ?: 'Team 2'); ?></span>
                            </div>
                            <div class="team-box-copy"><?php echo !empty($set['team2_players']) ? htmlspecialchars(implode(', ', $set['team2_players'])) : 'No players assigned'; ?></div>
                        </div>
                    </div>

                    <button class="btn btn-ghost btn-sm" type="button" onclick="openSetDetails(<?php echo (int)$set['id']; ?>)" style="width:100%;margin-top:12px;">View Events</button>
                </article>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </section>
</main>

<div id="setModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <div class="modal-panel">
        <div class="modal-head">
            <div>
                <div class="player-eyebrow" style="margin-bottom:2px;">Set Events</div>
                <div id="modalTitle" class="player-list-title">Timeline</div>
            </div>
            <button class="btn btn-ghost btn-icon" type="button" onclick="closeModal()" aria-label="Close set events">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div id="modalContent" class="modal-body"></div>
    </div>
</div>

<script>
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[character]));
}

function eventBadgeClass(type) {
    const classes = {
        goal: 'badge-forest',
        assist: 'badge-burg',
        yellow_card: 'badge-warning',
        red_card: 'badge-danger'
    };
    return classes[type] || 'badge-muted';
}

function eventLabel(type) {
    const labels = {
        goal: 'Goal',
        assist: 'Assist',
        yellow_card: 'Yellow card',
        red_card: 'Red card',
        injury: 'Injury'
    };
    return labels[type] || String(type || 'Event').replaceAll('_', ' ');
}

function openSetDetails(setId) {
    const modal = document.getElementById('setModal');
    const content = document.getElementById('modalContent');
    modal.classList.add('open');
    content.innerHTML = '<div class="empty-state"><p>Loading events...</p></div>';

    fetch(`get_set_events.php?id=${setId}`)
        .then(response => response.json())
        .then(data => {
            if (!data.events || data.events.length === 0) {
                content.innerHTML = '<div class="empty-state"><p>No events recorded for this set.</p></div>';
                return;
            }

            content.innerHTML = `<div class="rank-list">${data.events.map(event => `
                <div class="event-row">
                    <span class="badge ${eventBadgeClass(event.event_type)}">${escapeHtml(eventLabel(event.event_type))}</span>
                    <div>
                        <div class="rank-name">${escapeHtml(event.player_name)}</div>
                        <div class="rank-meta">${event.related_player_name ? 'Assisted by ' + escapeHtml(event.related_player_name) : 'Match event'}</div>
                    </div>
                    <div class="rank-value" style="font-size:1rem;">${escapeHtml(event.minute || 0)}'</div>
                </div>
            `).join('')}</div>`;
        })
        .catch(() => {
            content.innerHTML = '<div class="empty-state"><p>Could not load set events. Please try again.</p></div>';
        });
}

function closeModal() {
    document.getElementById('setModal').classList.remove('open');
}

document.getElementById('setModal').addEventListener('click', event => {
    if (event.target.id === 'setModal') {
        closeModal();
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeModal();
    }
});
</script>
</body>
</html>
