<?php
// admin/match_management.php
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");

require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id  = getTeamId();
$set_id   = $_GET['set_id']   ?? null;
$match_id = $_GET['match_id'] ?? null;

if ($match_id && !$set_id) {
    $st = $pdo->prepare("SELECT s.* FROM sets s JOIN matches m ON s.match_id=m.id WHERE m.id=? AND m.team_id=? AND (s.status='pending' OR s.status='active') ORDER BY s.set_number ASC LIMIT 1");
    $st->execute([$match_id,$team_id]);
    $s = $st->fetch();
    if (!$s) {
        $st2=$pdo->prepare("SELECT s.* FROM sets s JOIN matches m ON s.match_id=m.id WHERE m.id=? AND m.team_id=? ORDER BY s.set_number DESC LIMIT 1");
        $st2->execute([$match_id,$team_id]);
        $s=$st2->fetch();
    }
    if ($s) $set_id=$s['id'];
    else { header("Location: randomize_sets.php?match_id=$match_id"); exit(); }
}

if (!$set_id) { header('Location: manage_matches.php'); exit(); }

$set_stmt=$pdo->prepare("SELECT s.*,UNIX_TIMESTAMP(s.start_time) as start_unix,m.match_name,m.match_date,m.location,m.team_id as match_team_id FROM sets s JOIN matches m ON s.match_id=m.id WHERE s.id=? AND m.team_id=?");
$set_stmt->execute([$set_id,$team_id]);
$set=$set_stmt->fetch();
if (!$set) { header('Location: manage_matches.php'); exit(); }
$match_id=$set['match_id'];

function getTeamData($pdo,$tid,$sid){
    if(!$tid) return ['name'=>'TBD','color'=>'#888','players'=>[]];
    $st=$pdo->prepare("SELECT * FROM match_teams WHERE id=?"); $st->execute([$tid]); $td=$st->fetch();
    if(!$td) return ['name'=>'TBD','color'=>'#888','players'=>[]];
    $ids=json_decode($td['players']??'[]',true); $players=[];
    if(!empty($ids)&&is_array($ids)){
        $ph=str_repeat('?,',count($ids)-1).'?';
        $ps=$pdo->prepare("SELECT p.*,(SELECT COUNT(*) FROM set_events se WHERE se.player_id=p.id AND se.set_id=? AND se.event_type='goal') as goals_in_set,(SELECT COUNT(*) FROM set_events se WHERE se.player_id=p.id AND se.set_id=? AND se.event_type='assist') as assists_in_set,(SELECT COUNT(*) FROM set_events se WHERE se.player_id=p.id AND se.set_id=? AND se.event_type='yellow_card') as yc_in_set,(SELECT COUNT(*) FROM set_events se WHERE se.player_id=p.id AND se.set_id=? AND se.event_type='red_card') as rc_in_set FROM players p WHERE p.id IN($ph) ORDER BY p.player_number ASC");
        $ps->execute(array_merge([$sid,$sid,$sid,$sid],$ids)); $players=$ps->fetchAll();
    }
    return ['name'=>$td['team_name']??'Team','color'=>$td['color']??'#888','players'=>$players];
}

$t1=getTeamData($pdo,$set['team1_id'],$set_id);
$t2=getTeamData($pdo,$set['team2_id'],$set_id);

$all_players_stmt=$pdo->prepare("SELECT p.* FROM players p INNER JOIN player_match_stats pms ON p.id=pms.player_id WHERE pms.match_id=? AND p.team_id=? ORDER BY p.player_number ASC");
$all_players_stmt->execute([$match_id,$team_id]);
$all_players=$all_players_stmt->fetchAll();

$events_stmt=$pdo->prepare("SELECT se.*,p.player_number,p.full_name FROM set_events se JOIN players p ON se.player_id=p.id WHERE se.set_id=? ORDER BY se.minute ASC,se.extra_time ASC,se.created_at ASC");
$events_stmt->execute([$set_id]);
$events=$events_stmt->fetchAll();

$match_teams_stmt=$pdo->prepare("SELECT * FROM match_teams WHERE match_id=? ORDER BY id ASC");
$match_teams_stmt->execute([$match_id]);
$match_teams=$match_teams_stmt->fetchAll();

$elapsed=0; $time_left=600;
if ($set['status']==='active'&&$set['start_time']) { $elapsed=time()-(int)$set['start_unix']; $time_left=max(0,600-$elapsed); }
elseif ($set['status']==='completed'&&$set['start_time']&&$set['end_time']) { $elapsed=strtotime($set['end_time'])-strtotime($set['start_time']); $time_left=0; }

