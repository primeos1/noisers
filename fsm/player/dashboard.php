<?php
// player/dashboard.php
require_once '../includes/auth.php';
requirePlayer();
require_once '../includes/db_connection.php';

$team_id = getTeamId();

$team_stmt = $pdo->prepare("SELECT * FROM teams WHERE id = ?");
$team_stmt->execute([$team_id]);
$team = $team_stmt->fetch();

$players_stmt = $pdo->prepare("
    SELECT p.*,
           COALESCE(se_g.goals, 0)             as career_goals,
           COALESCE(se_a.assists, 0)           as career_assists,
           COALESCE(SUM(pms.yellow_cards), 0)  as career_yellows,
           COALESCE(SUM(pms.red_cards), 0)     as career_reds,
           COUNT(DISTINCT pms.match_id)         as matches_played
    FROM players p
    LEFT JOIN player_match_stats pms ON pms.player_id = p.id
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
    WHERE p.team_id = ? AND p.is_active = '1'
    GROUP BY p.id, se_g.goals, se_a.assists
    ORDER BY career_goals DESC, p.rating DESC, p.player_number ASC
");
$players_stmt->execute([$team_id, $team_id, $team_id]);
$all_players = $players_stmt->fetchAll();

$total_goals   = array_sum(array_column($all_players, 'career_goals'));
$total_assists = array_sum(array_column($all_players, 'career_assists'));
$avg_rating    = count($all_players) > 0 ? array_sum(array_column($all_players, 'rating')) / count($all_players) : 0;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title><?php echo htmlspecialchars($team['team_name'] ?? 'Squad'); ?> — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
    <style>
        /* ── Player card grid ─────────────────────────────── */
        .player-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 10px;
        }
        @media (min-width: 480px) { .player-grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); } }
        @media (min-width: 768px) { .player-grid { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); } }

        .pcard {
            background: var(--pitch-800);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px 14px;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            transition: border-color .18s, transform .18s;
            text-decoration: none;
            color: inherit;
        }
        .pcard:hover {
            border-color: var(--burg-700);
            transform: translateY(-2px);
        }
        .pcard.hidden { display: none; }

        .pcard-avatar {
            width: 64px; height: 64px;
            border-radius: 50%;
            background: var(--burg-900);
            color: var(--burg-400);
            display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 1.5rem;
            overflow: hidden; flex-shrink: 0;
            margin-bottom: 10px;
            position: relative;
        }
        .pcard-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .pcard-number {
            position: absolute;
            bottom: -2px; right: -2px;
            background: var(--pitch-900);
            color: var(--burg-400);
            font-size: .58rem; font-weight: 800;
            padding: 2px 5px;
            border-radius: 8px;
            border: 1px solid var(--border);
            line-height: 1.3;
        }

        .pcard-name {
            font-size: .82rem;
            font-weight: 700;
            text-align: center;
            margin-bottom: 5px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            max-width: 100%;
            color: var(--text-main);
        }

        .pcard-matrix {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            width: 100%;
            background: var(--pitch-700);
            border-radius: 7px;
            overflow: hidden;
            margin: 10px 0 12px;
        }
        .pcard-cell {
            padding: 8px 4px;
            text-align: center;
        }
        .pcard-cell:not(:last-child) { border-right: 1px solid var(--border); }
        .pcard-val { display: block; font-size: .95rem; font-weight: 800; color: var(--text-main); }
        .pcard-lbl { font-size: .56rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); margin-top: 1px; display: block; }

        .pcard-btn {
            width: 100%;
            padding: 8px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--text-dim);
            font-family: 'Jost', sans-serif;
            font-size: .72rem; font-weight: 700;
            text-transform: uppercase; letter-spacing: .06em;
            text-align: center;
            text-decoration: none;
            transition: background .15s, color .15s;
            display: block;
        }
        .pcard-btn:hover { background: var(--burg-800); color: var(--text-main); border-color: var(--burg-800); }

        .pcard-violations {
            position: absolute;
            top: 8px; right: 8px;
            display: flex; flex-direction: column; gap: 3px;
        }
        .vbadge {
            font-size: .6rem; font-weight: 800;
            padding: 2px 6px; border-radius: 3px;
            line-height: 1.4;
        }
        .vbadge-y { background: rgba(202,138,4,.2); color: #fbbf24; }
        .vbadge-r { background: rgba(220,38,38,.2); color: #f87171; }

        /* ── Squad stats scroll ───────────────────────────── */
        .squad-stats {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 4px;
            scrollbar-width: none;
            margin-bottom: 20px;
        }
        .squad-stats::-webkit-scrollbar { display: none; }
        .squad-stat-pill {
            flex: 0 0 auto;
            background: var(--pitch-800);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 16px;
            text-align: center;
            min-width: 88px;
        }
        .squad-stat-num { font-size: 1.4rem; font-weight: 800; color: var(--text-main); }
        .squad-stat-lbl { font-size: .6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-muted); margin-top: 2px; }

        /* ── Search & filter bar ──────────────────────────── */
        .search-filter-bar {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 16px;
        }
        .search-input-wrap {
            display: flex;
            align-items: center;
            background: var(--pitch-700);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 0 14px;
            gap: 10px;
            height: 44px;
            transition: border-color .18s;
        }
        .search-input-wrap:focus-within { border-color: var(--burg-700); }
        .search-input-wrap svg { color: var(--text-muted); flex-shrink: 0; width: 17px; height: 17px; }
        .search-input-wrap input {
            flex: 1;
            background: none;
            border: none;
            outline: none;
            color: var(--text-main);
            font-family: 'Jost', sans-serif;
            font-size: .9rem;
        }
        .search-input-wrap input::placeholder { color: var(--text-muted); }
        .search-clear {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 1.1rem;
            padding: 0 2px;
            line-height: 1;
            display: none;
        }
        .pos-filters {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            scrollbar-width: none;
        }
        .pos-filters::-webkit-scrollbar { display: none; }
        .pos-pill {
            flex-shrink: 0;
            padding: 6px 14px;
            border-radius: 20px;
            background: var(--pitch-700);
            border: 1px solid var(--border);
            color: var(--text-muted);
            font-family: 'Jost', sans-serif;
            font-size: .75rem;
            font-weight: 700;
            cursor: pointer;
            transition: all .15s;
            white-space: nowrap;
        }
        .pos-pill:hover { background: var(--pitch-600); color: var(--text-main); }
        .pos-pill.active { background: var(--burg-800); border-color: var(--burg-700); color: var(--text-main); }

        /* ── No results state ─────────────────────────────── */
        .no-results {
            display: none;
            text-align: center;
            padding: 40px 20px;
            color: var(--text-muted);
        }
        .no-results.visible { display: block; }
    </style>
</head>
<body style="padding-bottom: 72px;">

<?php include '../includes/player_nav.php'; ?>

<div style="max-width:1100px;margin:0 auto;padding:20px 14px 8px;">

    <!-- Squad header -->
    <div style="margin-bottom:18px;">
        <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--burg-400);margin-bottom:5px;">Official Squad</div>
        <h1 style="font-size:clamp(1.5rem,5vw,2.2rem);font-weight:900;letter-spacing:-.02em;line-height:1.1;margin:0 0 3px;"><?php echo htmlspecialchars($team['team_name'] ?? 'Team'); ?></h1>
        <div style="font-size:.78rem;color:var(--text-muted);">Season 2026 · <?php echo count($all_players); ?> active players</div>
    </div>

    <!-- Squad stat pills -->
    <div class="squad-stats">
        <div class="squad-stat-pill">
            <div class="squad-stat-num"><?php echo count($all_players); ?></div>
            <div class="squad-stat-lbl">Players</div>
        </div>
        <div class="squad-stat-pill">
            <div class="squad-stat-num" style="color:var(--forest-400);"><?php echo $total_goals; ?></div>
            <div class="squad-stat-lbl">Goals</div>
        </div>
        <div class="squad-stat-pill">
            <div class="squad-stat-num"><?php echo $total_assists; ?></div>
            <div class="squad-stat-lbl">Assists</div>
        </div>
        <div class="squad-stat-pill">
            <div class="squad-stat-num" style="color:#fbbf24;"><?php echo number_format($avg_rating, 1); ?></div>
            <div class="squad-stat-lbl">Avg Rating</div>
        </div>
    </div>

    <!-- Search + position filter bar -->
    <div class="search-filter-bar">
        <div class="search-input-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" id="playerSearch" placeholder="Search by name or jersey number…" autocomplete="off" inputmode="search">
            <button class="search-clear" id="searchClear" onclick="clearSearch()" aria-label="Clear search">×</button>
        </div>
        <div class="pos-filters" id="posFilters">
            <button class="pos-pill active" data-pos="All" onclick="filterPos(this)">All</button>
            <button class="pos-pill" data-pos="Goalkeeper" onclick="filterPos(this)">GK</button>
            <button class="pos-pill" data-pos="Defender" onclick="filterPos(this)">DF</button>
            <button class="pos-pill" data-pos="Midfielder" onclick="filterPos(this)">MF</button>
            <button class="pos-pill" data-pos="Forward" onclick="filterPos(this)">FW</button>
        </div>
    </div>

    <!-- Results count -->
    <div id="resultLabel" style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-bottom:12px;">
        <?php echo count($all_players); ?> players
    </div>

    <!-- Player grid -->
    <?php if (empty($all_players)): ?>
    <div class="empty-state"><p>No active players yet.</p></div>
    <?php else: ?>

    <div class="player-grid" id="playerGrid">
        <?php foreach ($all_players as $p):
            $base_dir  = "../assets/uploads/teams/{$team_id}/players/";
            $full_path = $base_dir . $p['profile_image'];
            $has_img   = !empty($p['profile_image']) && file_exists($full_path);
            $pos_cls   = ['Goalkeeper'=>'pos-gk','Defender'=>'pos-df','Midfielder'=>'pos-mf','Forward'=>'pos-fw'][$p['position']] ?? 'badge-muted';
        ?>
        <a href="player_profile.php?id=<?php echo $p['id']; ?>" class="pcard"
           data-name="<?php echo strtolower(htmlspecialchars($p['full_name'])); ?>"
           data-pos="<?php echo htmlspecialchars($p['position']); ?>"
           data-num="<?php echo htmlspecialchars($p['player_number'] ?? ''); ?>">

            <!-- Violation badges -->
            <?php if ($p['career_yellows'] > 0 || $p['career_reds'] > 0): ?>
            <div class="pcard-violations">
                <?php if ($p['career_yellows'] > 0): ?>
                <span class="vbadge vbadge-y"><?php echo $p['career_yellows']; ?>Y</span>
                <?php endif; ?>
                <?php if ($p['career_reds'] > 0): ?>
                <span class="vbadge vbadge-r"><?php echo $p['career_reds']; ?>R</span>
                <?php endif; ?>
            </div>
            <?php endif; ?>

            <!-- Avatar -->
            <div class="pcard-avatar">
                <?php if ($has_img): ?>
                <img src="<?php echo htmlspecialchars($full_path); ?>" alt="">
                <?php else: ?>
                <?php echo strtoupper(substr($p['full_name'], 0, 1)); ?>
                <?php endif; ?>
                <span class="pcard-number">#<?php echo $p['player_number'] ?: '—'; ?></span>
            </div>

            <div class="pcard-name"><?php echo htmlspecialchars($p['full_name']); ?></div>
            <span class="badge <?php echo $pos_cls; ?>" style="font-size:.62rem;"><?php echo $p['position']; ?></span>

            <!-- Stats matrix -->
            <div class="pcard-matrix">
                <div class="pcard-cell">
                    <span class="pcard-val"><?php echo $p['matches_played']; ?></span>
                    <span class="pcard-lbl">MP</span>
                </div>
                <div class="pcard-cell">
                    <span class="pcard-val" style="color:var(--forest-400);"><?php echo $p['career_goals']; ?></span>
                    <span class="pcard-lbl">G</span>
                </div>
                <div class="pcard-cell">
                    <span class="pcard-val" style="color:#fbbf24;"><?php echo number_format($p['rating'], 1); ?></span>
                    <span class="pcard-lbl">Rtg</span>
                </div>
            </div>

            <span class="pcard-btn">View Profile</span>
        </a>
        <?php endforeach; ?>
    </div>

    <!-- No results -->
    <div class="no-results" id="noResults">
        <div style="font-size:2rem;margin-bottom:10px;">🔍</div>
        <div style="font-weight:700;font-size:.9rem;">No players found</div>
        <div style="font-size:.8rem;margin-top:4px;">Try a different name or position</div>
    </div>

    <?php endif; ?>

