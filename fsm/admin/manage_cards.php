<?php
// admin/manage_cards.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';
require_once '../includes/card_functions.php';

$team_id = getTeamId();
$message = '';
$error = '';

// Get card fine rates
$stmt = $pdo->query("SELECT card_type, amount FROM card_fines WHERE is_active = 1");
$fine_rates = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

// Handle card clearing/payment
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['clear_card'])) {
        try {
            $player_id = (int)$_POST['player_id'];
            $card_type = $_POST['card_type'];
            $payment_method = $_POST['payment_method'];
            $reference = $_POST['reference_number'];
            $notes = $_POST['notes'];

            $stmt = $pdo->prepare("SELECT amount FROM card_fines WHERE card_type = ? AND is_active = 1");
            $stmt->execute([$card_type]);
            $fine_amount = $stmt->fetchColumn();

            if ($fine_amount) {
                $pdo->beginTransaction();

                $stmt = $pdo->prepare("
                    INSERT INTO card_payments
                    (player_id, card_type, amount, status, payment_date, payment_method, reference_number, notes)
                    VALUES (?, ?, ?, 'paid', CURDATE(), ?, ?, ?)
                ");
                $stmt->execute([$player_id, $card_type, $fine_amount, $payment_method, $reference, $notes]);

                if ($card_type === 'yellow') {
                    $stmt = $pdo->prepare("
                        UPDATE players
                        SET yellow_cards = GREATEST(0, yellow_cards - 1),
                            outstanding_fees = GREATEST(0, outstanding_fees - ?),
                            total_paid = total_paid + ?
                        WHERE id = ? AND team_id = ?
                    ");
                } else {
                    $stmt = $pdo->prepare("
                        UPDATE players
                        SET red_cards = GREATEST(0, red_cards - 1),
                            outstanding_fees = GREATEST(0, outstanding_fees - ?),
                            total_paid = total_paid + ?
                        WHERE id = ? AND team_id = ?
                    ");
                }
                $stmt->execute([$fine_amount, $fine_amount, $player_id, $team_id]);

                $col = $card_type === 'yellow' ? 'total_yellow_cards' : 'total_red_cards';
                $stmt = $pdo->prepare("UPDATE players SET $col = $col + 1 WHERE id = ?");
                $stmt->execute([$player_id]);

                $pdo->commit();
                $message = "Card cleared and payment recorded.";
            }
        } catch (Exception $e) {
            $pdo->rollBack();
            $error = "Error processing payment: " . $e->getMessage();
        }
    }

    if (isset($_POST['update_fines'])) {
        foreach ($_POST['fines'] as $card_type => $amount) {
            $amount = (float)$amount;
            $stmt = $pdo->prepare("
                INSERT INTO card_fines (card_type, amount)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE amount = VALUES(amount)
            ");
            $stmt->execute([$card_type, $amount]);
        }
        $message = "Fine rates updated.";
    }
}

// Get players with outstanding cards
$stmt = $pdo->prepare("
    SELECT p.*,
           (p.yellow_cards + p.red_cards) as total_active_cards,
           (SELECT COUNT(*) FROM card_payments cp WHERE cp.player_id = p.id AND cp.status = 'paid') as total_payments
    FROM players p
    WHERE p.team_id = ? AND (p.yellow_cards > 0 OR p.red_cards > 0 OR p.outstanding_fees > 0)
    ORDER BY p.outstanding_fees DESC, p.yellow_cards + p.red_cards DESC
");
$stmt->execute([$team_id]);
$players_with_cards = $stmt->fetchAll();

// Get recent payments
$stmt = $pdo->prepare("
    SELECT cp.*, p.full_name, p.player_number
    FROM card_payments cp
    JOIN players p ON cp.player_id = p.id
    WHERE p.team_id = ?
    ORDER BY cp.created_at DESC
    LIMIT 50
");
$stmt->execute([$team_id]);
$recent_payments = $stmt->fetchAll();

// Totals
$stmt = $pdo->prepare("
    SELECT
        SUM(p.yellow_cards) as active_yellow,
        SUM(p.red_cards) as active_red,
        SUM(p.outstanding_fees) as total_outstanding,
        SUM(p.total_paid) as total_collected,
        COUNT(DISTINCT CASE WHEN p.yellow_cards > 0 OR p.red_cards > 0 THEN p.id END) as players_with_cards
    FROM players p
    WHERE p.team_id = ?
");
$stmt->execute([$team_id]);
$totals = $stmt->fetch();

// Refresh fine rates
$stmt = $pdo->query("SELECT card_type, amount FROM card_fines WHERE is_active = 1");
$fine_rates = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Cards — Noisers Football Pro</title>
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
            <a href="manage_cards.php" class="sidebar-link active">
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
                    <div class="page-title">Card Management</div>
                    <div class="page-sub">Track yellow/red cards and fine payments</div>
                </div>
                <button onclick="document.getElementById('configModal').style.display='flex'" class="btn btn-ghost btn-sm">Configure Fines</button>
            </div>
        </div>

        <?php if (!empty($message)): ?>
        <div class="alert alert-success"><?php echo htmlspecialchars($message); ?></div>
        <?php endif; ?>
        <?php if (!empty($error)): ?>
        <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <!-- Stats strip -->
        <div class="stats-strip" style="margin-bottom:20px;">
            <div class="stat-box">
                <div class="stat-num"><?php echo $totals['players_with_cards'] ?? 0; ?></div>
                <div class="stat-lbl">Players w/ Cards</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:#fbbf24;"><?php echo $totals['active_yellow'] ?? 0; ?></div>
                <div class="stat-lbl">Yellow Cards</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:#f87171;"><?php echo $totals['active_red'] ?? 0; ?></div>
                <div class="stat-lbl">Red Cards</div>
            </div>
            <div class="stat-box">
                <div class="stat-num" style="color:var(--forest-400);font-size:1.1rem;">
                    ₦<?php echo number_format($totals['total_outstanding'] ?? 0); ?>
                </div>
                <div class="stat-lbl">Outstanding</div>
            </div>
        </div>

        <!-- Fine rates banner -->
        <div class="card" style="margin-bottom:20px;">
            <div class="card-hd">
                <span class="card-hd-title">Current Fine Rates</span>
                <button onclick="document.getElementById('configModal').style.display='flex'" class="btn btn-ghost btn-xs">Edit</button>
            </div>
            <div style="display:flex;gap:24px;padding:14px 18px;">
                <div>
                    <span style="font-size:.75rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Yellow Card</span>
                    <div style="font-size:1.1rem;font-weight:800;color:#fbbf24;margin-top:2px;">
                        ₦<?php echo number_format($fine_rates['yellow'] ?? 5000); ?>
                    </div>
                </div>
                <div>
                    <span style="font-size:.75rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Red Card</span>
                    <div style="font-size:1.1rem;font-weight:800;color:#f87171;margin-top:2px;">
                        ₦<?php echo number_format($fine_rates['red'] ?? 10000); ?>
                    </div>
                </div>
                <div>
                    <span style="font-size:.75rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Total Collected</span>
                    <div style="font-size:1.1rem;font-weight:800;color:var(--forest-400);margin-top:2px;">
                        ₦<?php echo number_format($totals['total_collected'] ?? 0); ?>
                    </div>
                </div>
            </div>
        </div>

        <!-- Players with cards -->
        <div class="card" style="margin-bottom:20px;">
            <div class="card-hd"><span class="card-hd-title">Players with Outstanding Cards</span></div>
            <?php if (!empty($players_with_cards)): ?>
            <!-- Desktop table -->
            <div class="table-wrap" id="tableDesktop" style="display:none;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Yellow</th>
                            <th>Red</th>
                            <th>Total Due</th>
                            <th>Total Paid</th>
                            <th style="width:180px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($players_with_cards as $p):
                            $y_due = $p['yellow_cards'] * ($fine_rates['yellow'] ?? 5000);
                            $r_due = $p['red_cards'] * ($fine_rates['red'] ?? 10000);
                        ?>
                        <tr>
                            <td>
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <div class="p-avatar"><?php echo strtoupper(substr($p['full_name'],0,1)); ?></div>
                                    <div>
                                        <div style="font-weight:600;">#<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?></div>
                                        <div style="font-size:.72rem;color:var(--text-muted);"><?php echo $p['position']; ?></div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <?php if ($p['yellow_cards'] > 0): ?>
                                <span class="badge badge-warning"><?php echo $p['yellow_cards']; ?></span>
                                <span style="font-size:.72rem;color:var(--text-muted);margin-left:4px;">₦<?php echo number_format($y_due); ?></span>
                                <?php else: ?><span style="color:var(--text-muted);">—</span><?php endif; ?>
                            </td>
                            <td>
                                <?php if ($p['red_cards'] > 0): ?>
                                <span class="badge badge-danger"><?php echo $p['red_cards']; ?></span>
                                <span style="font-size:.72rem;color:var(--text-muted);margin-left:4px;">₦<?php echo number_format($r_due); ?></span>
                                <?php else: ?><span style="color:var(--text-muted);">—</span><?php endif; ?>
                            </td>
                            <td style="font-weight:700;color:#f87171;">₦<?php echo number_format($y_due + $r_due); ?></td>
                            <td style="color:var(--forest-400);">₦<?php echo number_format($p['total_paid'] ?? 0); ?></td>
                            <td>
                                <div style="display:flex;gap:4px;">
                                    <?php if ($p['yellow_cards'] > 0): ?>
                                    <button onclick="openClearCard(<?php echo $p['id']; ?>,'yellow',<?php echo $fine_rates['yellow'] ?? 5000; ?>,'<?php echo addslashes($p['full_name']); ?>')"
                                            class="btn btn-ghost btn-xs" style="color:#fbbf24;border-color:#fbbf2440;">Clear Yellow</button>
                                    <?php endif; ?>
                                    <?php if ($p['red_cards'] > 0): ?>
                                    <button onclick="openClearCard(<?php echo $p['id']; ?>,'red',<?php echo $fine_rates['red'] ?? 10000; ?>,'<?php echo addslashes($p['full_name']); ?>')"
                                            class="btn btn-danger btn-xs">Clear Red</button>
                                    <?php endif; ?>
                                </div>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <!-- Mobile cards -->
            <div id="tableMobile" style="padding:12px;display:flex;flex-direction:column;gap:10px;">
                <?php foreach ($players_with_cards as $p):
                    $y_due = $p['yellow_cards'] * ($fine_rates['yellow'] ?? 5000);
                    $r_due = $p['red_cards'] * ($fine_rates['red'] ?? 10000);
                ?>
                <div style="background:var(--pitch-700);border:1px solid var(--border);border-radius:8px;padding:14px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                        <div class="p-avatar md"><?php echo strtoupper(substr($p['full_name'],0,1)); ?></div>
                        <div style="flex:1;">
                            <div style="font-weight:700;">#<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?></div>
                            <div style="font-size:.72rem;color:var(--text-muted);"><?php echo $p['position']; ?></div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
                        <div style="text-align:center;background:var(--pitch-800);border-radius:5px;padding:8px;">
                            <div style="font-weight:800;color:#fbbf24;"><?php echo $p['yellow_cards']; ?></div>
                            <div style="font-size:.6rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Yellow</div>
                        </div>
                        <div style="text-align:center;background:var(--pitch-800);border-radius:5px;padding:8px;">
                            <div style="font-weight:800;color:#f87171;"><?php echo $p['red_cards']; ?></div>
                            <div style="font-size:.6rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Red</div>
                        </div>
                        <div style="text-align:center;background:var(--pitch-800);border-radius:5px;padding:8px;">
                            <div style="font-weight:800;color:#f87171;font-size:.9rem;">₦<?php echo number_format($y_due+$r_due); ?></div>
                            <div style="font-size:.6rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Due</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <?php if ($p['yellow_cards'] > 0): ?>
                        <button onclick="openClearCard(<?php echo $p['id']; ?>,'yellow',<?php echo $fine_rates['yellow'] ?? 5000; ?>,'<?php echo addslashes($p['full_name']); ?>')"
                                class="btn btn-ghost btn-xs" style="flex:1;color:#fbbf24;border-color:#fbbf2440;">Clear Yellow</button>
                        <?php endif; ?>
                        <?php if ($p['red_cards'] > 0): ?>
                        <button onclick="openClearCard(<?php echo $p['id']; ?>,'red',<?php echo $fine_rates['red'] ?? 10000; ?>,'<?php echo addslashes($p['full_name']); ?>')"
                                class="btn btn-danger btn-xs" style="flex:1;">Clear Red</button>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
            <?php else: ?>
            <div class="empty-state"><p>No players with outstanding cards</p></div>
            <?php endif; ?>
        </div>

        <!-- Recent payments -->
        <div class="card">
            <div class="card-hd"><span class="card-hd-title">Recent Payments</span></div>
            <?php if (!empty($recent_payments)): ?>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Player</th>
                            <th>Card</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($recent_payments as $pay): ?>
                        <tr>
                            <td style="white-space:nowrap;color:var(--text-muted);font-size:.8rem;">
                                <?php echo date('M j, Y', strtotime($pay['payment_date'] ?? $pay['created_at'])); ?>
                            </td>
                            <td><span style="font-weight:600;">#<?php echo $pay['player_number']; ?> <?php echo htmlspecialchars($pay['full_name']); ?></span></td>
                            <td>
                                <?php if ($pay['card_type'] === 'yellow'): ?>
                                <span class="badge badge-warning">Yellow</span>
                                <?php else: ?>
                                <span class="badge badge-danger">Red</span>
                                <?php endif; ?>
                            </td>
                            <td style="font-weight:700;color:var(--forest-400);">₦<?php echo number_format($pay['amount']); ?></td>
                            <td><?php echo htmlspecialchars($pay['payment_method'] ?? '—'); ?></td>
                            <td style="font-size:.75rem;color:var(--text-muted);"><?php echo htmlspecialchars($pay['reference_number'] ?? '—'); ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php else: ?>
            <div class="empty-state"><p>No payments recorded yet</p></div>
            <?php endif; ?>
        </div>
    </main>
</div>

<!-- Mobile bottom nav -->
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
        <a href="reports.php" class="mobile-nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Reports
        </a>
    </div>
</nav>

<!-- Clear Card Modal -->
<div id="clearCardModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100;align-items:center;justify-content:center;padding:16px;">
    <div style="background:var(--pitch-800);border:1px solid var(--border);border-radius:10px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;">
        <div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:700;font-size:.9rem;">Record Payment</span>
            <button onclick="document.getElementById('clearCardModal').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem;">×</button>
        </div>
        <form method="POST" style="padding:18px;display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" name="clear_card" value="1">
            <input type="hidden" name="player_id" id="modalPlayerId">
            <input type="hidden" name="card_type" id="modalCardType">

            <div style="background:var(--pitch-700);border:1px solid var(--border);border-radius:7px;padding:12px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.8rem;">
                    <span style="color:var(--text-muted);">Player</span>
                    <span id="modalPlayerName" style="font-weight:700;"></span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.8rem;">
                    <span style="color:var(--text-muted);">Card Type</span>
                    <span id="modalCardTypeText" style="font-weight:700;"></span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:.8rem;">
                    <span style="color:var(--text-muted);">Amount Due</span>
                    <span id="modalAmount" style="font-weight:800;color:#fbbf24;"></span>
                </div>
            </div>

            <div>
                <label class="field-label">Payment Method</label>
                <select name="payment_method" class="field" required>
                    <option value="">Select method</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div>
                <label class="field-label">Reference Number</label>
                <input type="text" name="reference_number" class="field" placeholder="e.g., transfer ref, receipt no.">
            </div>
            <div>
                <label class="field-label">Notes (optional)</label>
                <textarea name="notes" class="field" rows="2" placeholder="Any notes…"></textarea>
            </div>

            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button type="button" onclick="document.getElementById('clearCardModal').style.display='none'" class="btn btn-ghost btn-sm">Cancel</button>
                <button type="submit" class="btn btn-success btn-sm">Confirm Payment</button>
            </div>
        </form>
    </div>
</div>

<!-- Configure Fines Modal -->
<div id="configModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100;align-items:center;justify-content:center;padding:16px;">
    <div style="background:var(--pitch-800);border:1px solid var(--border);border-radius:10px;width:100%;max-width:400px;">
        <div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:700;font-size:.9rem;">Configure Fine Rates</span>
            <button onclick="document.getElementById('configModal').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem;">×</button>
        </div>
        <form method="POST" style="padding:18px;display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" name="update_fines" value="1">
            <div>
                <label class="field-label">Yellow Card Fine (₦)</label>
                <input type="number" name="fines[yellow]" class="field"
                       value="<?php echo $fine_rates['yellow'] ?? 5000; ?>" step="100" min="0" required>
            </div>
            <div>
                <label class="field-label">Red Card Fine (₦)</label>
                <input type="number" name="fines[red]" class="field"
                       value="<?php echo $fine_rates['red'] ?? 10000; ?>" step="100" min="0" required>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button type="button" onclick="document.getElementById('configModal').style.display='none'" class="btn btn-ghost btn-sm">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm">Save Rates</button>
            </div>
        </form>
    </div>
</div>

<script>
function applyView() {
    var w = window.innerWidth;
    document.getElementById('tableDesktop').style.display = w >= 768 ? 'block' : 'none';
    document.getElementById('tableMobile').style.display  = w <  768 ? 'flex'  : 'none';
}
applyView();
window.addEventListener('resize', applyView);

function openClearCard(playerId, cardType, amount, playerName) {
    document.getElementById('modalPlayerId').value = playerId;
    document.getElementById('modalCardType').value = cardType;
    document.getElementById('modalPlayerName').textContent = playerName;
    document.getElementById('modalCardTypeText').textContent = cardType === 'yellow' ? 'Yellow Card' : 'Red Card';
    document.getElementById('modalAmount').textContent = '₦' + amount.toLocaleString();
    document.getElementById('clearCardModal').style.display = 'flex';
}

window.addEventListener('click', function(e) {
    ['clearCardModal','configModal'].forEach(function(id) {
        var el = document.getElementById(id);
        if (e.target === el) el.style.display = 'none';
    });
});
</script>
</body>
</html>
