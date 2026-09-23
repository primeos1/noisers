<?php
// admin/match_detail.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id  = getTeamId();
$match_id = $_GET['match_id'] ?? $_GET['id'] ?? null;
$tab      = $_GET['tab'] ?? 'overview';

if (!$match_id) { header('Location: manage_matches.php'); exit(); }

$match_stmt = $pdo->prepare("SELECT m.* FROM matches m WHERE m.id=? AND m.team_id=?");
$match_stmt->execute([$match_id, $team_id]);
$match = $match_stmt->fetch();
if (!$match) { header('Location: manage_matches.php'); exit(); }

$error = $success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'end_match') {
        try {
            $pdo->prepare("UPDATE matches SET status='completed', updated_at=NOW() WHERE id=? AND team_id=?")->execute([$match_id, $team_id]);
            $_SESSION['success'] = "Match ended and marked as completed.";
        } catch (PDOException $e) {
            $_SESSION['error'] = "Error: " . $e->getMessage();
        }
        header('Location: match_detail.php?id='.$match_id.'&tab='.$tab); exit();
    } elseif ($action === 'add_existing_player') {
        $player_ids = $_POST['player_ids'] ?? [];
        try {
            $pdo->beginTransaction();
            $added = 0;
            foreach ($player_ids as $pid) {
                $chk = $pdo->prepare("SELECT id FROM player_match_stats WHERE match_id=? AND player_id=?");
                $chk->execute([$match_id, $pid]);
                if (!$chk->fetch()) {
                    $pdo->prepare("INSERT INTO player_match_stats (match_id,player_id,goals,assists,yellow_cards,red_cards,minutes_played) VALUES (?,?,0,0,0,0,0)")->execute([$match_id,$pid]);
                    $added++;
                }
            }
            $pdo->commit();
            if ($added > 0) $_SESSION['success'] = "$added player(s) added!";
            header('Location: match_detail.php?id='.$match_id.'&tab=players'); exit();
        } catch (PDOException $e) { $pdo->rollBack(); $_SESSION['error']="Error: ".$e->getMessage(); header('Location: match_detail.php?id='.$match_id.'&tab=players'); exit(); }
    } elseif ($action === 'create_player') {
        $fn=$_POST['full_name']??''; $pn=$_POST['player_number']??''; $pos=$_POST['position']??'';
        if (!trim($fn)||!$pn||!$pos) { $_SESSION['error']="Fill Name, Jersey, Position"; }
        else {
            try {
                $pdo->beginTransaction();
                $pdo->prepare("INSERT INTO players (full_name,player_number,position,rating,phone,team_id) VALUES (?,?,?,?,?,?)")->execute([$fn,$pn,$pos,intval($_POST['rating']??1),trim($_POST['phone']??''),$team_id]);
                $npid=$pdo->lastInsertId();
                $pdo->prepare("INSERT INTO player_match_stats (match_id,player_id,goals,assists,yellow_cards,red_cards,minutes_played) VALUES (?,?,0,0,0,0,0)")->execute([$match_id,$npid]);
                $pdo->commit(); $_SESSION['success']="Player added!";
            } catch (PDOException $e) { $pdo->rollBack(); $_SESSION['error']="Error: ".$e->getMessage(); }
        }
        header('Location: match_detail.php?id='.$match_id.'&tab=players'); exit();
    }
}