// AJAX
if ($_SERVER['REQUEST_METHOD']==='POST'&&isset($_SERVER['HTTP_X_REQUESTED_WITH'])&&$_SERVER['HTTP_X_REQUESTED_WITH']==='XMLHttpRequest') {
    header("Content-Type: application/json"); header("Cache-Control: no-cache");
    $action=$_POST['action']??''; $res=['success'=>false,'message'=>''];
    try {
        switch($action){
            case 'start_set': if($set['status']==='pending'){$pdo->prepare("UPDATE sets SET status='active',start_time=NOW() WHERE id=?")->execute([$set_id]);$res=['success'=>true,'status'=>'active'];} break;
            case 'pause_set': if($set['status']==='active'){$pdo->prepare("UPDATE sets SET status='paused' WHERE id=?")->execute([$set_id]);$res=['success'=>true,'status'=>'paused'];} break;
            case 'resume_set': if($set['status']==='paused'){$pdo->prepare("UPDATE sets SET status='active' WHERE id=?")->execute([$set_id]);$res=['success'=>true,'status'=>'active'];} break;
            case 'end_set':
                $winner=$_POST['winner']??null;
                $pdo->prepare("UPDATE sets SET status='completed',end_time=NOW(),winner=?,duration=TIMESTAMPDIFF(SECOND,start_time,NOW()) WHERE id=?")->execute([$winner,$set_id]);
                mm_updateMatchStats($pdo,$match_id);
                $res=['success'=>true,'status'=>'completed','winner'=>$winner]; break;
            case 'record_goal':
                $pid=$_POST['player_id']??0; $team=$_POST['team']??''; $min=$_POST['minute']??0; $ext=$_POST['extra_time']??0;
                if($pid&&in_array($team,['team1','team2'])){
                    $pdo->prepare("INSERT INTO set_events(set_id,player_id,event_type,minute,extra_time)VALUES(?,?,'goal',?,?)")->execute([$set_id,$pid,$min,$ext]);
                    $col=$team==='team1'?'team1_goals':'team2_goals';
                    $pdo->prepare("UPDATE sets SET $col=$col+1 WHERE id=?")->execute([$set_id]);
                    $pdo->prepare("UPDATE players SET goals=goals+1 WHERE id=?")->execute([$pid]);
                    $pdo->prepare("UPDATE player_match_stats SET goals=goals+1 WHERE player_id=? AND match_id=?")->execute([$pid,$match_id]);
                    $chk=$pdo->prepare("SELECT team1_goals,team2_goals FROM sets WHERE id=?"); $chk->execute([$set_id]); $sc=$chk->fetch();
                    $buzz=false;
                    if($sc['team1_goals']>=2||$sc['team2_goals']>=2){
                        $w=$sc['team1_goals']>=2?'team1':'team2';
                        $pdo->prepare("UPDATE sets SET status='completed',end_time=NOW(),winner=? WHERE id=?")->execute([$w,$set_id]);
                        mm_updateMatchStats($pdo,$match_id); $buzz=true;
                    }
                    $res=['success'=>true,'new_score'=>$sc,'buzz'=>$buzz];
                } break;
            case 'record_assist':
                $pid=$_POST['player_id']??0; $gpid=$_POST['goal_player_id']??0; $min=$_POST['minute']??0; $ext=$_POST['extra_time']??0;
                if($pid&&$gpid){
                    $pdo->prepare("INSERT INTO set_events(set_id,player_id,event_type,minute,extra_time,related_player_id)VALUES(?,?,'assist',?,?,?)")->execute([$set_id,$pid,$min,$ext,$gpid]);
                    $pdo->prepare("UPDATE players SET assists=assists+1 WHERE id=?")->execute([$pid]);
                    $pdo->prepare("UPDATE player_match_stats SET assists=assists+1 WHERE player_id=? AND match_id=?")->execute([$pid,$match_id]);
                    $res=['success'=>true,'message'=>'Assist recorded'];
                } break;
            case 'record_card':
                $pid=$_POST['player_id']??0; $ct=$_POST['card_type']??''; $min=$_POST['minute']??0; $ext=$_POST['extra_time']??0;
                if($pid&&in_array($ct,['yellow_card','red_card'])){
                    $pdo->prepare("INSERT INTO set_events(set_id,player_id,event_type,minute,extra_time)VALUES(?,?,?,?,?)")->execute([$set_id,$pid,$ct,$min,$ext]);
                    $col=$ct==='yellow_card'?'yellow_cards':'red_cards';
                    $pdo->prepare("UPDATE players SET $col=$col+1 WHERE id=?")->execute([$pid]);
                    $pdo->prepare("UPDATE player_match_stats SET $col=$col+1 WHERE player_id=? AND match_id=?")->execute([$pid,$match_id]);
                    $res=['success'=>true,'message'=>ucfirst(str_replace('_',' ',$ct)).' recorded'];
                } break;
            case 'get_set_status':
                $st2=$pdo->prepare("SELECT *,UNIX_TIMESTAMP(start_time) as start_unix FROM sets WHERE id=?"); $st2->execute([$set_id]); $ss=$st2->fetch();
                if($ss['status']==='active'&&$ss['start_time']){$el=time()-(int)$ss['start_unix'];$ss['elapsed_seconds']=$el;$ss['time_left']=max(0,600-$el);}
                $ev2=$pdo->prepare("SELECT se.*,p.player_number,p.full_name FROM set_events se JOIN players p ON se.player_id=p.id WHERE se.set_id=? ORDER BY se.minute ASC,se.extra_time ASC,se.created_at ASC");
                $ev2->execute([$set_id]); $evs=$ev2->fetchAll();
                $cnt=['goals'=>0,'assists'=>0,'yellow'=>0,'red'=>0];
                foreach($evs as $e){if($e['event_type']==='goal')$cnt['goals']++;elseif($e['event_type']==='assist')$cnt['assists']++;elseif($e['event_type']==='yellow_card')$cnt['yellow']++;elseif($e['event_type']==='red_card')$cnt['red']++;}
                $res=['success'=>true,'set'=>$ss,'events'=>$evs,'counts'=>$cnt]; break;
            case 'update_teams':
                $t1id=$_POST['team1_id']??null; $t2id=$_POST['team2_id']??null;
                if($t1id&&$t2id){$pdo->prepare("UPDATE sets SET team1_id=?,team2_id=?,team1_goals=0,team2_goals=0 WHERE id=?")->execute([$t1id,$t2id,$set_id]);$pdo->prepare("DELETE FROM set_events WHERE set_id=?")->execute([$set_id]);$res=['success'=>true,'message'=>'Teams updated'];}
                break;
        }
    } catch(PDOException $e){$res['message']='DB Error: '.$e->getMessage();}
    echo json_encode($res); exit();
}

