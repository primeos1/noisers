<?php
// includes/player_nav.php
require_once __DIR__ . '/auth.php';
$_pnav_page = basename($_SERVER['PHP_SELF']);
$_pnav_mid  = $_GET['id'] ?? null;
?>
<style>
/* ── Player top bar ─────────────────────────────────────── */
.p-top-bar {
    background: var(--pitch-850);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 40;
    font-family: 'Jost', sans-serif;
}
.p-top-bar-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 16px;
    height: 54px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.p-top-logo {
    font-size: 1.05rem;
    font-weight: 900;
    letter-spacing: -.03em;
    color: var(--text-main);
    text-decoration: none;
    flex-shrink: 0;
}
.p-top-logo em { font-style: normal; color: var(--burg-500); }
.p-top-team {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    padding-left: 10px;
    border-left: 1px solid var(--border);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
}
.p-top-logout {
    font-size: 0.72rem;
    font-weight: 700;
    color: #f87171;
    text-decoration: none;
    padding: 5px 10px;
    border: 1px solid rgba(248,113,113,.2);
    border-radius: 5px;
    flex-shrink: 0;
}

/* ── Bottom tab nav ─────────────────────────────────────── */
.p-tab-nav {
    display: block;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: var(--pitch-850);
    border-top: 1px solid var(--border);
    z-index: 40;
    padding: 6px 0 max(6px, env(safe-area-inset-bottom));
    font-family: 'Jost', sans-serif;
}
.p-tab-row { display: flex; justify-content: space-around; }
.p-tab-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 4px 12px;
    text-decoration: none;
    color: var(--text-muted);
    font-size: 0.58rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .05em;
    transition: color .15s;
    min-width: 50px;
}
.p-tab-item.active { color: var(--burg-400); }
.p-tab-item svg { width: 20px; height: 20px; }

/* ── Page layout ────────────────────────────────────────── */
.player-content {
    max-width: 820px;
    margin: 0 auto;
    padding: 20px 16px 90px;
}
.player-content.wide {
    max-width: 1100px;
}
@media (max-width: 639px) {
    .player-content { padding: 14px 12px 80px; }
}

/* ── Page header ────────────────────────────────────────── */
.player-page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
}
.player-eyebrow {
    font-size: .65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .12em;
    color: var(--burg-400);
    margin-bottom: 4px;
}
.player-title {
    font-size: clamp(1.3rem, 4vw, 1.8rem);
    font-weight: 900;
    letter-spacing: -.02em;
    line-height: 1.15;
    color: var(--text-main);
    margin: 0 0 4px;
}
.player-subtitle {
    font-size: .82rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
}
.section-label {
    font-size: .65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .12em;
    color: var(--text-muted);
    margin-bottom: 12px;
    margin-top: 20px;
}

/* ── Horizontal filter/scroll row ───────────────────────── */
.player-scroll-row {
    display: flex;
    gap: 7px;
    overflow-x: auto;
    padding-bottom: 2px;
    margin-bottom: 18px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
}
.player-scroll-row::-webkit-scrollbar { display: none; }
.player-filter {
    flex-shrink: 0;
    padding: 7px 14px;
    border-radius: 20px;
    background: var(--pitch-700);
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-family: 'Jost', sans-serif;
    font-size: .78rem;
    font-weight: 700;
    cursor: pointer;
    transition: background .15s, color .15s, border-color .15s;
    white-space: nowrap;
}
.player-filter:hover { background: var(--pitch-600); color: var(--text-main); }
.player-filter.active {
    background: var(--burg-800);
    border-color: var(--burg-700);
    color: var(--text-main);
}

/* ── Card grid ──────────────────────────────────────────── */
.player-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
    margin-bottom: 14px;
}
.chart-frame {
    position: relative;
    height: 200px;
}

