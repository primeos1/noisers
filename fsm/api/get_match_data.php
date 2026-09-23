<?php
// api/get_match_data.php
require_once '../includes/auth.php';
require_once '../includes/db_connection.php';

header('Content-Type: application/json');

$team_id = getTeamId();
$match_id = $_GET['match_id'] ?? null;

if (!$match_id) {
    echo json_encode(['success' => false, 'message' => 'Match ID required']);
    exit();
}

// Get match data
$match_stmt = $pdo->prepare("
    SELECT m.*, 
           COUNT(DISTINCT pms.player_id) as total_players,
           COUNT(DISTINCT s.id) as total_sets
    FROM matches m
    LEFT JOIN player_match_stats pms ON m.id = pms.match_id
    LEFT JOIN sets s ON m.id = s.match_id
    WHERE m.id = ? AND m.team_id = ?
    GROUP BY m.id
");
$match_stmt->execute([$match_id, $team_id]);
$match = $match_stmt->fetch();

if (!$match) {
    echo json_encode(['success' => false, 'message' => 'Match not found']);
    exit();
}

// Get current active set
$current_set_stmt = $pdo->prepare("
    SELECT * FROM sets 
    WHERE match_id = ? AND status IN ('active', 'paused')
    ORDER BY set_number ASC 
    LIMIT 1
");
$current_set_stmt->execute([$match_id]);
$current_set = $current_set_stmt->fetch();

// Get new events (since last check)
$last_check = $_GET['last_check'] ?? date('Y-m-d H:i:s', strtotime('-1 minute'));
$events_stmt = $pdo->prepare("
    SELECT se.*, 
           p.full_name as player_name,
           p.player_number,
           s.set_number,
           rp.full_name as related_player_name,
           rp.player_number as related_player_number
    FROM set_events se
    JOIN players p ON se.player_id = p.id
    JOIN sets s ON se.set_id = s.id
    LEFT JOIN players rp ON se.related_player_id = rp.id
    WHERE s.match_id = ? AND se.created_at > ?
    ORDER BY se.created_at DESC
    LIMIT 20
");
$events_stmt->execute([$match_id, $last_check]);
$new_events = $events_stmt->fetchAll();

// Get updated sets
$sets_stmt = $pdo->prepare("
    SELECT s.*,
           mt1.team_name as team1_name,
           mt1.color as team1_color,
           mt2.team_name as team2_name,
           mt2.color as team2_color
    FROM sets s
    LEFT JOIN match_teams mt1 ON s.team1_id = mt1.id
    LEFT JOIN match_teams mt2 ON s.team2_id = mt2.id
    WHERE s.match_id = ?
    ORDER BY s.set_number ASC
");
$sets_stmt->execute([$match_id]);
$sets = $sets_stmt->fetchAll();

// Prepare response
$response = [
    'success' => true,
    'data' => [
        'match' => $match,
        'current_set' => $current_set,
        'new_events' => $new_events,
        'sets' => $sets,
        'last_updated' => date('Y-m-d H:i:s'),
        'is_live' => $match['status'] === 'ongoing' && $current_set
    ]
];

echo json_encode($response);