// Non-AJAX POST
if ($_SERVER['REQUEST_METHOD']==='POST'&&!isset($_SERVER['HTTP_X_REQUESTED_WITH'])) {
    $action=$_POST['action']??'';
    try {
        if ($action==='record_goal_simple') {
            $pid=$_POST['player_id']??0;$team=$_POST['team']??'';$min=$_POST['minute']??0;$ext=$_POST['extra_time']??0;
            if($pid&&in_array($team,['team1','team2'])){
                $pdo->prepare("INSERT INTO set_events(set_id,player_id,event_type,minute,extra_time)VALUES(?,?,'goal',?,?)")->execute([$set_id,$pid,$min,$ext]);
                $col=$team==='team1'?'team1_goals':'team2_goals';
                $pdo->prepare("UPDATE sets SET $col=$col+1 WHERE id=?")->execute([$set_id]);
                $pdo->prepare("UPDATE players SET goals=goals+1 WHERE id=?")->execute([$pid]);
                $pdo->prepare("UPDATE player_match_stats SET goals=goals+1 WHERE player_id=? AND match_id=?")->execute([$pid,$match_id]);
                $_SESSION['flash_message']='Goal recorded!';$_SESSION['flash_type']='success';
                $chk=$pdo->prepare("SELECT team1_goals,team2_goals FROM sets WHERE id=?");$chk->execute([$set_id]);$sc=$chk->fetch();
                if($sc['team1_goals']>=2||$sc['team2_goals']>=2){$w=$sc['team1_goals']>=2?'team1':'team2';$pdo->prepare("UPDATE sets SET status='completed',end_time=NOW(),winner=? WHERE id=?")->execute([$w,$set_id]);mm_updateMatchStats($pdo,$match_id);$_SESSION['buzz_message']='Set ended!';}
            }
        } elseif ($action==='record_yellow_card_simple'||$action==='record_red_card_simple') {
            $pid=$_POST['player_id']??0;$min=$_POST['minute']??0;$ext=$_POST['extra_time']??0;
            $ct=strpos($action,'yellow')!==false?'yellow_card':'red_card';$col=$ct==='yellow_card'?'yellow_cards':'red_cards';
            if($pid){$pdo->prepare("INSERT INTO set_events(set_id,player_id,event_type,minute,extra_time)VALUES(?,?,?,?,?)")->execute([$set_id,$pid,$ct,$min,$ext]);$pdo->prepare("UPDATE players SET $col=$col+1 WHERE id=?")->execute([$pid]);$pdo->prepare("UPDATE player_match_stats SET $col=$col+1 WHERE player_id=? AND match_id=?")->execute([$pid,$match_id]);$_SESSION['flash_message']=ucfirst(str_replace('_',' ',$ct)).' recorded!';$_SESSION['flash_type']='success';}
        }
    } catch(PDOException $e){$_SESSION['flash_message']='Error: '.$e->getMessage();$_SESSION['flash_type']='error';}
    header("Location: match_management.php?set_id=$set_id"); exit();
}

function mm_updateMatchStats($pdo,$mid){ /* no-op: match stays ongoing until manually closed */ }

$flash_message=$_SESSION['flash_message']??'';$flash_type=$_SESSION['flash_type']??'success';$buzz_message=$_SESSION['buzz_message']??'';
unset($_SESSION['flash_message'],$_SESSION['flash_type'],$_SESSION['buzz_message']);

$prev_stmt=$pdo->prepare("SELECT id FROM sets WHERE match_id=? AND set_number<? ORDER BY set_number DESC LIMIT 1");$prev_stmt->execute([$match_id,$set['set_number']]);$prev_set=$prev_stmt->fetch();
$next_stmt=$pdo->prepare("SELECT id FROM sets WHERE match_id=? AND set_number>? AND status!='completed' ORDER BY set_number ASC LIMIT 1");$next_stmt->execute([$match_id,$set['set_number']]);$next_set=$next_stmt->fetch();