$players_stmt = $pdo->prepare("
    SELECT p.*,
           (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id=s.id WHERE se.player_id=p.id AND s.match_id=? AND se.event_type='goal') as goals,
           (SELECT COUNT(*) FROM set_events se JOIN sets s ON se.set_id=s.id WHERE se.player_id=p.id AND s.match_id=? AND se.event_type='assist') as assists,
           pms.yellow_cards, pms.red_cards, pms.minutes_played
    FROM players p INNER JOIN player_match_stats pms ON p.id=pms.player_id
    WHERE pms.match_id=? AND p.team_id=? ORDER BY p.player_number ASC
");
$players_stmt->execute([$match_id,$match_id,$match_id,$team_id]);
$players=$players_stmt->fetchAll();

$sets_stmt=$pdo->prepare("SELECT s.*,COUNT(CASE WHEN se.event_type='goal' THEN 1 END) as total_goals FROM sets s LEFT JOIN set_events se ON s.id=se.set_id WHERE s.match_id=? GROUP BY s.id ORDER BY s.set_number ASC");
$sets_stmt->execute([$match_id]);
$sets=$sets_stmt->fetchAll();

$stats_stmt=$pdo->prepare("SELECT COUNT(DISTINCT s.id) as total_sets,SUM(s.team1_goals+s.team2_goals) as total_goals,SUM(CASE WHEN s.winner='team1' THEN 1 ELSE 0 END) as team1_wins,SUM(CASE WHEN s.winner='team2' THEN 1 ELSE 0 END) as team2_wins,SUM(CASE WHEN s.winner='draw' THEN 1 ELSE 0 END) as draws FROM sets s WHERE s.match_id=? AND s.status='completed'");
$stats_stmt->execute([$match_id]);
$match_stats=$stats_stmt->fetch();

$top_stmt=$pdo->prepare("SELECT p.id,p.full_name,p.player_number,p.position,p.rating,p.profile_image,pms.goals,pms.assists,pms.yellow_cards,pms.red_cards,(pms.goals*3+pms.assists*2-pms.yellow_cards-pms.red_cards*3) as score FROM players p INNER JOIN player_match_stats pms ON p.id=pms.player_id WHERE pms.match_id=? ORDER BY score DESC LIMIT 5");
$top_stmt->execute([$match_id]);
$top_performers=$top_stmt->fetchAll();

$all_teams_stmt=$pdo->prepare("SELECT mt.* FROM match_teams mt WHERE mt.match_id=? ORDER BY mt.id ASC");
$all_teams_stmt->execute([$match_id]);
$all_teams=$all_teams_stmt->fetchAll();

function gpd($pdo,$json){ $ids=json_decode($json,true); if(empty($ids)||!is_array($ids)) return []; $v=array_filter($ids,function($i){return is_numeric($i)&&$i>0;}); if(empty($v)) return []; $ph=str_repeat('?,',count($v)-1).'?'; $st=$pdo->prepare("SELECT id,player_number,full_name,position FROM players WHERE id IN($ph) ORDER BY player_number ASC"); $st->execute(array_values($v)); return $st->fetchAll(); }
foreach ($all_teams as &$t) { $t['player_details']=gpd($pdo,$t['players']); } unset($t);

$events_stmt=$pdo->prepare("SELECT se.*,p.player_number,p.full_name,p.position,s.set_number FROM set_events se JOIN players p ON se.player_id=p.id JOIN sets s ON se.set_id=s.id WHERE s.match_id=? ORDER BY se.created_at DESC LIMIT 50");
$events_stmt->execute([$match_id]);
$events=$events_stmt->fetchAll();

$avail_stmt=$pdo->prepare("SELECT p.id,p.full_name,p.position,p.player_number,p.rating FROM players p WHERE p.team_id=? AND p.id NOT IN (SELECT DISTINCT player_id FROM player_match_stats WHERE match_id=?) ORDER BY p.player_number ASC");
$avail_stmt->execute([$team_id,$match_id]);
$available_players=$avail_stmt->fetchAll();

if (isset($_SESSION['success'])) { $success=$_SESSION['success']; unset($_SESSION['success']); }
if (isset($_SESSION['error']))   { $error=$_SESSION['error'];     unset($_SESSION['error']); }

$sc=$match['status']==='ongoing'?'ms-ongoing':($match['status']==='completed'?'ms-completed':($match['status']==='scheduled'?'ms-scheduled':'badge-muted'));
$pcm=['Goalkeeper'=>'pos-gk','Defender'=>'pos-df','Midfielder'=>'pos-mf','Forward'=>'pos-fw'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title><?php echo htmlspecialchars($match['match_name']?:'Match Detail'); ?> — Noisers Football Pro</title>
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
            <a href="dashboard.php" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>Dashboard</a>
            <a href="manage_players.php" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Players</a>
            <a href="create_match.php" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>New Match</a>
            <a href="randomize_sets.php" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>Manage Sets</a>
            <a href="match_management.php" class="sidebar-link active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>Live Matches</a>
            <a href="manage_cards.php" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/></svg>Cards</a>
            <div class="sidebar-divider"></div>
            <a href="reports.php" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Reports</a>
            <a href="settings.php" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Settings</a>
            <div class="sidebar-divider"></div>
            <a href="../logout.php" class="sidebar-link" style="color:#f87171;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Logout</a>
        </nav>
    </aside>

    <main class="main-area">
        <div class="page-hd">
            <div class="page-hd-row">
                <div>
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                        <div class="page-title"><?php echo htmlspecialchars($match['match_name']?:'Untitled Match'); ?></div>
                        <span class="badge <?php echo $sc; ?>"><?php echo ucfirst($match['status']); ?></span>
                    </div>
                    <div class="page-sub"><?php echo date('l, j M Y', strtotime($match['match_date'])); ?><?php if($match['location']): ?> · <?php echo htmlspecialchars($match['location']); ?><?php endif; ?> · <?php echo count($players); ?> players · <?php echo count($sets); ?> sets</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <?php if ($match['status']==='scheduled'): ?>
                    <a href="randomize_sets.php?match_id=<?php echo $match_id; ?>" class="btn btn-success btn-sm">Prepare Teams</a>
                    <?php elseif ($match['status']==='ongoing'): ?>
                    <a href="randomize_sets.php?match_id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm">Modify Teams</a>
                    <a href="match_management.php?match_id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm" style="color:#fbbf24;border-color:#fbbf2440;">Live Control</a>
                    <form method="POST" style="display:inline;" onsubmit="return confirm('End this match? This will mark it as completed and no further sets can be scheduled.');">
                        <input type="hidden" name="action" value="end_match">
                        <button type="submit" class="btn btn-sm" style="background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b;">End Match</button>
                    </form>
                    <?php endif; ?>
                    <a href="edit_match.php?id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm">Edit</a>
                    <a href="manage_matches.php" class="btn btn-ghost btn-sm">All Matches</a>
                </div>
            </div>
        </div>

        <?php if ($error): ?><div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div><?php endif; ?>
        <?php if ($success): ?><div class="alert alert-success"><?php echo htmlspecialchars($success); ?></div><?php endif; ?>

        <!-- Tab bar -->
        <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:16px;overflow-x:auto;">
            <?php foreach (['overview'=>'Overview','players'=>'Players ('.count($players).')','sets'=>'Sets ('.count($sets).')','events'=>'Events'] as $k=>$lbl): ?>
            <a href="?id=<?php echo $match_id; ?>&tab=<?php echo $k; ?>"
               style="padding:10px 16px;text-decoration:none;font-family:'Jost',sans-serif;font-size:.8rem;font-weight:700;white-space:nowrap;border-bottom:2px solid <?php echo $tab===$k?'var(--burg-500)':'transparent'; ?>;color:<?php echo $tab===$k?'var(--burg-300)':'var(--text-muted)'; ?>;margin-bottom:-1px;">
                <?php echo $lbl; ?>
            </a>
            <?php endforeach; ?>
        </div>

        <?php if ($tab==='overview'): ?>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:16px;">
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Statistics</span></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
                    <?php foreach ([['Sets',$match_stats['total_sets']??0,'var(--text-main)'],['Goals',$match_stats['total_goals']??0,'var(--forest-400)'],['T1 Wins',$match_stats['team1_wins']??0,'var(--burg-300)'],['T2 Wins',$match_stats['team2_wins']??0,'var(--pitch-300)'],['Draws',$match_stats['draws']??0,'#fbbf24'],['Players',count($players),'var(--text-main)']] as [$l,$v,$c]): ?>
                    <div style="padding:14px;border-right:1px solid var(--pitch-700);border-bottom:1px solid var(--pitch-700);text-align:center;">
                        <div style="font-size:1.5rem;font-weight:800;color:<?php echo $c; ?>;"><?php echo $v; ?></div>
                        <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-top:3px;"><?php echo $l; ?></div>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
            <div class="card">
                <div class="card-hd"><span class="card-hd-title">Top Performers</span></div>
                <?php if (!empty($top_performers)): ?>
                <div>
                    <?php foreach ($top_performers as $i=>$p):
                        $img="../assets/uploads/teams/{$team_id}/players/".$p['profile_image'];
                        $hi=!empty($p['profile_image'])&&file_exists($img);
                        $pc=$pcm[$p['position']]??'badge-muted';
                    ?>
                    <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--pitch-700);">
                        <span style="font-size:.7rem;font-weight:700;color:var(--text-muted);width:16px;text-align:center;"><?php echo $i+1; ?></span>
                        <div class="p-avatar"><?php if($hi): ?><img src="<?php echo htmlspecialchars($img); ?>" alt=""><?php else: ?><?php echo strtoupper(substr($p['full_name'],0,1)); ?><?php endif; ?></div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo htmlspecialchars($p['full_name']); ?></div>
                            <span class="badge <?php echo $pc; ?>"><?php echo substr($p['position'],0,3); ?></span>
                        </div>
                        <div style="display:flex;gap:8px;font-size:.8rem;font-weight:700;">
                            <span style="color:var(--forest-400);"><?php echo $p['goals']; ?>G</span>
                            <span style="color:var(--pitch-300);"><?php echo $p['assists']; ?>A</span>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php else: ?><div class="empty-state"><p>No stats yet</p></div><?php endif; ?>
            </div>
        </div>
        <div class="card">
            <div class="card-hd"><span class="card-hd-title">Roster</span></div>
            <?php if (!empty($players)): ?>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>Player</th><th>Pos</th><th>G</th><th>A</th><th>YC</th><th>RC</th></tr></thead>
                    <tbody>
                        <?php foreach ($players as $p): $pc=$pcm[$p['position']]??'badge-muted'; ?>
                        <tr>
                            <td><div style="display:flex;align-items:center;gap:10px;"><div class="p-avatar"><?php echo strtoupper(substr($p['full_name'],0,1)); ?></div><div style="font-weight:600;">#<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?></div></div></td>
                            <td><span class="badge <?php echo $pc; ?>"><?php echo substr($p['position'],0,3); ?></span></td>
                            <td style="font-weight:700;color:var(--forest-400);"><?php echo $p['goals']; ?></td>
                            <td style="color:var(--pitch-300);"><?php echo $p['assists']; ?></td>
                            <td style="color:#fbbf24;"><?php echo $p['yellow_cards']; ?></td>
                            <td style="color:#f87171;"><?php echo $p['red_cards']; ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php else: ?><div class="empty-state"><p>No players</p></div><?php endif; ?>
        </div>

        <?php elseif ($tab==='players'): ?>
        <div class="card" style="margin-bottom:16px;">
            <div class="card-hd"><span class="card-hd-title">Add Players</span></div>
            <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;gap:8px;">
                <button onclick="showAddTab('existing')" id="tbExisting" class="btn btn-ghost btn-sm" style="background:var(--burg-800);color:var(--text-main);">From Roster</button>
                <button onclick="showAddTab('new')" id="tbNew" class="btn btn-ghost btn-sm">Create New</button>
            </div>
            <div id="addExisting" style="padding:16px;">
                <form method="POST">
                    <input type="hidden" name="action" value="add_existing_player">
                    <label class="field-label">Select Players</label>
                    <select name="player_ids[]" multiple class="field" style="height:150px;margin-bottom:12px;">
                        <?php if(!empty($available_players)): foreach($available_players as $p): ?><option value="<?php echo $p['id']; ?>">#<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?> (<?php echo $p['position']; ?>)</option><?php endforeach; else: ?><option disabled>All team players already in match</option><?php endif; ?>
                    </select>
                    <button type="submit" class="btn btn-primary btn-sm">Add Selected</button>
                </form>
            </div>
            <div id="addNew" style="display:none;padding:16px;">
                <form method="POST">
                    <input type="hidden" name="action" value="create_player">
                    <div class="form-grid form-grid-2" style="gap:12px;margin-bottom:12px;">
                        <div><label class="field-label">Full Name *</label><input type="text" name="full_name" class="field" required></div>
                        <div><label class="field-label">Jersey # *</label><input type="number" name="player_number" class="field" min="1" max="99" required></div>
                        <div><label class="field-label">Position *</label><select name="position" class="field" required><option value="">Select</option><?php foreach(['Goalkeeper','Defender','Midfielder','Forward'] as $pos): ?><option value="<?php echo $pos; ?>"><?php echo $pos; ?></option><?php endforeach; ?></select></div>
                        <div><label class="field-label">Rating</label><select name="rating" class="field"><?php for($i=1;$i<=5;$i++): ?><option value="<?php echo $i; ?>" <?php echo $i===3?'selected':''; ?>><?php echo str_repeat('★',$i); ?></option><?php endfor; ?></select></div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-sm">Create &amp; Add</button>
                </form>
            </div>
        </div>
        <div class="card">
            <div class="card-hd"><span class="card-hd-title">Roster (<?php echo count($players); ?>)</span></div>
            <?php if(!empty($players)): ?>
            <div class="table-wrap"><table class="data-table"><thead><tr><th>Player</th><th>Pos</th><th>Rating</th><th>G</th><th>A</th><th>YC</th><th>RC</th></tr></thead><tbody>
                <?php foreach($players as $p): $pc=$pcm[$p['position']]??'badge-muted'; ?>
                <tr>
                    <td><div style="display:flex;align-items:center;gap:10px;"><div class="p-avatar"><?php echo strtoupper(substr($p['full_name'],0,1)); ?></div><div style="font-weight:600;">#<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?></div></div></td>
                    <td><span class="badge <?php echo $pc; ?>"><?php echo substr($p['position'],0,2); ?></span></td>
                    <td><span class="stars" style="font-size:.75rem;"><?php for($i=1;$i<=5;$i++): ?><span class="<?php echo $i<=$p['rating']?'star-on':'star-off'; ?>">★</span><?php endfor; ?></span></td>
                    <td style="color:var(--forest-400);font-weight:700;"><?php echo $p['goals']; ?></td>
                    <td style="color:var(--pitch-300);"><?php echo $p['assists']; ?></td>
                    <td style="color:#fbbf24;"><?php echo $p['yellow_cards']; ?></td>
                    <td style="color:#f87171;"><?php echo $p['red_cards']; ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody></table></div>
            <?php else: ?><div class="empty-state"><p>No players yet</p></div><?php endif; ?>
        </div>

        <?php elseif ($tab==='sets'): ?>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
            <?php if ($match['status']!=='completed'): ?>
            <a href="randomize_sets.php?match_id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm">Modify Teams</a>
            <?php endif; ?>
            <?php if ($match['status']!=='completed'): ?><a href="assign_sets.php?match_id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm">Schedule Sets</a><?php endif; ?>
            <?php if ($match['status']!=='completed'): $np=null; foreach($sets as $s){if($s['status']==='pending'&&$s['team1_id']&&$s['team2_id']){$np=$s;break;}} if($np): ?>
            <a href="match_management.php?set_id=<?php echo $np['id']; ?>" class="btn btn-success btn-sm">Start Set #<?php echo $np['set_number']; ?></a>
            <?php endif; endif; ?>
        </div>
        <?php if(!empty($sets)): ?>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
            <?php foreach($sets as $set):
                $ss=$set['status']==='completed'?'badge-forest':($set['status']==='active'?'badge-warning':'badge-muted');
                $t1=null;$t2=null; foreach($all_teams as $t){if($t['id']==$set['team1_id'])$t1=$t; if($t['id']==$set['team2_id'])$t2=$t;}
            ?>
            <div class="card">
                <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-weight:700;font-size:.85rem;">Set #<?php echo $set['set_number']; ?></span>
                    <span class="badge <?php echo $ss; ?>"><?php echo ucfirst($set['status']); ?></span>
                </div>
                <div style="padding:12px;text-align:center;">
                    <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-bottom:10px;">
                        <div style="text-align:right;font-weight:600;font-size:.8rem;"><?php echo $t1?htmlspecialchars($t1['team_name']):'TBD'; ?><?php if($set['winner']==='team1'): ?><span style="color:var(--forest-400);"> ★</span><?php endif; ?></div>
                        <div style="font-size:1.6rem;font-weight:900;"><?php echo $set['team1_goals']; ?> – <?php echo $set['team2_goals']; ?></div>
                        <div style="text-align:left;font-weight:600;font-size:.8rem;"><?php if($set['winner']==='team2'): ?><span style="color:var(--forest-400);">★ </span><?php endif; ?><?php echo $t2?htmlspecialchars($t2['team_name']):'TBD'; ?></div>
                    </div>
                    <div style="display:flex;gap:6px;justify-content:center;">
                        <?php if($set['status']==='pending'): ?>
                            <?php if(!$set['team1_id']||!$set['team2_id']): ?><a href="assign_sets.php?match_id=<?php echo $match_id; ?>" class="btn btn-ghost btn-xs">Assign</a>
                            <?php else: ?><a href="match_management.php?set_id=<?php echo $set['id']; ?>" class="btn btn-success btn-xs">Start</a><?php endif; ?>
                        <?php elseif($set['status']==='active'): ?><a href="match_management.php?set_id=<?php echo $set['id']; ?>" class="btn btn-ghost btn-xs" style="color:#fbbf24;border-color:#fbbf2440;">Live</a>
                        <?php else: ?><a href="match_management.php?set_id=<?php echo $set['id']; ?>" class="btn btn-ghost btn-xs">View</a><?php endif; ?>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        <?php else: ?>
        <div class="empty-state">
            <p>No sets yet</p>
            <?php if(empty($all_teams)): ?><a href="randomize_sets.php?match_id=<?php echo $match_id; ?>" class="btn btn-primary btn-sm" style="margin-top:14px;">Create Teams</a>
            <?php else: ?><a href="assign_sets.php?match_id=<?php echo $match_id; ?>" class="btn btn-primary btn-sm" style="margin-top:14px;">Schedule Matches</a><?php endif; ?>
        </div>
        <?php endif; ?>

        <?php elseif($tab==='events'): ?>
        <div class="card">
            <div class="card-hd"><span class="card-hd-title">Events</span><a href="match_history.php?match_id=<?php echo $match_id; ?>" class="btn btn-ghost btn-xs">Full History</a></div>
            <?php if(!empty($events)): ?>
            <div>
                <?php foreach($events as $ev):
                    $ec=['goal'=>'var(--forest-400)','assist'=>'var(--pitch-300)','yellow_card'=>'#fbbf24','red_card'=>'#f87171'][$ev['event_type']]??'var(--text-muted)';
                    $ei=['goal'=>'⚽','assist'=>'🎯','yellow_card'=>'⚠️','red_card'=>'🟥'][$ev['event_type']]??'📝';
                ?>
                <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--pitch-700);">
                    <span style="font-size:1.1rem;"><?php echo $ei; ?></span>
                    <div style="flex:1;"><div style="font-weight:600;font-size:.85rem;color:<?php echo $ec; ?>;"><?php echo ucfirst(str_replace('_',' ',$ev['event_type'])); ?> — Set #<?php echo $ev['set_number']; ?></div><div style="font-size:.75rem;color:var(--text-muted);">#<?php echo $ev['player_number']; ?> <?php echo htmlspecialchars($ev['full_name']); ?></div></div>
                    <div style="font-size:.72rem;color:var(--text-muted);text-align:right;"><?php echo $ev['minute']; ?>'<?php if($ev['extra_time']>0) echo '+'.$ev['extra_time']; ?><br><?php echo date('H:i', strtotime($ev['created_at'])); ?></div>
                </div>
                <?php endforeach; ?>
            </div>
            <?php else: ?><div class="empty-state"><p>No events yet</p></div><?php endif; ?>
        </div>
        <?php endif; ?>
    </main>
</div>

<nav class="mobile-nav" style="font-family:'Jost',sans-serif;">
    <div class="mobile-nav-row">
        <a href="dashboard.php" class="mobile-nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>Home</a>
        <a href="manage_players.php" class="mobile-nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Players</a>
        <a href="match_management.php" class="mobile-nav-item active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>Matches</a>
        <a href="randomize_sets.php" class="mobile-nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>Sets</a>
        <a href="reports.php" class="mobile-nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Reports</a>
    </div>
</nav>

<script>
function showAddTab(w){
    document.getElementById('addExisting').style.display=w==='existing'?'block':'none';
    document.getElementById('addNew').style.display=w==='new'?'block':'none';
    document.getElementById('tbExisting').style.background=w==='existing'?'var(--burg-800)':'';
    document.getElementById('tbExisting').style.color=w==='existing'?'var(--text-main)':'';
    document.getElementById('tbNew').style.background=w==='new'?'var(--burg-800)':'';
    document.getElementById('tbNew').style.color=w==='new'?'var(--text-main)':'';
}
<?php if($match['status']==='ongoing'): ?>setTimeout(function(){location.reload();},30000);<?php endif; ?>
</script>
</body>
</html>
