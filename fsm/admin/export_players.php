<?php
// admin/export_players.php
require_once '../includes/auth.php';
requireAdmin();
require_once '../includes/db_connection.php';

$team_id = getTeamId();

// Get filter parameters
$search = $_GET['search'] ?? '';
$filter_position = $_GET['position'] ?? '';
$filter_status = $_GET['status'] ?? '';

// Build query
$sql = "SELECT * FROM players WHERE team_id = ?";
$params = [$team_id];

if (!empty($search)) {
    $sql .= " AND (full_name LIKE ? OR player_number LIKE ?)";
    $search_term = "%$search%";
    $params[] = $search_term;
    $params[] = $search_term;
}

if (!empty($filter_position)) {
    $sql .= " AND position = ?";
    $params[] = $filter_position;
}

if (!empty($filter_status)) {
    $sql .= " AND is_active = ?";
    $params[] = ($filter_status === 'active' ? 1 : 0);
}

$sql .= " ORDER BY player_number ASC";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$players = $stmt->fetchAll();

// Set headers for CSV download
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=players_' . date('Y-m-d') . '.csv');

// Create output stream
$output = fopen('php://output', 'w');

// Add BOM for UTF-8
fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

// Add headers
$headers = [
    'Player Number',
    'Full Name',
    'Position',
    'Rating',
    'Goals',
    'Assists',
    'Yellow Cards',
    'Red Cards',
    'Height (cm)',
    'Weight (kg)',
    'Blood Type',
    'Preferred Foot',
    'Health Issues',
    'Status'
];
fputcsv($output, $headers);

// Add data rows
foreach ($players as $player) {
    $row = [
        $player['player_number'],
        $player['full_name'],
        $player['position'],
        $player['rating'],
        $player['goals'],
        $player['assists'],
        $player['yellow_cards'],
        $player['red_cards'],
        $player['height'] ?? '',
        $player['weight'] ?? '',
        $player['blood_type'] ?? '',
        $player['preferred_foot'] ?? '',
        str_replace(["\r\n", "\n", "\r"], ' ', $player['health_issues'] ?? ''),
        $player['is_active'] ? 'Active' : 'Inactive'
    ];
    fputcsv($output, $row);
}

fclose($output);
exit();