$ev_map=['goal'=>['⚽','var(--forest-400)'],'assist'=>['🎯','var(--pitch-300)'],'yellow_card'=>['⚠️','#fbbf24'],'red_card'=>['🟥','#f87171']];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Live — Set #<?php echo $set['set_number']; ?> — Noisers Football Pro</title>
    <?php include '../includes/head.php'; ?>
    <?php if ($set['status']==='completed'): ?><meta http-equiv="refresh" content="60"><?php endif; ?>
    <style>
        .score-big{font-size:2.8rem;font-weight:900;line-height:1;}
        .timer-big{font-size:2.2rem;font-weight:900;font-variant-numeric:tabular-nums;}
        .psel{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--border);border-radius:6px;background:transparent;cursor:pointer;width:100%;text-align:left;font-family:'Jost',sans-serif;font-size:.85rem;color:var(--text-main);transition:all .12s;}
        .psel:hover{background:var(--pitch-700);}
        .psel.selected{background:rgba(124,29,53,.15);border-color:var(--burg-700);}
        @media(max-width:640px){.score-big{font-size:2rem;}.timer-big{font-size:1.6rem;}}
        @keyframes pulse{from{opacity:1;}to{opacity:.4;}}
    </style>
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
                    <div class="page-title">Set #<?php echo $set['set_number']; ?> — Live Control</div>
                    <div class="page-sub"><?php echo htmlspecialchars($set['match_name']?:'Match'); ?> · <?php echo date('M j, Y',strtotime($set['match_date'])); ?></div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <a href="match_detail.php?id=<?php echo $match_id; ?>&tab=sets" class="btn btn-ghost btn-sm">Match Detail</a>
                    <?php if($prev_set): ?><a href="match_management.php?set_id=<?php echo $prev_set['id']; ?>" class="btn btn-ghost btn-sm">← Prev</a><?php endif; ?>
                    <?php if($next_set): ?><a href="match_management.php?set_id=<?php echo $next_set['id']; ?>" class="btn btn-success btn-sm">Next →</a><?php else: ?><a href="assign_sets.php?match_id=<?php echo $match_id; ?>" class="btn btn-ghost btn-sm">+ Schedule</a><?php endif; ?>
                </div>
            </div>
        </div>

        <?php if($flash_message): ?><div class="alert alert-<?php echo $flash_type==='success'?'success':'error'; ?>" id="flashMsg" style="margin-bottom:12px;"><?php echo htmlspecialchars($flash_message); ?></div><?php endif; ?>

        <!-- Scoreboard + Timer -->
        <div class="card" style="margin-bottom:16px;">
            <div style="padding:20px;">
                <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-bottom:18px;">
                    <div style="text-align:right;">
                        <?php if($t1['color']): ?><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:<?php echo htmlspecialchars($t1['color']); ?>;margin-right:5px;vertical-align:middle;"></span><?php endif; ?>
                        <span style="font-weight:700;"><?php echo htmlspecialchars($t1['name']); ?></span>
                        <?php if($set['winner']==='team1'): ?><span style="color:var(--forest-400);margin-left:4px;">★</span><?php endif; ?>
                    </div>
                    <div style="text-align:center;">
                        <div class="score-big" style="display:flex;align-items:center;gap:10px;justify-content:center;">
                            <span id="score1"><?php echo $set['team1_goals']; ?></span>
                            <span style="color:var(--text-muted);font-weight:300;">–</span>
                            <span id="score2"><?php echo $set['team2_goals']; ?></span>
                        </div>
                        <div id="setStatusBadge" style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-top:4px;color:<?php echo $set['status']==='active'?'#fbbf24':($set['status']==='completed'?'var(--forest-400)':'var(--text-muted)'); ?>;"><?php echo ucfirst($set['status']); ?></div>
                    </div>
                    <div style="text-align:left;">
                        <?php if($set['winner']==='team2'): ?><span style="color:var(--forest-400);margin-right:4px;">★</span><?php endif; ?>
                        <?php if($t2['color']): ?><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:<?php echo htmlspecialchars($t2['color']); ?>;margin-right:5px;vertical-align:middle;"></span><?php endif; ?>
                        <span style="font-weight:700;"><?php echo htmlspecialchars($t2['name']); ?></span>
                    </div>
                </div>
                <div style="text-align:center;">
                    <div class="timer-big" id="timerDisplay" style="color:<?php echo $set['status']==='active'?'#fbbf24':($set['status']==='completed'?'var(--text-muted)':'var(--text-main)'); ?>;margin-bottom:12px;">
                        <?php $tm=floor($time_left/60);$ts=$time_left%60; echo str_pad($tm,2,'0',STR_PAD_LEFT).':'.str_pad($ts,2,'0',STR_PAD_LEFT); ?>
                    </div>
                    <div id="ctrlBtns" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px;">
                        <?php if($set['status']==='pending'): ?>
                        <button class="btn btn-success btn-sm" onclick="ajax('start_set')">Start Set</button>
                        <?php elseif($set['status']==='active'): ?>
                        <button class="btn btn-ghost btn-sm" onclick="ajax('pause_set')" style="color:#fbbf24;border-color:#fbbf2440;">Pause</button>
                        <button class="btn btn-danger btn-sm" onclick="showEndModal()">End Set</button>
                        <?php elseif($set['status']==='paused'): ?>
                        <button class="btn btn-success btn-sm" onclick="ajax('resume_set')">Resume</button>
                        <button class="btn btn-danger btn-sm" onclick="showEndModal()">End Set</button>
                        <?php else: ?>
                        <span class="badge badge-forest" style="padding:8px 16px;">Set Completed</span>
                        <?php if($next_set): ?>
                        <a href="match_management.php?set_id=<?php echo $next_set['id']; ?>" class="btn btn-success btn-sm" style="font-size:.9rem;padding:10px 20px;">Next Set →</a>
                        <?php else: ?>
                        <a href="match_detail.php?id=<?php echo $match_id; ?>&tab=sets" class="btn btn-ghost btn-sm">Back to Match</a>
                        <?php endif; ?>
                        <?php endif; ?>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;justify-content:center;font-size:.82rem;color:var(--text-muted);">
                        <button onclick="et--;document.getElementById('etDisp').textContent=et;" style="background:none;border:1px solid var(--border);color:var(--text-dim);cursor:pointer;padding:2px 9px;border-radius:4px;">−</button>
                        +<span id="etDisp">0</span> min extra
                        <button onclick="et++;document.getElementById('etDisp').textContent=et;" style="background:none;border:1px solid var(--border);color:var(--text-dim);cursor:pointer;padding:2px 9px;border-radius:4px;">+</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Player actions + Events -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;margin-bottom:16px;">
            <!-- Player actions -->
            <div class="card">
                <div class="card-hd">
                    <span class="card-hd-title">Record Event</span>
                    <div style="display:flex;gap:4px;">
                        <button onclick="switchT('team1')" id="btnT1" class="btn btn-ghost btn-xs" style="background:var(--burg-800);color:var(--text-main);"><?php echo htmlspecialchars(mb_substr($t1['name'],0,8)); ?></button>
                        <button onclick="switchT('team2')" id="btnT2" class="btn btn-ghost btn-xs"><?php echo htmlspecialchars(mb_substr($t2['name'],0,8)); ?></button>
                    </div>
                </div>
                <div id="pT1" style="padding:8px;display:flex;flex-direction:column;gap:4px;max-height:240px;overflow-y:auto;">
                    <?php foreach($t1['players'] as $p): ?>
                    <button class="psel" data-pid="<?php echo $p['id']; ?>" data-team="team1" onclick="selP(this)">
                        <span style="font-weight:700;font-size:.78rem;min-width:24px;">#<?php echo $p['player_number']; ?></span>
                        <span style="flex:1;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo htmlspecialchars($p['full_name']); ?></span>
                        <span style="font-size:.68rem;color:var(--text-muted);"><?php if($p['goals_in_set']>0): ?>⚽<?php echo $p['goals_in_set']; ?> <?php endif; ?><?php if($p['yc_in_set']>0): ?>⚠<?php echo $p['yc_in_set']; ?><?php endif; ?></span>
                    </button>
                    <?php endforeach; ?>
                    <?php if(empty($t1['players'])): ?><div style="text-align:center;color:var(--text-muted);padding:14px;font-size:.82rem;">No players</div><?php endif; ?>
                </div>
                <div id="pT2" style="padding:8px;flex-direction:column;gap:4px;max-height:240px;overflow-y:auto;display:none;">
                    <?php foreach($t2['players'] as $p): ?>
                    <button class="psel" data-pid="<?php echo $p['id']; ?>" data-team="team2" onclick="selP(this)">
                        <span style="font-weight:700;font-size:.78rem;min-width:24px;">#<?php echo $p['player_number']; ?></span>
                        <span style="flex:1;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo htmlspecialchars($p['full_name']); ?></span>
                        <span style="font-size:.68rem;color:var(--text-muted);"><?php if($p['goals_in_set']>0): ?>⚽<?php echo $p['goals_in_set']; ?> <?php endif; ?><?php if($p['yc_in_set']>0): ?>⚠<?php echo $p['yc_in_set']; ?><?php endif; ?></span>
                    </button>
                    <?php endforeach; ?>
                    <?php if(empty($t2['players'])): ?><div style="text-align:center;color:var(--text-muted);padding:14px;font-size:.82rem;">No players</div><?php endif; ?>
                </div>
                <div style="padding:10px;border-top:1px solid var(--border);">
                    <div id="selInfo" style="font-size:.72rem;color:var(--text-muted);margin-bottom:8px;min-height:16px;"></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <button id="bGoal"   class="btn btn-success btn-sm" onclick="recGoal()"          disabled>⚽ Goal</button>
                        <button id="bAssist" class="btn btn-ghost btn-sm"   onclick="recAssist()"        disabled>🎯 Assist</button>
                        <button id="bYellow" class="btn btn-ghost btn-sm"   onclick="recCard('yellow_card')" disabled style="color:#fbbf24;border-color:#fbbf2440;">⚠ Yellow</button>
                        <button id="bRed"    class="btn btn-danger btn-sm"  onclick="recCard('red_card')"    disabled>🟥 Red</button>
                    </div>
                    <!-- Fallback forms -->
                    <details style="margin-top:10px;"><summary style="font-size:.7rem;color:var(--text-muted);cursor:pointer;">Manual fallback forms</summary>
                    <div style="margin-top:8px;display:flex;flex-direction:column;gap:7px;">
                        <?php foreach(['team1'=>$t1['players'],'team2'=>$t2['players']] as $tid=>$tpl): ?>
                        <form method="POST" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
                            <input type="hidden" name="action" value="record_goal_simple">
                            <input type="hidden" name="team" value="<?php echo $tid; ?>">
                            <select name="player_id" class="field" style="flex:1;min-width:120px;font-size:.78rem;">
                                <option value=""><?php echo htmlspecialchars($tid==='team1'?$t1['name']:$t2['name']); ?></option>
                                <?php foreach($tpl as $p): ?><option value="<?php echo $p['id']; ?>">#<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?></option><?php endforeach; ?>
                            </select>
                            <input type="number" name="minute" class="field" style="width:52px;font-size:.78rem;" value="0" min="0" max="99">
                            <input type="hidden" name="extra_time" value="0">
                            <button type="submit" class="btn btn-success btn-xs">Goal</button>
                        </form>
                        <?php endforeach; ?>
                        <form method="POST" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
                            <input type="hidden" name="action" value="record_yellow_card_simple">
                            <select name="player_id" class="field" style="flex:1;min-width:120px;font-size:.78rem;">
                                <option value="">Yellow card</option>
                                <?php foreach(array_merge($t1['players'],$t2['players']) as $p): ?><option value="<?php echo $p['id']; ?>">#<?php echo $p['player_number']; ?> <?php echo htmlspecialchars($p['full_name']); ?></option><?php endforeach; ?>
                            </select>
                            <input type="number" name="minute" class="field" style="width:52px;font-size:.78rem;" value="0">
                            <input type="hidden" name="extra_time" value="0">
                            <button type="submit" class="btn btn-ghost btn-xs" style="color:#fbbf24;border-color:#fbbf2440;">⚠</button>
                        </form>
                    </div></details>
                </div>
            </div>

            <!-- Events log -->
            <div class="card">
                <div class="card-hd"><span class="card-hd-title" id="eventsCount">Events (<?php echo count($events); ?>)</span></div>
                <div id="eventsList">
                <?php if(!empty($events)): ?>
                <div style="max-height:380px;overflow-y:auto;">
                    <?php foreach($events as $ev): [$ei,$ec]=$ev_map[$ev['event_type']]??['📝','var(--text-muted)']; ?>
                    <div style="display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--pitch-700);">
                        <span style="font-size:1rem;"><?php echo $ei; ?></span>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:.8rem;color:<?php echo $ec; ?>;"><?php echo ucfirst(str_replace('_',' ',$ev['event_type'])); ?></div>
                            <div style="font-size:.7rem;color:var(--text-muted);">#<?php echo $ev['player_number']; ?> <?php echo htmlspecialchars($ev['full_name']); ?></div>
                        </div>
                        <div style="font-size:.7rem;color:var(--text-muted);"><?php echo $ev['minute']; ?>'<?php if($ev['extra_time']>0) echo '+'.$ev['extra_time']; ?></div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php else: ?><div class="empty-state" style="padding:20px;"><p style="font-size:.8rem;">No events</p></div><?php endif; ?>
                </div>
            </div>
        </div>

        <!-- Stats mini strip -->
        <div class="stats-strip">
            <div class="stat-box"><div class="stat-num" id="sGoals"><?php echo $set['team1_goals']+$set['team2_goals']; ?></div><div class="stat-lbl">Goals</div></div>
            <div class="stat-box"><div class="stat-num" id="sAssists"><?php echo array_reduce($events,function($c,$e){return $c+($e['event_type']==='assist'?1:0);},0); ?></div><div class="stat-lbl">Assists</div></div>
            <div class="stat-box"><div class="stat-num" style="color:#fbbf24;" id="sYellow"><?php echo array_reduce($events,function($c,$e){return $c+($e['event_type']==='yellow_card'?1:0);},0); ?></div><div class="stat-lbl">Yellow</div></div>
            <div class="stat-box"><div class="stat-num" style="color:#f87171;" id="sRed"><?php echo array_reduce($events,function($c,$e){return $c+($e['event_type']==='red_card'?1:0);},0); ?></div><div class="stat-lbl">Red</div></div>
        </div>
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