/* ── Rank list ──────────────────────────────────────────── */
.rank-list { display: flex; flex-direction: column; gap: 8px; }
.rank-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--pitch-700);
    border: 1px solid var(--border);
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: background .15s;
}
.rank-row:hover { background: var(--pitch-600); }
.rank-number {
    font-size: .85rem;
    font-weight: 800;
    color: var(--text-muted);
    min-width: 20px;
    text-align: center;
}
.rank-main { flex: 1; min-width: 0; }
.rank-name {
    font-weight: 700;
    font-size: .875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-main);
}
.rank-meta {
    font-size: .72rem;
    color: var(--text-muted);
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 5px;
}
.rank-value {
    font-size: 1.2rem;
    font-weight: 900;
    color: var(--text-main);
    min-width: 32px;
    text-align: right;
}

/* ── Mini stat strip ────────────────────────────────────── */
.mini-stat-grid {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 4px;
}
.mini-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--pitch-700);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 10px 14px;
    min-width: 68px;
    flex: 1;
}
.mini-stat-value {
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--text-main);
    line-height: 1;
}
.mini-stat-label {
    font-size: .6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .07em;
    color: var(--text-muted);
    margin-top: 3px;
}

/* ── Match list cards ───────────────────────────────────── */
.player-list { display: flex; flex-direction: column; gap: 12px; }
.player-list-card {
    background: var(--pitch-800);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
}
.player-list-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--pitch-700);
}
.player-list-title {
    font-size: .9rem;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 3px;
}
.player-list-meta {
    font-size: .75rem;
    color: var(--text-muted);
}
.player-list-body { padding: 14px 16px; }

/* ── Set card ───────────────────────────────────────────── */
.set-card {
    background: var(--pitch-800);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
}
.set-card-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}
.set-score {
    font-size: 1.75rem;
    font-weight: 900;
    display: flex;
    align-items: center;
    gap: 8px;
    line-height: 1;
}
.team-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}
.team-box {
    background: var(--pitch-700);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 10px;
}
.team-box-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: .8rem;
    margin-bottom: 5px;
}
.team-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}
.team-box-copy {
    font-size: .72rem;
    color: var(--text-muted);
    line-height: 1.5;
}
@media (max-width: 479px) {
    .team-pair { grid-template-columns: 1fr; }
}

/* ── Modal ──────────────────────────────────────────────── */
.modal-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.75);
    z-index: 100;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
}
.modal-backdrop.open { display: flex; }
@media (min-width: 640px) {
    .modal-backdrop { align-items: center; padding: 20px; }
}
.modal-panel {
    background: var(--pitch-800);
    border: 1px solid var(--border);
    border-radius: 14px 14px 0 0;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}
@media (min-width: 640px) {
    .modal-panel {
        max-width: 520px;
        border-radius: 12px;
        max-height: 80vh;
    }
}
.modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--pitch-800);
    z-index: 1;
}
.modal-body { padding: 16px 18px; flex: 1; overflow-y: auto; }
</style>

<!-- Player top bar -->
<div class="p-top-bar">
    <div class="p-top-bar-inner">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <a href="dashboard.php" class="p-top-logo">NOISER FC <em>PRO</em></a>
            <span class="p-top-team"><?php echo htmlspecialchars($_SESSION['team_name'] ?? ''); ?></span>
        </div>
        <a href="../logout.php" class="p-top-logout">Logout</a>
    </div>
</div>

<!-- Bottom tab nav -->
<nav class="p-tab-nav">
    <div class="p-tab-row">
        <a href="dashboard.php" class="p-tab-item <?php echo $_pnav_page==='dashboard.php'?'active':''; ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Squad
        </a>
        <a href="match_history.php" class="p-tab-item <?php echo $_pnav_page==='match_history.php'?'active':''; ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
            History
        </a>
        <?php if ($_pnav_page === 'match_details.php' && $_pnav_mid): ?>
        <a href="match_details.php?id=<?php echo (int)$_pnav_mid; ?>" class="p-tab-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Match
        </a>
        <?php endif; ?>
        <a href="player_stats.php" class="p-tab-item <?php echo $_pnav_page==='player_stats.php'?'active':''; ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
            Stats
        </a>
    </div>
</nav>
