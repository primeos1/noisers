<?php
// admin/settings.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id = getTeamId();

$fines_stmt = $pdo->prepare("SELECT * FROM card_fines ORDER BY card_type");
$fines_stmt->execute();
$card_fines = $fines_stmt->fetchAll();

$team_stmt = $pdo->prepare("SELECT * FROM teams WHERE id = ?");
$team_stmt->execute([$team_id]);
$team_info = $team_stmt->fetch();

$match_defaults = [
    'duration' => 10,
    'max_players_per_team' => 5,
    'winning_score' => 2,
    'extra_time_limit' => 5,
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $pdo->beginTransaction();

        if (isset($_POST['card_fines'])) {
            foreach ($_POST['card_fines'] as $card_type => $data) {
                $check_stmt = $pdo->prepare("SELECT id FROM card_fines WHERE card_type = ?");
                $check_stmt->execute([$card_type]);
                if ($check_stmt->fetch()) {
                    $pdo->prepare("UPDATE card_fines SET amount = ?, currency = ?, is_active = ? WHERE card_type = ?")
                       ->execute([$data['amount'], $data['currency'], isset($data['is_active']) ? 1 : 0, $card_type]);
                } else {
                    $pdo->prepare("INSERT INTO card_fines (card_type, amount, currency, is_active) VALUES (?, ?, ?, ?)")
                       ->execute([$card_type, $data['amount'], $data['currency'], isset($data['is_active']) ? 1 : 0]);
                }
            }
        }

        if (isset($_POST['team_info'])) {
            $data = $_POST['team_info'];
            $admin_pass  = !empty($data['admin_password'])  ? password_hash($data['admin_password'],  PASSWORD_DEFAULT) : $team_info['admin_password'];
            $player_pass = !empty($data['player_password']) ? password_hash($data['player_password'], PASSWORD_DEFAULT) : $team_info['player_password'];
            $pdo->prepare("UPDATE teams SET team_name = ?, team_code = ?, admin_password = ?, player_password = ? WHERE id = ?")
               ->execute([$data['team_name'], $data['team_code'], $admin_pass, $player_pass, $team_id]);
            $_SESSION['team_name'] = $data['team_name'];
        }

        if (isset($_POST['match_defaults'])) {
            $_SESSION['match_defaults'] = $_POST['match_defaults'];
        }

        $pdo->commit();
        $_SESSION['flash_message'] = 'Settings updated successfully!';
        $_SESSION['flash_type'] = 'success';
        $team_stmt->execute([$team_id]);
        $team_info = $team_stmt->fetch();
    } catch (PDOException $e) {
        $pdo->rollBack();
        $_SESSION['flash_message'] = 'Error: ' . $e->getMessage();
        $_SESSION['flash_type'] = 'error';
    }
    header("Location: settings.php");
    exit();
}