<!-- End set modal -->
<div id="endModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100;align-items:center;justify-content:center;padding:16px;">
    <div style="background:var(--pitch-800);border:1px solid var(--border);border-radius:10px;width:100%;max-width:320px;">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);font-weight:700;">End Set</div>
        <div style="padding:14px;"><label class="field-label">Winner</label>
            <select id="winSel" class="field">
                <option value="team1"><?php echo htmlspecialchars($t1['name']); ?> (Team 1)</option>
                <option value="team2"><?php echo htmlspecialchars($t2['name']); ?> (Team 2)</option>
                <option value="draw">Draw</option>
            </select>
        </div>
        <div style="padding:10px 14px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="document.getElementById('endModal').style.display='none'" class="btn btn-ghost btn-sm">Cancel</button>
            <button onclick="confirmEnd()" class="btn btn-danger btn-sm">End Set</button>
        </div>
    </div>
</div>

<?php if($buzz_message): ?>
<div id="buzz" style="position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:200;display:flex;align-items:center;justify-content:center;">
    <div style="text-align:center;padding:36px;background:var(--pitch-800);border:2px solid var(--forest-500);border-radius:14px;max-width:340px;">
        <div style="font-size:2.8rem;margin-bottom:10px;">🎉</div>
        <div style="font-size:1.3rem;font-weight:800;margin-bottom:6px;"><?php echo htmlspecialchars($buzz_message); ?></div>
        <?php if($next_set): ?>
        <a href="match_management.php?set_id=<?php echo $next_set['id']; ?>" class="btn btn-success btn-sm" style="margin-top:10px;font-size:.95rem;">Next Set →</a>
        <?php else: ?>
        <a href="match_detail.php?id=<?php echo $match_id; ?>&tab=sets" class="btn btn-primary btn-sm" style="margin-top:10px;">View Match</a>
        <?php endif; ?>
    </div>
