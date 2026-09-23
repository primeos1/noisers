<?php
// includes/navbar.php — top bar for admin pages that don't have a full sidebar layout
require_once __DIR__ . '/auth.php';
$_nav_page = basename($_SERVER['PHP_SELF']);
?>
<nav class="top-bar" style="font-family:'Jost',sans-serif;">
    <div class="top-bar-inner">

        <!-- Brand -->
        <a href="<?php echo getRole() === 'admin' ? 'dashboard.php' : '../player/dashboard.php'; ?>"
           class="top-bar-logo">NOISER FC <em>PRO</em></a>

        <span class="top-bar-divider"></span>
        <span class="top-bar-team"><?php echo htmlspecialchars($_SESSION['team_name'] ?? ''); ?></span>

        <!-- Desktop links -->
        <?php if (getRole() === 'admin'): ?>
        <div class="top-bar-links">
            <a href="dashboard.php"          class="top-bar-link <?php echo $_nav_page==='dashboard.php'?'active':''; ?>">Dashboard</a>
            <a href="manage_players.php"     class="top-bar-link <?php echo $_nav_page==='manage_players.php'?'active':''; ?>">Players</a>
            <a href="create_match.php"       class="top-bar-link <?php echo $_nav_page==='create_match.php'?'active':''; ?>">New Match</a>
            <a href="randomize_sets.php"     class="top-bar-link <?php echo $_nav_page==='randomize_sets.php'?'active':''; ?>">Sets</a>
            <a href="match_management.php"   class="top-bar-link <?php echo $_nav_page==='match_management.php'?'active':''; ?>">Matches</a>
            <a href="manage_cards.php"       class="top-bar-link <?php echo $_nav_page==='manage_cards.php'?'active':''; ?>">Cards</a>
            <a href="reports.php"            class="top-bar-link <?php echo $_nav_page==='reports.php'?'active':''; ?>">Reports</a>
            <a href="settings.php"           class="top-bar-link <?php echo $_nav_page==='settings.php'?'active':''; ?>">Settings</a>
        </div>
        <?php endif; ?>

        <!-- Right side -->
        <div class="top-bar-right">
            <span style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);">
                <?php echo htmlspecialchars($_SESSION['role'] ?? ''); ?>
            </span>
            <a href="../logout.php"
               style="font-size:.78rem;font-weight:600;color:#f87171;text-decoration:none;padding:5px 11px;border:1px solid rgba(248,113,113,.18);border-radius:5px;">
                Logout
            </a>
            <!-- Mobile hamburger -->
            <button class="top-bar-mobile-toggle" id="navToggle" onclick="toggleNavMenu()" aria-label="Menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/>
                </svg>
            </button>
        </div>
    </div>

    <!-- Mobile menu dropdown -->
    <?php if (getRole() === 'admin'): ?>
    <div class="top-bar-mobile-menu" id="navMobileMenu">
        <a href="dashboard.php"        class="top-bar-mobile-link <?php echo $_nav_page==='dashboard.php'?'active':''; ?>">Dashboard</a>
        <a href="manage_players.php"   class="top-bar-mobile-link <?php echo $_nav_page==='manage_players.php'?'active':''; ?>">Players</a>
        <a href="create_match.php"     class="top-bar-mobile-link <?php echo $_nav_page==='create_match.php'?'active':''; ?>">New Match</a>
        <a href="randomize_sets.php"   class="top-bar-mobile-link <?php echo $_nav_page==='randomize_sets.php'?'active':''; ?>">Manage Sets</a>
        <a href="match_management.php" class="top-bar-mobile-link <?php echo $_nav_page==='match_management.php'||$_nav_page==='manage_matches.php'?'active':''; ?>">Live Matches</a>
        <a href="manage_cards.php"     class="top-bar-mobile-link <?php echo $_nav_page==='manage_cards.php'?'active':''; ?>">Cards</a>
        <a href="reports.php"          class="top-bar-mobile-link <?php echo $_nav_page==='reports.php'?'active':''; ?>">Reports</a>
        <a href="settings.php"         class="top-bar-mobile-link <?php echo $_nav_page==='settings.php'?'active':''; ?>">Settings</a>
        <a href="../logout.php"        class="top-bar-mobile-link danger">Logout</a>
    </div>
    <?php endif; ?>
</nav>

<!-- Mobile bottom tab nav -->
<nav class="mobile-nav" style="font-family:'Jost',sans-serif;">
    <div class="mobile-nav-row">
        <a href="dashboard.php"        class="mobile-nav-item <?php echo $_nav_page==='dashboard.php'?'active':''; ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Home
        </a>
        <a href="manage_players.php"   class="mobile-nav-item <?php echo $_nav_page==='manage_players.php'?'active':''; ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Players
        </a>
        <a href="match_management.php" class="mobile-nav-item <?php echo $_nav_page==='match_management.php'||$_nav_page==='manage_matches.php'?'active':''; ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            Matches
        </a>
        <a href="randomize_sets.php"   class="mobile-nav-item <?php echo $_nav_page==='randomize_sets.php'?'active':''; ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
            Sets
        </a>
        <a href="reports.php"          class="mobile-nav-item <?php echo $_nav_page==='reports.php'?'active':''; ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6"  y1="20" x2="6"  y2="14"/></svg>
            Reports
        </a>
    </div>
</nav>

<script>
function toggleNavMenu() {
    var m = document.getElementById('navMobileMenu');
    m.classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('.sidebar') || document.querySelector('.admin-sidebar-backdrop')) return;
    var backdrop = document.createElement('div');
    backdrop.className = 'admin-sidebar-backdrop';
    backdrop.addEventListener('click', function () {
        document.body.classList.remove('admin-sidebar-open');
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') document.body.classList.remove('admin-sidebar-open');
    });
    document.body.appendChild(backdrop);
});
</script>