</div>

<script>
var currentPos = 'All';
var currentSearch = '';

function applyFilters() {
    var cards = document.querySelectorAll('.pcard');
    var visible = 0;
    var q = currentSearch.toLowerCase().trim();

    cards.forEach(function(card) {
        var name   = card.dataset.name  || '';
        var pos    = card.dataset.pos   || '';
        var num    = card.dataset.num   || '';

        var matchPos    = currentPos === 'All' || pos === currentPos;
        var matchSearch = !q || name.includes(q) || num.includes(q);

        if (matchPos && matchSearch) {
            card.classList.remove('hidden');
            visible++;
        } else {
            card.classList.add('hidden');
        }
    });

    var label = document.getElementById('resultLabel');
    if (label) {
        label.textContent = visible + ' player' + (visible !== 1 ? 's' : '');
    }

    var noRes = document.getElementById('noResults');
    if (noRes) {
        noRes.classList.toggle('visible', visible === 0);
    }
}

function filterPos(btn) {
    document.querySelectorAll('.pos-pill').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentPos = btn.dataset.pos;
    applyFilters();
}

document.getElementById('playerSearch').addEventListener('input', function() {
    currentSearch = this.value;
    var clearBtn = document.getElementById('searchClear');
    clearBtn.style.display = this.value ? 'block' : 'none';
    applyFilters();
});

function clearSearch() {
    var input = document.getElementById('playerSearch');
    input.value = '';
    currentSearch = '';
    document.getElementById('searchClear').style.display = 'none';
    input.focus();
    applyFilters();
}

// Focus search on Ctrl/Cmd+K or /
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('playerSearch').focus();
    }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('playerSearch').focus();
    }
});
</script>
</body>
</html>