</div>
<?php endif; ?>

<script>
var sid=<?php echo json_encode($set_id); ?>;
var mid=<?php echo json_encode($match_id); ?>;
var stat=<?php echo json_encode($set['status']); ?>;
var tLeft=<?php echo json_encode($time_left); ?>;
var nextSetUrl=<?php echo json_encode($next_set?'match_management.php?set_id='.$next_set['id']:null); ?>;
var et=0;
var selPid=null,selTeam=null;
var timerInt=null,syncInt=null;

function updateTimerDisplay(){
    var m=Math.floor(tLeft/60),s=tLeft%60;
    var el=document.getElementById('timerDisplay');
    if(!el)return;
    el.textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
    if(tLeft===0){
        el.style.color='#f87171';
        el.style.animation='pulse 0.6s ease-in-out infinite alternate';
    } else if(tLeft<=60){
        el.style.color='#f87171';
        el.style.animation='';
    } else {
        el.style.color='#fbbf24';
        el.style.animation='';
    }
}

function startTimer(){
    if(timerInt){clearInterval(timerInt);timerInt=null;}
    timerInt=setInterval(function(){
        if(stat!=='active'){clearInterval(timerInt);timerInt=null;return;}
        if(tLeft>0)tLeft--;
        updateTimerDisplay();
        if(tLeft===0)onTimerEnd();
    },1000);
}

