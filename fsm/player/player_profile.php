<?php
// player/player_profile.php
require_once '../includes/auth.php';
requirePlayer();
require_once '../includes/db_connection.php';

$team_id   = getTeamId();
$player_id = $_GET['id'] ?? null;

if (!$player_id) {
    header('Location: dashboard.php');
    exit();
}

// Player details with career stats from player_match_stats
$player_stmt = $pdo->prepare("
    SELECT p.*,
        COALESCE(p.total_yellow_cards, 0) as career_yellow_cards,
        COALESCE(p.total_red_cards, 0)    as career_red_cards,
        COALESCE(p.outstanding_fees, 0)   as outstanding_fees,
        COALESCE(p.total_paid, 0)         as total_paid,
        COALESCE((SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
                  WHERE se.player_id = p.id AND se.event_type = 'goal'), 0) as career_goals,
        COALESCE((SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
                  WHERE se.player_id = p.id AND se.event_type = 'assist'), 0) as career_assists,
        COALESCE((SELECT COUNT(DISTINCT match_id) FROM player_match_stats WHERE player_id = p.id), 0) as total_matches_played,
        COALESCE((SELECT SUM(yellow_cards) FROM player_match_stats WHERE player_id = p.id), 0) as yellow_cards_from_matches,
        COALESCE((SELECT SUM(red_cards)    FROM player_match_stats WHERE player_id = p.id), 0) as red_cards_from_matches
    FROM players p
    WHERE p.id = ? AND p.team_id = ?
");
$player_stmt->execute([$player_id, $team_id]);
$player = $player_stmt->fetch();

if (!$player) {
    header('Location: dashboard.php');
    exit();
}

// Match history
$matches_stmt = $pdo->prepare("
    SELECT m.*, pm.yellow_cards, pm.red_cards, pm.minutes_played,
        (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
         WHERE se.player_id = ? AND se.event_type = 'goal' AND s.match_id = m.id) as goals,
        (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
         WHERE se.player_id = ? AND se.event_type = 'assist' AND s.match_id = m.id) as assists
    FROM matches m
    JOIN player_match_stats pm ON m.id = pm.match_id
    WHERE pm.player_id = ? AND m.team_id = ?
    ORDER BY m.match_date DESC
    LIMIT 20
");
$matches_stmt->execute([$player_id, $player_id, $player_id, $team_id]);
$match_history = $matches_stmt->fetchAll();

// Set statistics
$set_stats_stmt = $pdo->prepare("
    SELECT s.set_number, m.match_date, m.match_name,
        COUNT(CASE WHEN se.event_type = 'goal'        THEN 1 END) as goals,
        COUNT(CASE WHEN se.event_type = 'assist'      THEN 1 END) as assists,
        COUNT(CASE WHEN se.event_type = 'yellow_card' THEN 1 END) as yellow_cards,
        COUNT(CASE WHEN se.event_type = 'red_card'    THEN 1 END) as red_cards
    FROM sets s
    JOIN matches m ON s.match_id = m.id
    LEFT JOIN set_events se ON s.id = se.set_id AND se.player_id = ?
    WHERE m.team_id = ?
    GROUP BY s.id, m.id, s.set_number
    HAVING goals > 0 OR assists > 0 OR yellow_cards > 0 OR red_cards > 0
    ORDER BY m.match_date DESC, s.set_number ASC
    LIMIT 15
");
$set_stats_stmt->execute([$player_id, $team_id]);
$set_stats = $set_stats_stmt->fetchAll();

// Events summary
$all_events_stmt = $pdo->prepare("
    SELECT se.event_type, COUNT(*) as count
    FROM set_events se
    JOIN sets s ON se.set_id = s.id
    JOIN matches m ON s.match_id = m.id
    WHERE se.player_id = ? AND m.team_id = ?
    GROUP BY se.event_type
");
$all_events_stmt->execute([$player_id, $team_id]);
$all_events = $all_events_stmt->fetchAll(PDO::FETCH_KEY_PAIR);

// Payment history
$payments_stmt = $pdo->prepare("
    SELECT cp.*, cf.amount as fine_amount, cf.card_type
    FROM card_payments cp
    LEFT JOIN card_fines cf ON cp.card_type = cf.card_type AND cf.is_active = 1
    WHERE cp.player_id = ?
    ORDER BY cp.created_at DESC
    LIMIT 10
");
$payments_stmt->execute([$player_id]);
$payments_history = $payments_stmt->fetchAll();

// Fine rates
$fines_stmt = $pdo->query("SELECT card_type, amount FROM card_fines WHERE is_active = 1");
$fine_rates   = $fines_stmt->fetchAll(PDO::FETCH_KEY_PAIR);
$yellow_fine  = $fine_rates['yellow'] ?? 5000;
$red_fine     = $fine_rates['red'] ?? 10000;

// Recent form
$form_stmt = $pdo->prepare("
    SELECT m.match_date, m.match_name, pm.yellow_cards, pm.red_cards, pm.minutes_played,
        (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
         WHERE se.player_id = ? AND se.event_type = 'goal' AND s.match_id = m.id) as goals,
        (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id = s.id
         WHERE se.player_id = ? AND se.event_type = 'assist' AND s.match_id = m.id) as assists
    FROM player_match_stats pm
    JOIN matches m ON pm.match_id = m.id
    WHERE pm.player_id = ? AND m.team_id = ? AND m.status = 'completed'
    ORDER BY m.match_date DESC
    LIMIT 5
");
$form_stmt->execute([$player_id, $player_id, $player_id, $team_id]);
$recent_form = $form_stmt->fetchAll();

// Computed stats — sourced from player_match_stats to match admin view
$total_goals    = (int)$player['career_goals'];
$total_assists  = (int)$player['career_assists'];
$total_yellows  = (int)$player['yellow_cards_from_matches'];
$total_reds     = (int)$player['red_cards_from_matches'];

$total_fines        = ($total_yellows * $yellow_fine) + ($total_reds * $red_fine);
$total_paid         = (float)$player['total_paid'];
$outstanding_fees   = (float)$player['outstanding_fees'];
$matches_played     = (int)$player['total_matches_played'];
$contributions      = $total_goals + $total_assists;
$contrib_per_match  = $matches_played > 0 ? round($contributions / $matches_played, 2) : 0;
$rating             = (int)($player['rating'] ?? 0);

$pos = $player['position'] ?? '';
$pos_class = match($pos) {
    'Goalkeeper' => 'pos-gk',
    'Defender'   => 'pos-df',
    'Midfielder' => 'pos-mf',
    'Forward'    => 'pos-fw',
    default      => 'badge-muted',
};
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title><?php echo htmlspecialchars($player['full_name']); ?> — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
    <style>
    .content-wrap {
        max-width: 900px;
        margin: 0 auto;
        padding: 20px 20px 90px;
    }
    @media (max-width: 639px) { .content-wrap { padding: 14px 14px 80px; } }

    /* Player hero */
    .player-hero {
        background: var(--pitch-800);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 22px;
        margin-bottom: 18px;
        display: flex;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
    }
    .player-hero-avatar {
        width: 80px; height: 80px;
        border-radius: 12px;
        background: var(--burg-900);
        color: var(--burg-300);
        display: flex; align-items: center; justify-content: center;
        font-size: 2.2rem; font-weight: 800;
        flex-shrink: 0; overflow: hidden;
    }
    .player-hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .player-hero-name {
        font-size: 1.45rem; font-weight: 800; letter-spacing: -.02em;
        color: var(--text-main); line-height: 1.15;
    }
    .player-hero-meta {
        display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px;
    }
    .player-num-chip {
        font-size: 0.72rem; font-weight: 700; color: var(--text-muted);
        background: var(--pitch-700); border: 1px solid var(--border);
        border-radius: 4px; padding: 3px 8px;
    }

    /* Tabs */
    .tab-bar {
        display: flex; gap: 3px;
        background: var(--pitch-800); border: 1px solid var(--border);
        border-radius: 8px; padding: 4px;
        margin-bottom: 18px;
        overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
    .tab-bar::-webkit-scrollbar { height: 0; }
    .tab-btn {
        flex-shrink: 0; padding: 7px 14px; border-radius: 5px;
        background: transparent; border: none;
        color: var(--text-muted); font-family: 'Jost', sans-serif;
        font-size: 0.775rem; font-weight: 600; letter-spacing: .01em;
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

    /* 2-col grid for overview */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 559px) { .two-col { grid-template-columns: 1fr; } }

    /* Recent form cards */
    .form-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
    }
    @media (max-width: 639px) {
        .form-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 399px) {
        .form-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .form-card {
        background: var(--pitch-700);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px 10px;
        text-align: center;
    }
    .form-score-dot {
        width: 40px; height: 40px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.875rem; font-weight: 800;
        margin: 0 auto 8px;
        color: var(--pitch-900);
    }
    .form-score-good { background: var(--forest-400); }
    .form-score-ok   { background: #93c5fd; }
    .form-score-warn { background: #fbbf24; }
    .form-score-bad  { background: #f87171; }

    .form-stat-row {
        display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 8px;
    }
    .form-stat {
        background: var(--pitch-800); border-radius: 4px; padding: 5px 3px;
    }
    .form-stat-val { font-size: 0.875rem; font-weight: 700; color: var(--text-main); }
    .form-stat-lbl { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); margin-top: 1px; }

    @media (max-width: 639px) {
        .player-hero { padding: 16px; gap: 12px; }
        .player-hero-name { font-size: 1.2rem; }
        .player-hero-avatar { width: 66px; height: 66px; font-size: 1.8rem; }
    }
    </style>
</head>
<body>
<?php include '../includes/player_nav.php'; ?>

<div class="content-wrap">

    <!-- Back link -->
    <a href="dashboard.php" class="btn btn-ghost btn-sm" style="margin-bottom:14px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Squad
    </a>

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
        <div style="flex:1;min-width:0;">
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
    <div class="stats-strip" style="margin-bottom:18px;">
        <div class="stat-box">
            <div class="stat-num"><?php echo $matches_played; ?></div>
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
        <button class="tab-btn" data-tab="matches">Matches</button>
        <button class="tab-btn" data-tab="sets">Sets</button>
        <button class="tab-btn" data-tab="form">Form</button>
        <button class="tab-btn" data-tab="payments">Payments</button>
    </div>

    <!-- Overview tab -->
    <div class="tab-pane active" id="overview">
        <div class="two-col" style="margin-bottom:14px;">
            <!-- Scoring -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Scoring</span></div>
                <div class="card-body">
                    <div class="info-row">
                        <span class="info-row-lbl">Goals</span>
                        <span class="info-row-val" style="color:var(--forest-300);"><?php echo $total_goals; ?></span>
                    </div>
                    <div class="info-row">
                        <span class="info-row-lbl">Assists</span>
                        <span class="info-row-val"><?php echo $total_assists; ?></span>
                    </div>
                    <div class="info-row">
                        <span class="info-row-lbl">Contributions</span>
                        <span class="info-row-val"><?php echo $contributions; ?></span>
                    </div>
                    <div class="info-row">
                        <span class="info-row-lbl">Per match</span>
                        <span class="info-row-val"><?php echo $contrib_per_match; ?></span>
                    </div>
                </div>
            </div>
            <!-- Financial -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Fines</span></div>
                <div class="card-body">
                    <div class="info-row">
                        <span class="info-row-lbl">Total Fines</span>
                        <span class="info-row-val">NGN <?php echo number_format($total_fines); ?></span>
                    </div>
                    <div class="info-row">
                        <span class="info-row-lbl">Total Paid</span>
                        <span class="info-row-val" style="color:var(--forest-300);">NGN <?php echo number_format($total_paid); ?></span>
                    </div>
                    <div class="info-row">
                        <span class="info-row-lbl">Outstanding</span>
                        <span class="info-row-val" style="color:<?php echo $outstanding_fees > 0 ? '#f87171' : 'var(--forest-300)'; ?>;">
                            NGN <?php echo number_format($outstanding_fees); ?>
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="info-row-lbl">Red Cards</span>
                        <span class="info-row-val" style="color:#f87171;"><?php echo $total_reds; ?></span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Personal info -->
        <div class="card">
            <div class="card-hd"><span class="card-hd-title">Player Info</span></div>
            <div class="card-body">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
                    <?php $fields = [
                        ['Height',   $player['height']         ? $player['height'].' cm' : null],
                        ['Weight',   $player['weight']         ? $player['weight'].' kg' : null],
                        ['Foot',     $player['preferred_foot'] ?: null],
                        ['Blood',    $player['blood_type']     ?: null],
                        ['Position', $pos                      ?: null],
                        ['Number',   $player['player_number']  ? '#'.$player['player_number'] : null],
                    ];
                    foreach ($fields as $f): if ($f[1]): ?>
                    <div class="info-row" style="padding-right:12px;">
                        <span class="info-row-lbl"><?php echo $f[0]; ?></span>
                        <span class="info-row-val"><?php echo htmlspecialchars($f[1]); ?></span>
                    </div>
                    <?php endif; endforeach; ?>
                </div>
                <?php if (!array_filter(array_column($fields, 1))): ?>
                <div style="font-size:.825rem;color:var(--text-muted);">No personal info on record.</div>
                <?php endif; ?>
            </div>
        </div>

        <?php if (!empty($player['health_issues'])): ?>
        <div class="card" style="margin-top:14px;border-color:rgba(220,38,38,.25);">
            <div class="card-hd"><span class="card-hd-title" style="color:#f87171;">Health Notes</span></div>
            <div class="card-body" style="font-size:.875rem;color:var(--text-dim);line-height:1.7;">
                <?php echo nl2br(htmlspecialchars($player['health_issues'])); ?>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <!-- Match history tab -->
    <div class="tab-pane" id="matches">
        <?php if (!empty($match_history)): ?>
        <div class="card">
            <div class="card-hd">
                <span class="card-hd-title">Match History</span>
                <span style="font-size:.72rem;color:var(--text-muted);"><?php echo count($match_history); ?> matches</span>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Match</th>
                            <th style="text-align:center;">G</th>
                            <th style="text-align:center;">A</th>
                            <th style="text-align:center;">Cards</th>
                            <th style="text-align:center;">Min</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($match_history as $m): ?>
                        <tr>
                            <td style="white-space:nowrap;font-size:.8rem;">
                                <?php echo date('M j, Y', strtotime($m['match_date'])); ?>
                            </td>
                            <td>
                                <div style="font-size:.875rem;"><?php echo htmlspecialchars($m['match_name'] ?? '—'); ?></div>
                                <?php if ($m['location']): ?>
                                <div style="font-size:.72rem;color:var(--text-muted);"><?php echo htmlspecialchars($m['location']); ?></div>
                                <?php endif; ?>
                            </td>
                            <td style="text-align:center;font-weight:700;color:<?php echo $m['goals']>0?'var(--forest-300)':'var(--text-muted)'; ?>">
                                <?php echo (int)$m['goals']; ?>
                            </td>
                            <td style="text-align:center;color:var(--text-dim);"><?php echo (int)$m['assists']; ?></td>
                            <td style="text-align:center;">
                                <?php if ($m['yellow_cards'] > 0): ?><span class="badge badge-warning" style="margin-right:3px;"><?php echo (int)$m['yellow_cards']; ?>Y</span><?php endif; ?>
                                <?php if ($m['red_cards'] > 0): ?><span class="badge badge-danger"><?php echo (int)$m['red_cards']; ?>R</span><?php endif; ?>
                                <?php if (!$m['yellow_cards'] && !$m['red_cards']): ?><span style="color:var(--text-muted);">—</span><?php endif; ?>
                            </td>
                            <td style="text-align:center;color:var(--text-dim);">
                                <?php echo $m['minutes_played'] > 0 ? (int)$m['minutes_played']."'" : '—'; ?>
                            </td>
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
                <div style="font-size:.8rem;color:var(--text-muted);">No matches on record yet.</div>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <!-- Set stats tab -->
    <div class="tab-pane" id="sets">
        <?php if (!empty($set_stats)): ?>
        <div class="card">
            <div class="card-hd">
                <span class="card-hd-title">Set Statistics</span>
                <span style="font-size:.72rem;color:var(--text-muted);"><?php echo count($set_stats); ?> sets</span>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Match</th>
                            <th style="text-align:center;">Set</th>
                            <th style="text-align:center;">G</th>
                            <th style="text-align:center;">A</th>
                            <th style="text-align:center;">Cards</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($set_stats as $s): ?>
                        <tr>
                            <td style="white-space:nowrap;font-size:.8rem;"><?php echo date('M j', strtotime($s['match_date'])); ?></td>
                            <td style="font-size:.875rem;"><?php echo htmlspecialchars($s['match_name'] ?? '—'); ?></td>
                            <td style="text-align:center;">
                                <span class="badge badge-muted">S<?php echo (int)$s['set_number']; ?></span>
                            </td>
                            <td style="text-align:center;font-weight:700;color:<?php echo $s['goals']>0?'var(--forest-300)':'var(--text-muted)'; ?>">
                                <?php echo (int)$s['goals']; ?>
                            </td>
                            <td style="text-align:center;color:var(--text-dim);"><?php echo (int)$s['assists']; ?></td>
                            <td style="text-align:center;">
                                <?php if ($s['yellow_cards'] > 0): ?><span class="badge badge-warning" style="margin-right:3px;"><?php echo (int)$s['yellow_cards']; ?>Y</span><?php endif; ?>
                                <?php if ($s['red_cards'] > 0): ?><span class="badge badge-danger"><?php echo (int)$s['red_cards']; ?>R</span><?php endif; ?>
                                <?php if (!$s['yellow_cards'] && !$s['red_cards']): ?><span style="color:var(--text-muted);">—</span><?php endif; ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
        <?php else: ?>
        <div class="card">
            <div class="card-body" style="text-align:center;padding:52px 20px;">
                <div style="font-size:.875rem;font-weight:600;color:var(--text-muted);margin-bottom:4px;">No set data</div>
                <div style="font-size:.8rem;color:var(--text-muted);">No set statistics available yet.</div>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <!-- Recent form tab -->
    <div class="tab-pane" id="form">
        <?php if (!empty($recent_form)): ?>
        <div class="card" style="margin-bottom:16px;">
            <div class="card-hd"><span class="card-hd-title">Last 5 Matches</span></div>
            <div class="card-body">
                <div class="form-grid">
                    <?php foreach ($recent_form as $fm):
                        $g = (int)($fm['goals'] ?? 0);
                        $a = (int)($fm['assists'] ?? 0);
                        $y = (int)($fm['yellow_cards'] ?? 0);
                        $r = (int)($fm['red_cards'] ?? 0);
                        $score = ($g * 3) + ($a * 2) - ($y) - ($r * 3);
                        $dot_class = $score >= 3 ? 'form-score-good' : ($score >= 0 ? 'form-score-ok' : ($score >= -2 ? 'form-score-warn' : 'form-score-bad'));
                        $short_name = strlen($fm['match_name']) > 14 ? substr($fm['match_name'],0,14).'…' : $fm['match_name'];
                    ?>
                    <div class="form-card">
                        <div class="form-score-dot <?php echo $dot_class; ?>">
                            <?php echo ($score > 0 ? '+' : '') . $score; ?>
                        </div>
                        <div style="font-size:.72rem;font-weight:600;color:var(--text-main);line-height:1.3;" title="<?php echo htmlspecialchars($fm['match_name']); ?>">
                            <?php echo htmlspecialchars($short_name); ?>
                        </div>
                        <div style="font-size:.65rem;color:var(--text-muted);margin-top:2px;"><?php echo date('M j', strtotime($fm['match_date'])); ?></div>
                        <div class="form-stat-row">
                            <div class="form-stat">
                                <div class="form-stat-val" style="color:var(--forest-300);"><?php echo $g; ?></div>
                                <div class="form-stat-lbl">G</div>
                            </div>
                            <div class="form-stat">
                                <div class="form-stat-val"><?php echo $a; ?></div>
                                <div class="form-stat-lbl">A</div>
                            </div>
                            <div class="form-stat">
                                <div class="form-stat-val" style="color:<?php echo $y>0?'#fbbf24':'var(--text-muted)'; ?>"><?php echo $y; ?></div>
                                <div class="form-stat-lbl">YC</div>
                            </div>
                            <div class="form-stat">
                                <div class="form-stat-val" style="color:<?php echo $r>0?'#f87171':'var(--text-muted)'; ?>"><?php echo $r; ?></div>
                                <div class="form-stat-lbl">RC</div>
                            </div>
                        </div>
                        <?php if (($fm['minutes_played'] ?? 0) > 0): ?>
                        <div style="font-size:.65rem;color:var(--text-muted);margin-top:5px;"><?php echo (int)$fm['minutes_played']; ?> min</div>
                        <?php endif; ?>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
        <?php else: ?>
        <div class="card">
            <div class="card-body" style="text-align:center;padding:52px 20px;">
                <div style="font-size:.875rem;font-weight:600;color:var(--text-muted);margin-bottom:4px;">No recent matches</div>
                <div style="font-size:.8rem;color:var(--text-muted);">No completed matches found.</div>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <!-- Payments tab -->
    <div class="tab-pane" id="payments">
        <!-- Summary -->
        <div class="two-col" style="margin-bottom:14px;">
            <div class="stat-box">
                <div class="stat-num">NGN <?php echo number_format($total_paid); ?></div>
                <div class="stat-lbl">Total Paid</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:<?php echo $outstanding_fees > 0 ? '#f87171' : 'var(--forest-400)'; ?>;">
                    NGN <?php echo number_format($outstanding_fees); ?>
                </div>
                <div class="stat-lbl">Outstanding</div>
            </div>
        </div>

        <?php if (!empty($payments_history)): ?>
        <div class="card">
            <div class="card-hd">
                <span class="card-hd-title">Payment History</span>
                <span style="font-size:.72rem;color:var(--text-muted);"><?php echo count($payments_history); ?> records</span>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Card</th>
                            <th style="text-align:right;">Amount</th>
                            <th>Status</th>
                            <th>Method</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($payments_history as $p): ?>
                        <tr>
                            <td style="white-space:nowrap;font-size:.8rem;">
                                <?php echo $p['payment_date'] ? date('M j, Y', strtotime($p['payment_date'])) : '—'; ?>
                            </td>
                            <td>
                                <span class="badge <?php echo $p['card_type'] === 'red' ? 'badge-danger' : 'badge-warning'; ?>">
                                    <?php echo strtoupper($p['card_type']); ?>
                                </span>
                            </td>
                            <td style="text-align:right;font-weight:700;font-size:.875rem;">NGN <?php echo number_format($p['amount']); ?></td>
                            <td>
                                <?php
                                $st = $p['status'];
                                $stClass = $st === 'paid' ? 'badge-forest' : ($st === 'cleared' ? 'badge-muted' : 'badge-warning');
                                ?>
                                <span class="badge <?php echo $stClass; ?>"><?php echo strtoupper($st); ?></span>
                            </td>
                            <td style="font-size:.825rem;color:var(--text-dim);"><?php echo htmlspecialchars($p['payment_method'] ?? '—'); ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
        <?php else: ?>
        <div class="card">
            <div class="card-body" style="text-align:center;padding:52px 20px;">
                <div style="font-size:.875rem;font-weight:600;color:var(--text-muted);margin-bottom:4px;">No payment records</div>
                <div style="font-size:.8rem;color:var(--text-muted);">No card payment history found.</div>
            </div>
        </div>
        <?php endif; ?>
    </div>

</div>

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