$flash_message = $_SESSION['flash_message'] ?? '';
$flash_type    = $_SESSION['flash_type']    ?? 'success';
unset($_SESSION['flash_message'], $_SESSION['flash_type']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Settings — Noisers Football Pro</title>
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
            <a href="settings.php" class="sidebar-link active">
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
                    <div class="page-title">Settings</div>
                    <div class="page-sub"><?php echo htmlspecialchars($team_info['team_name'] ?? ''); ?></div>
                </div>
            </div>
        </div>

        <?php if ($flash_message): ?>
        <div class="alert alert-<?php echo $flash_type === 'success' ? 'success' : 'error'; ?>" style="margin-bottom:16px;">
            <?php echo htmlspecialchars($flash_message); ?>
        </div>
        <?php endif; ?>

        <!-- Tab bar -->
        <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border);overflow-x:auto;">
            <?php foreach (['team'=>'Team','fines'=>'Card Fines','match'=>'Match Defaults','security'=>'Security'] as $k=>$lbl): ?>
            <button onclick="showTab('<?php echo $k; ?>')" id="stab-<?php echo $k; ?>"
                    style="padding:10px 16px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:'Jost',sans-serif;font-size:.8rem;font-weight:700;letter-spacing:.02em;color:var(--text-muted);cursor:pointer;white-space:nowrap;transition:color .15s,border-color .15s;">
                <?php echo $lbl; ?>
            </button>
            <?php endforeach; ?>
        </div>

        <form method="POST" id="settingsForm">

            <!-- ── Team ── -->
            <div id="scontent-team" class="s-tab">
                <div class="card" style="margin-bottom:16px;">
                    <div class="card-hd"><span class="card-hd-title">Team Information</span></div>
                    <div style="padding:20px;display:flex;flex-direction:column;gap:16px;">
                        <div class="form-grid form-grid-2">
                            <div>
                                <label class="field-label">Team Name</label>
                                <input type="text" name="team_info[team_name]" class="field"
                                       value="<?php echo htmlspecialchars($team_info['team_name'] ?? ''); ?>" required>
                            </div>
                            <div>
                                <label class="field-label">Team Code</label>
                                <input type="text" name="team_info[team_code]" class="field" id="teamCode"
                                       value="<?php echo htmlspecialchars($team_info['team_code'] ?? ''); ?>"
                                       pattern="[A-Z0-9]{3,10}" title="3–10 uppercase letters or numbers" required>
                                <span style="font-size:.7rem;color:var(--text-muted);display:block;margin-top:4px;">3–10 uppercase letters or numbers</span>
                            </div>
                        </div>
                        <div class="form-grid form-grid-2">
                            <div>
                                <label class="field-label">Admin Password <span style="font-weight:400;text-transform:none;color:var(--text-muted);">(blank = keep current)</span></label>
                                <input type="password" name="team_info[admin_password]" class="field" placeholder="New password…">
                            </div>
                            <div>
                                <label class="field-label">Player Password <span style="font-weight:400;text-transform:none;color:var(--text-muted);">(blank = keep current)</span></label>
                                <input type="password" name="team_info[player_password]" class="field" placeholder="New password…">
                            </div>
                        </div>
                    </div>
                </div>
                <div style="display:flex;justify-content:flex-end;"><button type="submit" class="btn btn-primary btn-sm">Save Team Settings</button></div>
            </div>

            <!-- ── Card Fines ── -->
            <div id="scontent-fines" class="s-tab" style="display:none;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                    <?php
                    $fineMap = [];
                    foreach ($card_fines as $cf) $fineMap[$cf['card_type']] = $cf;
                    foreach (['yellow'=>['Yellow Card','#fbbf24'], 'red'=>['Red Card','#f87171']] as $ct=>[$cl,$cc]):
                        $cf = $fineMap[$ct] ?? ['amount'=>($ct==='yellow'?5000:10000),'currency'=>'NGN','is_active'=>1];
                    ?>
                    <div class="card">
                        <div class="card-hd"><span class="card-hd-title" style="color:<?php echo $cc; ?>"><?php echo $cl; ?></span></div>
                        <div style="padding:16px;display:flex;flex-direction:column;gap:14px;">
                            <div>
                                <label class="field-label">Fine Amount</label>
                                <input type="number" name="card_fines[<?php echo $ct; ?>][amount]" class="field"
                                       value="<?php echo $cf['amount']; ?>" step="100" min="0" required>
                            </div>
                            <div>
                                <label class="field-label">Currency</label>
                                <select name="card_fines[<?php echo $ct; ?>][currency]" class="field">
                                    <option value="NGN" <?php echo ($cf['currency']??'NGN')==='NGN'?'selected':''; ?>>NGN — Naira</option>
                                    <option value="USD" <?php echo ($cf['currency']??'')==='USD'?'selected':''; ?>>USD — Dollar</option>
                                    <option value="GBP" <?php echo ($cf['currency']??'')==='GBP'?'selected':''; ?>>GBP — Pound</option>
                                </select>
                            </div>
                            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                                <input type="checkbox" name="card_fines[<?php echo $ct; ?>][is_active]" class="check"
                                       <?php echo ($cf['is_active']??1)?'checked':''; ?>>
                                <span style="font-size:.85rem;font-weight:600;">Fine active</span>
                            </label>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <div style="display:flex;justify-content:flex-end;"><button type="submit" class="btn btn-primary btn-sm">Save Fine Rates</button></div>
            </div>

            <!-- ── Match Defaults ── -->
            <div id="scontent-match" class="s-tab" style="display:none;">
                <div class="card" style="margin-bottom:16px;">
                    <div class="card-hd"><span class="card-hd-title">Match Defaults</span></div>
                    <div style="padding:20px;">
                        <div class="form-grid form-grid-2" style="gap:16px;">
                            <div>
                                <label class="field-label">Set Duration (minutes)</label>
                                <input type="number" name="match_defaults[duration]" class="field"
                                       value="<?php echo $_SESSION['match_defaults']['duration'] ?? $match_defaults['duration']; ?>"
                                       min="1" max="60" required>
                            </div>
                            <div>
                                <label class="field-label">Max Players per Team</label>
                                <input type="number" name="match_defaults[max_players_per_team]" class="field"
                                       value="<?php echo $_SESSION['match_defaults']['max_players_per_team'] ?? $match_defaults['max_players_per_team']; ?>"
                                       min="1" max="11" required>
                            </div>
                            <div>
                                <label class="field-label">Winning Score (goals)</label>
                                <input type="number" name="match_defaults[winning_score]" class="field"
                                       value="<?php echo $_SESSION['match_defaults']['winning_score'] ?? $match_defaults['winning_score']; ?>"
                                       min="1" max="10" required>
                            </div>
                            <div>
                                <label class="field-label">Extra Time Limit (minutes)</label>
                                <input type="number" name="match_defaults[extra_time_limit]" class="field"
                                       value="<?php echo $_SESSION['match_defaults']['extra_time_limit'] ?? $match_defaults['extra_time_limit']; ?>"
                                       min="0" max="30" required>
                            </div>
                        </div>
                    </div>
                </div>
                <div style="display:flex;justify-content:flex-end;"><button type="submit" class="btn btn-primary btn-sm">Save Match Defaults</button></div>
            </div>

            <!-- ── Security ── -->
            <div id="scontent-security" class="s-tab" style="display:none;">
                <div class="card" style="margin-bottom:16px;">
                    <div class="card-hd"><span class="card-hd-title">Access Control</span></div>
                    <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
                        <label style="display:flex;align-items:center;gap:10px;">
                            <input type="checkbox" class="check" checked disabled>
                            <div>
                                <div style="font-weight:600;font-size:.875rem;">Login Required</div>
                                <div style="font-size:.75rem;color:var(--text-muted);">All users must log in to access the system</div>
                            </div>
                        </label>
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                            <input type="checkbox" name="security[session_timeout]" class="check" checked>
                            <div>
                                <div style="font-weight:600;font-size:.875rem;">Session Timeout</div>
                                <div style="font-size:.75rem;color:var(--text-muted);">Auto-logout inactive users after 30 minutes</div>
                            </div>
                        </label>
                    </div>
                </div>
                <div class="card" style="margin-bottom:16px;">
                    <div class="card-hd"><span class="card-hd-title">Data Retention</span></div>
                    <div style="padding:20px;">
                        <label class="field-label">Keep completed match data for</label>
                        <select name="security[data_retention]" class="field" style="max-width:260px;">
                            <option value="30">30 days</option>
                            <option value="90" selected>90 days</option>
                            <option value="180">180 days</option>
                            <option value="365">1 year</option>
                            <option value="0">Forever</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex;justify-content:flex-end;"><button type="submit" class="btn btn-primary btn-sm">Save Security Settings</button></div>
            </div>

        </form>
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
function showTab(name) {
    document.querySelectorAll('.s-tab').forEach(function(el){ el.style.display = 'none'; });
    document.querySelectorAll('[id^="stab-"]').forEach(function(btn){
        btn.style.color = 'var(--text-muted)';
        btn.style.borderBottomColor = 'transparent';
    });
    document.getElementById('scontent-' + name).style.display = 'block';
    var btn = document.getElementById('stab-' + name);
    btn.style.color = 'var(--burg-300)';
    btn.style.borderBottomColor = 'var(--burg-500)';
}
document.addEventListener('DOMContentLoaded', function(){ showTab('team'); });

document.getElementById('teamCode').addEventListener('input', function(){
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
</script>
</body>
</html>