function onTimerEnd(){
    clearInterval(timerInt);timerInt=null;
    var el=document.getElementById('timerDisplay');
    if(el){el.textContent='00:00';el.style.color='#f87171';}
    // Flash the scoreboard to alert the admin
    var card=el?el.closest('.card'):null;
    if(card){card.style.outline='2px solid #f87171';setTimeout(function(){card.style.outline='';},3000);}
}

function renderButtons(s){
    var c=document.getElementById('ctrlBtns');
    if(!c)return;
    var h='';
    if(s==='pending'){
        h='<button class="btn btn-success btn-sm" onclick="ajax(\'start_set\')">Start Set</button>';
    } else if(s==='active'){
        h='<button class="btn btn-ghost btn-sm" onclick="ajax(\'pause_set\')" style="color:#fbbf24;border-color:#fbbf2440;">Pause</button>';
        h+='<button class="btn btn-danger btn-sm" onclick="showEndModal()">End Set</button>';
    } else if(s==='paused'){
        h='<button class="btn btn-success btn-sm" onclick="ajax(\'resume_set\')">Resume</button>';
        h+='<button class="btn btn-danger btn-sm" onclick="showEndModal()">End Set</button>';
    } else {
        h='<span class="badge badge-forest" style="padding:8px 16px;">Set Completed</span>';
        if(nextSetUrl){
            h+='<a href="'+nextSetUrl+'" class="btn btn-success btn-sm" style="font-size:.9rem;padding:10px 20px;">Next Set →</a>';
        } else {
            h+='<a href="match_detail.php?id='+mid+'&tab=sets" class="btn btn-ghost btn-sm">Back to Match</a>';
        }
    }
    c.innerHTML=h;
}

