<?php
// player/get_set_events.php
require_once '../includes/auth.php';
requirePlayer();
require_once '../includes/db_connection.php';

$set_id = $_GET['id'] ?? null;

if (!$set_id) {
    echo json_encode(['error' => 'No set ID provided']);
    exit();
}

$team_id = getTeamId();

// Get set details with teams
$set_stmt = $pdo->prepare("
    SELECT s.*, 
           mt1.id as t1_id, mt1.team_name as t1_name, mt1.color as t1_color,
           mt2.id as t2_id, mt2.team_name as t2_name, mt2.color as t2_color
    FROM sets s
    LEFT JOIN match_teams mt1 ON s.team1_id = mt1.id
    LEFT JOIN match_teams mt2 ON s.team2_id = mt2.id
    WHERE s.id = ?
");
$set_stmt->execute([$set_id]);
$set = $set_stmt->fetch();

// Get all events for this set
$events_stmt = $pdo->prepare("
    SELECT se.*, 
           p.full_name as player_name,
           rp.full_name as related_player_name
    FROM set_events se
    LEFT JOIN players p ON se.player_id = p.id
    LEFT JOIN players rp ON se.related_player_id = rp.id
    WHERE se.set_id = ?
    ORDER BY se.minute ASC, se.extra_time ASC, se.created_at ASC
");
$events_stmt->execute([$set_id]);
$events = $events_stmt->fetchAll();

// Get players involved in this set (from both teams)
$players_stmt = $pdo->prepare("
    SELECT DISTINCT p.*, 
           COALESCE(SUM(CASE WHEN se.event_type = 'goal' THEN 1 ELSE 0 END), 0) as goals,
           COALESCE(SUM(CASE WHEN se.event_type = 'assist' THEN 1 ELSE 0 END), 0) as assists,
           COALESCE(SUM(CASE WHEN se.event_type = 'yellow_card' THEN 1 ELSE 0 END), 0) as yellow_cards,
           COALESCE(SUM(CASE WHEN se.event_type = 'red_card' THEN 1 ELSE 0 END), 0) as red_cards
    FROM players p
    LEFT JOIN set_events se ON p.id = se.player_id AND se.set_id = ?
    WHERE p.team_id = ? AND p.is_active = 1
    GROUP BY p.id
    ORDER BY p.player_number
");
$players_stmt->execute([$set_id, $team_id]);
$players = $players_stmt->fetchAll();

// Assign teams to players (simplified - you might need to adjust based on your actual team assignment logic)
foreach($players as &$player) {
    $player['team_id'] = $set['t1_id'] ?? null; // This is simplified - adjust as needed
}

echo json_encode([
    'set' => $set,
    'events' => $events,
    'players' => $players,
    'team1' => ['id' => $set['t1_id'], 'team_name' => $set['t1_name'], 'color' => $set['t1_color']],
    'team2' => ['id' => $set['t2_id'], 'team_name' => $set['t2_name'], 'color' => $set['t2_color']]
]);