function startSync(){
    if(syncInt)return;
    syncInt=setInterval(function(){
        if(stat!=='active'){clearInterval(syncInt);syncInt=null;return;}
        var fd=new FormData();fd.append('action','get_set_status');
        fetch('match_management.php?set_id='+sid,{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'},body:fd})
        .then(function(r){return r.json();})
        .then(function(res){
            if(!res.success||!res.set)return;
            var ss=res.set;
            if(ss.status==='completed'){stat='completed';location.reload();return;}
            var tl=parseInt(ss.time_left);
            if(!isNaN(tl)&&tl>=0){tLeft=tl;updateTimerDisplay();}
        }).catch(function(){});
    },30000);
}

if(stat==='active'){updateTimerDisplay();startTimer();startSync();}

var fl=document.getElementById('flashMsg');if(fl)setTimeout(function(){fl.style.opacity='0';setTimeout(function(){if(fl.parentNode)fl.parentNode.removeChild(fl);},300);},3000);

function switchT(w){
    document.getElementById('pT1').style.display=w==='team1'?'flex':'none';
    document.getElementById('pT2').style.display=w==='team2'?'flex':'none';
    document.getElementById('btnT1').style.background=w==='team1'?'var(--burg-800)':'';
    document.getElementById('btnT1').style.color=w==='team1'?'var(--text-main)':'';
    document.getElementById('btnT2').style.background=w==='team2'?'var(--burg-800)':'';
    document.getElementById('btnT2').style.color=w==='team2'?'var(--text-main)':'';
    selPid=null;selTeam=null;document.querySelectorAll('.psel').forEach(function(b){b.classList.remove('selected');});updBtns();
}
function selP(btn){
    document.querySelectorAll('.psel').forEach(function(b){b.classList.remove('selected');});
    btn.classList.add('selected');
    selPid=btn.dataset.pid;selTeam=btn.dataset.team;
    var name=btn.querySelectorAll('span')[1].textContent.trim();
    document.getElementById('selInfo').textContent='Selected: '+name;
    updBtns();
}
function updBtns(){var en=!!selPid&&stat!=='completed';['bGoal','bAssist','bYellow','bRed'].forEach(function(id){var el=document.getElementById(id);if(el)el.disabled=!en;});}

var evMap={'goal':['⚽','var(--forest-400)'],'assist':['🎯','var(--pitch-300)'],'yellow_card':['⚠️','#fbbf24'],'red_card':['🟥','#f87171']};

function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function renderEvents(events){
    var c=document.getElementById('eventsList'),h=document.getElementById('eventsCount');
    if(!c)return;
    if(!events||events.length===0){
        c.innerHTML='<div class="empty-state" style="padding:20px;"><p style="font-size:.8rem;">No events</p></div>';
        if(h)h.textContent='Events (0)';return;
    }
    var html='<div style="max-height:380px;overflow-y:auto;">';
    for(var i=0;i<events.length;i++){
        var ev=events[i],em=evMap[ev.event_type]||['📝','var(--text-muted)'];
        var lbl=ev.event_type.replace(/_/g,' ').replace(/\b\w/g,function(ch){return ch.toUpperCase();});
        var min=ev.minute+"'"+(parseInt(ev.extra_time)>0?'+'+ev.extra_time:'');
        html+='<div style="display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--pitch-700);">';
        html+='<span style="font-size:1rem;">'+em[0]+'</span>';
        html+='<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:.8rem;color:'+em[1]+';">'+lbl+'</div>';
        html+='<div style="font-size:.7rem;color:var(--text-muted);">#'+ev.player_number+' '+escHtml(ev.full_name)+'</div></div>';
        html+='<div style="font-size:.7rem;color:var(--text-muted);">'+min+'</div></div>';
    }
    html+='</div>';
    c.innerHTML=html;
    if(h)h.textContent='Events ('+events.length+')';
}

function refreshEvents(){
    var fd=new FormData();fd.append('action','get_set_status');
    fetch('match_management.php?set_id='+sid,{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'},body:fd})
    .then(function(r){return r.json();})
    .then(function(res){
        if(!res.success)return;
        if(res.events)renderEvents(res.events);
        if(res.counts){
            var sa=document.getElementById('sAssists'),sy=document.getElementById('sYellow'),sr=document.getElementById('sRed');
            if(sa)sa.textContent=res.counts.assists;
            if(sy)sy.textContent=res.counts.yellow;
            if(sr)sr.textContent=res.counts.red;
        }
        if(res.set){
            if(res.set.status==='completed'){stat='completed';location.reload();return;}
            var tl=parseInt(res.set.time_left);
            if(stat==='active'&&!isNaN(tl)&&tl>=0){tLeft=tl;updateTimerDisplay();}
        }
    }).catch(function(){});
}

function ajax(action,extra){
    var fd=new FormData();fd.append('action',action);
    if(extra)Object.entries(extra).forEach(function(kv){fd.append(kv[0],kv[1]);});
    fetch('match_management.php?set_id='+sid,{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'},body:fd})
    .then(function(r){return r.json();})
    .then(function(res){
        if(res.success){
            if(res.status){
                stat=res.status;
                var bd=document.getElementById('setStatusBadge');
                var td=document.getElementById('timerDisplay');
                renderButtons(stat);
                if(bd){
                    bd.textContent=stat.charAt(0).toUpperCase()+stat.slice(1);
                    if(stat==='active'){
                        bd.style.color='#fbbf24';
                        if(td)td.style.color='#fbbf24';
                        if(action==='start_set'){tLeft=600;updateTimerDisplay();}
                        startTimer();
                        startSync();
                    } else {
                        clearInterval(timerInt);timerInt=null;
                        clearInterval(syncInt);syncInt=null;
                        if(td)td.style.color=stat==='completed'?'var(--text-muted)':'var(--text-main)';
                        bd.style.color=stat==='completed'?'var(--forest-400)':'var(--text-muted)';
                        if(stat==='completed')setTimeout(function(){location.reload();},800);
                    }
                }
                updBtns();
            }
            if(res.new_score){
                var s1=document.getElementById('score1'),s2=document.getElementById('score2'),sg=document.getElementById('sGoals');
                if(s1)s1.textContent=res.new_score.team1_goals;
                if(s2)s2.textContent=res.new_score.team2_goals;
                if(sg)sg.textContent=parseInt(res.new_score.team1_goals)+parseInt(res.new_score.team2_goals);
            }
            if(res.buzz){setTimeout(function(){location.reload();},600);return;}
            if(action==='record_goal'||action==='record_assist'||action==='record_card'){refreshEvents();}
        }else{alert(res.message||'Error');}
    }).catch(function(e){console.error(e);});
}

function getCurrentMin(){return Math.max(0,Math.round((600-tLeft)/60));}
function recGoal(){if(!selPid)return;ajax('record_goal',{player_id:selPid,team:selTeam,minute:getCurrentMin(),extra_time:et});}
function recAssist(){if(!selPid)return;var gp=prompt('Goal scorer player ID:');if(!gp)return;ajax('record_assist',{player_id:selPid,goal_player_id:gp,minute:getCurrentMin(),extra_time:et});}
function recCard(ct){if(!selPid)return;ajax('record_card',{player_id:selPid,card_type:ct,minute:getCurrentMin(),extra_time:et});}
function showEndModal(){document.getElementById('endModal').style.display='flex';}
function confirmEnd(){var w=document.getElementById('winSel').value;document.getElementById('endModal').style.display='none';ajax('end_set',{winner:w});}

window.addEventListener('click',function(e){if(e.target===document.getElementById('endModal'))document.getElementById('endModal').style.display='none';});
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.getElementById('endModal').style.display='none';});

switchT('team1');
</script>
</body>
</html>
